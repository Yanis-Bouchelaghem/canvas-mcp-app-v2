---
name: mcp-app-builder
description: Build MCP Apps with interactive React UIs that run inside MCP-enabled hosts (Claude Desktop, VS Code, etc.). Covers architecture (Tool + Resource + resourceUri), session-based transport, domain-grouped tool organization, React setup with useApp hook, and Vite single-file bundling. No custom abstractions — uses the SDK directly.
---

# MCP App Builder

Build MCP Apps: interactive UIs that run inside MCP-enabled hosts like Claude Desktop and VS Code.

## Core Architecture

An MCP App combines three parts:

```
Host (Claude Desktop, VS Code)
├── AI calls Tool → Server returns result
├── Host reads _meta.ui.resourceUri → Fetches Resource
└── Host renders Resource in sandboxed iframe
    └── React app uses useApp hook to communicate
```

**The Link:** Tool's `_meta.ui.resourceUri` tells the host which Resource contains the UI.

## Project Structure

```
project/
├── package.json
├── tsconfig.json           # React/UI (Vite) — module: esnext, moduleResolution: bundler
├── tsconfig.server.json    # Server (Node.js) — module: nodenext
├── vite.config.ts          # Single-file bundling
├── main.ts                 # Express entry — session-based transport
├── server.ts               # MCP server factory — imports and registers tool domains
├── src/
│   ├── tools/              # Tool domains — grouped by semantic area
│   │   ├── [domain-a].ts   # All domain-a tools + resources
│   │   └── [domain-b].ts   # All domain-b tools + resources
│   ├── models/             # Zod schemas for API response validation
│   │   └── [model].ts
│   └── ui/                 # React UIs — mirrored by domain
│       ├── [domain-a]/
│       │   ├── [tool-name].html
│       │   └── [tool-name].tsx
│       └── [domain-b]/
│           ├── [tool-name].html
│           └── [tool-name].tsx
└── dist/                   # Built output (mirrors src/ui/ structure)
    └── src/ui/
        └── [domain-a]/
            └── [tool-name].html
```

## Design Principles

- **No abstraction over the SDK.** Each tool file uses `registerAppTool` / `registerAppResource` directly. No custom interfaces, no wrappers. A developer who's read the MCP docs can read any tool file immediately.
- **Domain-grouped tools.** Tools are grouped by semantic area, not one file per tool. Each domain file exports a `register(server)` function.
- **Session-based transport.** Each client gets a persistent session (via `randomUUID`), enabling future graceful degradation when host capability detection stabilizes.

## Quick Start

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk react react-dom express zod cors
npm install -D typescript vite @vitejs/plugin-react vite-plugin-singlefile @types/react @types/react-dom @types/node @types/express @types/cors tsx
```

## Package Scripts

```json
{
  "scripts": {
    "build:ui": "rm -rf dist && for f in src/ui/**/*.html; do INPUT=$f npx vite build; done",
    "serve": "npx tsx main.ts",
    "dev": "npm run build:ui && npx tsx --watch main.ts"
  }
}
```

- `build:ui` — Builds all UI entry points into single-file HTML bundles
- `serve` — Starts the MCP server
- `dev` — Builds UI, then starts server with watch mode (restarts on `.ts` changes)

## Implementation

### 1. Session-Based Transport (main.ts)

Uses `StreamableHTTPServerTransport` with session tracking. Each client gets a unique session ID. Three route handlers: POST (creates/reuses sessions), GET (SSE streams), DELETE (session termination).

```typescript
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ErrorCode, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";

const transports: Record<string, StreamableHTTPServerTransport> = {};

app.post("/mcp", async (request, result) => {
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (sessionId && transports[sessionId]) {
        await transports[sessionId].handleRequest(request, result, request.body);
        return;
    }

    if (!isInitializeRequest(request.body)) {
        result.status(400).json({
            jsonrpc: "2.0",
            error: { code: ErrorCode.InvalidRequest, message: "Bad Request: No valid session ID provided" },
            id: null,
        });
        return;
    }

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => { transports[sessionId] = transport; },
    });
    transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
    };

    const mcpServer = createServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(request, result, request.body);
});

// GET — SSE stream for server-initiated messages
app.get("/mcp", async (request, result) => {
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    await transports[sessionId].handleRequest(request, result);
});

// DELETE — session termination
app.delete("/mcp", async (request, result) => {
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    await transports[sessionId].handleRequest(request, result);
});
```

**Important:** `app.use(express.json())` is required before the routes — without it, `request.body` is undefined and `isInitializeRequest` fails.

The SDK's own session-based example lives at:
```
node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/simpleStreamableHttp.js
```

### 2. Server Factory (server.ts)

Thin shell — just creates the server and registers tool domains:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerDomainA } from "./src/tools/domain-a.js";
import { register as registerDomainB } from "./src/tools/domain-b.js";

export function createServer(): McpServer {
    const server = new McpServer({ name: "My App", version: "1.0.0" });
    registerDomainA(server);
    registerDomainB(server);
    return server;
}
```

### 3. Domain Tool Files (tools/*.ts)

Each domain file is self-contained — registers its own tools and resources using the SDK directly:

```typescript
// src/tools/[domain].ts
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { MyModelSchema } from "../models/my-model.js";
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../../dist/src/ui/[domain]")
    : import.meta.dirname;

export function register(server: McpServer) {
    const resourceUri = "ui://my-app/my-tool";

    registerAppResource(server, "My Tool", resourceUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try {
                const html = await fs.readFile(path.join(DIST_DIR, "my-tool.html"), "utf-8");
                return { contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }] };
            } catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
            }
        }
    );

    registerAppTool(server, "my_tool", {
        title: "My Tool",
        description: "Does something useful",
        inputSchema: {},
        _meta: { ui: { resourceUri } },
    }, async (args, extra) => {
        // Read custom headers from the HTTP request (available on every tool call)
        const token = extra.requestInfo?.headers["authorization"];

        if (!token) {
            return {
                content: [{ type: "text", text: "Missing credentials." }],
                isError: true  // Tool execution error — tells the LLM this call failed
            };
        }

        try {
            const response = await fetch(`https://api.example.com/things`, {
                headers: { Authorization: String(token) },
            });

            if (!response.ok) {
                const body = await response.text();
                return {
                    content: [{ type: "text", text: `API error ${response.status}: ${body}` }],
                    isError: true
                };
            }

            // Validate & strip unknown fields with Zod
            const data = z.array(MyModelSchema).parse(await response.json());
            return { content: [{ type: "text", text: JSON.stringify(data) }] };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Request failed: ${error instanceof Error ? error.message : String(error)}` }],
                isError: true
            };
        }
    });
}
```

To add a new domain: create `src/tools/new-domain.ts` with a `register(server)` function, add one import line to `server.ts`.

### Error Handling

MCP has two error mechanisms:

#### Tool Errors

Tools use two error reporting mechanisms:

- **Protocol errors**: Standard JSON-RPC errors for issues like unknown tools, invalid arguments, server errors. Use `throw new McpError(ErrorCode.XXX, "message")`.
  ```typescript
  import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
  throw new McpError(ErrorCode.InvalidParams, "Missing required field: name");
  ```
- **Tool execution errors**: Reported in tool results with `isError: true`. Use for API failures, invalid input data, business logic errors. The LLM sees these and can react (retry, inform user).
  ```typescript
  return {
      content: [{ type: "text", text: "Failed to fetch data: API rate limit exceeded" }],
      isError: true
  };
  ```

Always use `isError: true` for errors that happen during tool execution (API calls, validation, network failures).

#### Resource Errors

Servers SHOULD return standard JSON-RPC errors for common failure cases:

- Resource not found: `-32002`
- Internal errors: `-32603`

```typescript
throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
```

Resources don't return tool results — they either return content or throw.

### Reading HTTP Headers in Tool Handlers

For remote MCP servers (HTTP transport), the SDK passes HTTP headers through to tool handlers via `extra.requestInfo?.headers` on every request. This is useful for auth tokens, API domains, or any client-provided config. Headers type is `Record<string, string | string[] | undefined>` — use `String(value)` when passing to APIs. Client config:

```json
{
  "mcpServers": {
    "my-server": {
      "url": "https://my-server.com/mcp",
      "headers": {
        "Authorization": "Bearer <token>"
      }
    }
  }
}
```

### Zod Model Validation

Define models in `src/models/` using Zod schemas. Parse API responses to validate data and strip unknown fields:

```typescript
// src/models/my-model.ts
import { z } from "zod";

export const MyModelSchema = z.object({
    id: z.number(),
    name: z.string(),
    status: z.enum(["active", "inactive"]),
    created_at: z.string().nullable(),   // nullable: field is present but value can be null
    metadata: z.string().optional(),      // optional: field may not be present at all in the response
});

export type MyModel = z.infer<typeof MyModelSchema>;
```

- `nullable()` — field is present but value can be `null`
- `optional()` — field may not be present at all in the response
- `z.infer<typeof Schema>` — derives a TypeScript type from the schema (single source of truth)

### 4. React UI with useApp Hook

```tsx
// src/ui/[domain]/[tool-name].tsx
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function App() {
    const { app, error } = useApp({
        appInfo: { name: "My App", version: "1.0.0" },
        capabilities: {},
        onAppCreated: (app) => {
            app.ontoolresult = async (result) => setData(result);
        },
    });

    if (error) return <div>Error: {error.message}</div>;
    if (!app) return <div>Connecting...</div>;
    // render UI...
}
```

Each UI entry has a matching `.html` file that loads it:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>My App</title></head>
<body>
  <div id="root"></div>
  <script type="module" src="./[tool-name].tsx"></script>
</body>
</html>
```

### 5. Vite Single-File Bundling

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
    plugins: [react(), viteSingleFile()],
    build: {
        rollupOptions: { input: process.env.INPUT },
        outDir: "dist",
        emptyOutDir: false,  // Important: multiple builds append to dist/
    },
});
```

## Graceful Degradation (Future)

Session-based transport enables capability checking via `getUiCapability()` in `oninitialized`. This would allow registering different tool descriptions for UI vs text-only clients. **Currently not stable** — hosts like VS Code Insiders support MCP Apps but don't advertise `extensions["io.modelcontextprotocol/ui"]` in their capabilities yet.

When it works, the pattern is:
1. Register baseline tools outside `oninitialized` (to ensure `tools/list` handler exists)
2. In `oninitialized`, check `getUiCapability(caps)` and `.update()` tools with UI metadata or text-only descriptions
3. Registered tools have `.update()`, `.remove()`, `.enable()`, `.disable()` methods

## Research Practice

When implementing patterns or solving problems, **always search inside installed libraries** (`node_modules/`) for real, working examples before relying on memory alone. Libraries often ship example code, tests, and reference implementations that are guaranteed to be correct and up-to-date with the version installed.

For example, `@modelcontextprotocol/sdk` ships full server examples at:
```
node_modules/@modelcontextprotocol/sdk/dist/esm/examples/server/
```

Use glob patterns like `node_modules/<package>/**/examples/**` or grep for specific API usage to find authoritative references. This prevents hallucinated patterns and ensures correctness.

## Reference Files

| Topic | File |
|-------|------|
| Server setup patterns | [references/server-patterns.md](references/server-patterns.md) |
| React UI patterns | [references/react-patterns.md](references/react-patterns.md) |
| Graceful degradation | [references/graceful-degradation.md](references/graceful-degradation.md) |
| TypeScript configs | [references/typescript-configs.md](references/typescript-configs.md) |
