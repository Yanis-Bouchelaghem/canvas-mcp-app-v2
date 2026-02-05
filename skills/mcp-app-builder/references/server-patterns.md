# Server Patterns

Complete patterns for MCP App server setup.

## Table of Contents
- [server.ts - MCP Server Setup](#serverts)
- [main.ts - Express Entry Point](#maints)
- [Tool Handler Pattern](#tool-handler-pattern)

## server.ts

```typescript
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE, getUiCapability } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult, ReadResourceResult } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

// Handle both source and compiled paths
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "dist")
  : import.meta.dirname;

export function createServer(): McpServer {
  const server = new McpServer({
    name: "My MCP App",
    version: "1.0.0",
  });

  const resourceUri = "ui://my-app/dashboard";

  // Register tools AFTER client connects (for capability check)
  server.server.oninitialized = () => {
    const clientCapabilities = server.server.getClientCapabilities();
    const uiCap = getUiCapability(clientCapabilities);
    const supportsUI = uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE);

    if (supportsUI) {
      // UI-capable client
      registerAppTool(server, "my_tool", {
        title: "My Tool",
        description: "Interactive tool with dashboard UI",
        inputSchema: {},
        _meta: { ui: { resourceUri } },
      }, async (): Promise<CallToolResult> => {
        return { content: [{ type: "text", text: "Tool executed" }] };
      });
    } else {
      // Text-only fallback
      server.registerTool("my_tool", {
        description: "Tool that outputs data. Format output clearly for the user.",
      }, async () => {
        return { content: [{ type: "text", text: "Tool executed" }] };
      });
    }
  };

  // Always register the resource (only fetched if UI supported)
  registerAppResource(server, resourceUri, resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async (): Promise<ReadResourceResult> => {
      const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
      return {
        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
      };
    }
  );

  return server;
}
```

## main.ts

```typescript
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

// HTTP mode (stateless)
export async function startHTTPServer(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
  });
}

// Stdio mode (for Claude Desktop)
export async function startStdioServer(): Promise<void> {
  await createServer().connect(new StdioServerTransport());
}

// Entry point
async function main() {
  if (process.argv.includes("--stdio")) {
    await startStdioServer();
  } else {
    await startHTTPServer();
  }
}

main().catch(console.error);
```

## Tool Handler Pattern

Tools must always return a `content` array with text (for non-UI fallback):

```typescript
async function myToolHandler(args: { query: string }): Promise<CallToolResult> {
  const data = await fetchData(args.query);

  // Always include text content for non-UI clients
  return {
    content: [{
      type: "text",
      text: formatAsText(data),  // Human-readable text
    }],
  };
}
```

For tools with Zod validation:

```typescript
import { z } from "zod";

registerAppTool(server, "search", {
  description: "Search for items",
  inputSchema: {
    query: z.string().describe("Search query"),
    limit: z.number().optional().describe("Max results"),
  },
  _meta: { ui: { resourceUri } },
}, async ({ query, limit = 10 }) => {
  const results = await search(query, limit);
  return { content: [{ type: "text", text: JSON.stringify(results) }] };
});
```
