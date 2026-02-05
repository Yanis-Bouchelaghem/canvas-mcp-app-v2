---
name: mcp-app-builder
description: Build MCP Apps with interactive React UIs that run inside MCP-enabled hosts (Claude Desktop, etc.). Use when creating MCP servers that need visual interfaces, dashboards, or interactive components. Covers architecture (Tool + Resource + resourceUri), React setup with useApp hook, graceful degradation for non-UI clients, modular tool organization, and Vite single-file bundling.
---

# MCP App Builder

Build MCP Apps: interactive UIs that run inside MCP-enabled hosts like Claude Desktop.

## Core Architecture

An MCP App combines three parts:

```
Host (Claude Desktop)
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
├── tsconfig.json           # React (Vite)
├── tsconfig.server.json    # Server (Node.js)
├── vite.config.ts          # Single-file bundling
├── mcp-app.html            # React entry point
├── src/
│   └── mcp-app.tsx         # React UI with useApp hook
├── tools/                  # Modular tool definitions
│   ├── index.ts            # Registration with capability check
│   └── [domain].ts         # Domain-specific tools
├── server.ts               # MCP server setup
├── main.ts                 # Express entry (HTTP + stdio)
└── dist/                   # Built output
    └── mcp-app.html        # Bundled single-file React app
```

## Quick Start

```bash
npm install @modelcontextprotocol/ext-apps @modelcontextprotocol/sdk react react-dom express zod cors
npm install -D typescript vite @vitejs/plugin-react vite-plugin-singlefile @types/react @types/react-dom @types/node @types/express @types/cors cross-env tsx
```

## Implementation

### 1. Tool + Resource Registration

See [references/server-patterns.md](references/server-patterns.md) for complete server setup.

```typescript
// server.ts - Core pattern
const resourceUri = "ui://my-app/dashboard";

// Register tool with UI link
registerAppTool(server, "my_tool", {
  description: "Tool with interactive UI",
  _meta: { ui: { resourceUri } },
}, handler);

// Register resource serving bundled React
registerAppResource(server, resourceUri, resourceUri,
  { mimeType: RESOURCE_MIME_TYPE },
  async () => ({
    contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }]
  })
);
```

### 2. React UI with useApp Hook

See [references/react-patterns.md](references/react-patterns.md) for complete React setup.

```tsx
// src/mcp-app.tsx - Core pattern
import { useApp } from "@modelcontextprotocol/ext-apps/react";

function App() {
  const { app, error } = useApp({
    appInfo: { name: "My App", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      // Register handlers BEFORE connection
      app.ontoolresult = async (result) => setData(result);
      app.onhostcontextchanged = (ctx) => setContext(ctx);
    },
  });

  if (error) return <div>Error: {error.message}</div>;
  if (!app) return <div>Connecting...</div>;

  // Call server tools from UI
  const refresh = () => app.callServerTool({ name: "my_tool", arguments: {} });
}
```

### 3. Graceful Degradation

See [references/graceful-degradation.md](references/graceful-degradation.md) for capability checking.

**Problem:** If tool description says "displays a UI", non-UI clients get no useful output.

**Solution:** Check capabilities, register different descriptions:

```typescript
import { getUiCapability, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";

server.server.oninitialized = () => {
  const caps = server.server.getClientCapabilities();
  const supportsUI = getUiCapability(caps)?.mimeTypes?.includes(RESOURCE_MIME_TYPE);

  if (supportsUI) {
    registerAppTool(server, "my_tool", {
      description: "Shows interactive dashboard",  // UI description
      _meta: { ui: { resourceUri } },
    }, handler);
  } else {
    server.registerTool("my_tool", {
      description: "Output the data in clear format",  // Text description
    }, handler);
  }
};
```

### 4. Modular Tools

Organize tools by domain for maintainability:

```typescript
// tools/courses.ts
export const listCoursesTool = {
  name: "list_courses",
  descriptionUI: "Lists courses with interactive dashboard",
  descriptionText: "Lists courses. Output details clearly.",
  inputSchema: { /* zod schema */ },
  handler: async (args) => ({ content: [{ type: "text", text: "..." }] }),
};

// tools/index.ts
export function registerAllTools(server, resourceUri, supportsUI) {
  const tools = [listCoursesTool, /* more tools */];
  tools.forEach(t => supportsUI
    ? registerAppTool(server, t.name, { description: t.descriptionUI, _meta: { ui: { resourceUri } } }, t.handler)
    : server.registerTool(t.name, { description: t.descriptionText }, t.handler)
  );
}
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
  },
});
```

Build: `cross-env INPUT=mcp-app.html vite build`

## Testing

```bash
npm run build && npm run serve  # Server at http://localhost:3001/mcp

# Test with basic-host (if available)
cd /path/to/ext-apps/examples/basic-host
SERVERS='["http://localhost:3001/mcp"]' npm run start
# Open http://localhost:8080
```

## Reference Files

| Topic | File |
|-------|------|
| Server setup patterns | [references/server-patterns.md](references/server-patterns.md) |
| React UI patterns | [references/react-patterns.md](references/react-patterns.md) |
| Graceful degradation | [references/graceful-degradation.md](references/graceful-degradation.md) |
| TypeScript configs | [references/typescript-configs.md](references/typescript-configs.md) |
