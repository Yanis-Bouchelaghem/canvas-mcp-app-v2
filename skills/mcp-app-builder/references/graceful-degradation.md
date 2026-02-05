# Graceful Degradation

How to support both UI-capable and text-only MCP clients.

## The Problem

If a tool's description says "displays an interactive dashboard", the LLM will respond:
> "Here's your dashboard!"

But if the client doesn't support MCP Apps UI, the user sees nothing useful.

## The Solution

Check client capabilities at connection time and register tools with appropriate descriptions.

## Capability Detection

MCP Apps support is detected via the `extensions` field in client capabilities:

```typescript
import {
  getUiCapability,
  RESOURCE_MIME_TYPE
} from "@modelcontextprotocol/ext-apps/server";

// In server.server.oninitialized callback
const clientCapabilities = server.server.getClientCapabilities();
const uiCap = getUiCapability(clientCapabilities);
const supportsUI = uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE);
```

### How It Works

1. Client connects and sends `initialize` request with capabilities
2. Server's `oninitialized` callback fires
3. `getClientCapabilities()` returns what the client advertised
4. `getUiCapability()` extracts the MCP Apps extension info
5. Check if `mimeTypes` includes `text/html;profile=mcp-app`

### Client Capabilities Structure

UI-capable clients advertise:

```json
{
  "capabilities": {
    "extensions": {
      "io.modelcontextprotocol/ui": {
        "mimeTypes": ["text/html;profile=mcp-app"]
      }
    }
  }
}
```

## Implementation Pattern

### Dual-Description Tools

Define tools with both UI and text descriptions:

```typescript
// tools/my-domain.ts
export const myTool = {
  name: "my_tool",
  descriptionUI: "Displays interactive dashboard with data visualization",
  descriptionText: "Returns data. Output the results in a clear, formatted way.",
  inputSchema: { /* ... */ },
  handler: async (args) => {
    const data = await fetchData(args);
    // Always return text content for fallback
    return {
      content: [{
        type: "text",
        text: formatAsText(data)
      }]
    };
  },
};
```

### Registration with Capability Check

```typescript
// tools/index.ts
import { getUiCapability, RESOURCE_MIME_TYPE, registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { myTool } from "./my-domain.js";

export function registerAllTools(server: McpServer, resourceUri: string) {
  const clientCapabilities = server.server.getClientCapabilities();
  const uiCap = getUiCapability(clientCapabilities);
  const supportsUI = uiCap?.mimeTypes?.includes(RESOURCE_MIME_TYPE);

  if (supportsUI) {
    // Register with UI metadata and UI-oriented description
    registerAppTool(server, myTool.name, {
      description: myTool.descriptionUI,
      inputSchema: myTool.inputSchema,
      _meta: { ui: { resourceUri } },
    }, myTool.handler);
  } else {
    // Register without UI, with text-oriented description
    server.registerTool(myTool.name, {
      description: myTool.descriptionText,
      inputSchema: myTool.inputSchema,
    }, myTool.handler);
  }
}
```

### Server Setup

```typescript
// server.ts
export function createServer(): McpServer {
  const server = new McpServer({ name: "My App", version: "1.0.0" });
  const resourceUri = "ui://my-app/dashboard";

  // IMPORTANT: Register tools in oninitialized, not at creation time
  server.server.oninitialized = () => {
    registerAllTools(server, resourceUri);
  };

  // Resource can be registered immediately (only fetched if needed)
  registerAppResource(server, resourceUri, resourceUri,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => { /* ... */ }
  );

  return server;
}
```

## Description Guidelines

### UI-Capable Client Descriptions

Focus on the visual experience:
- "Displays an interactive dashboard"
- "Shows a visual chart with..."
- "Renders a form for..."

### Text-Only Client Descriptions

Instruct the LLM to format output:
- "Returns data. Format the results clearly for the user."
- "Fetches information. Present it in a readable format."
- "Gets status. Output as a well-organized list."

## Always Return Text Content

Even with UI support, tools MUST return meaningful `content`:

```typescript
// Good - always includes text
return {
  content: [{
    type: "text",
    text: JSON.stringify(data, null, 2)
  }]
};

// Bad - no fallback for non-UI clients
return {
  content: []  // Don't do this!
};
```

## Source Reference

This pattern is documented in the official MCP Apps specification:
- File: `ext-apps/specification/2026-01-26/apps.mdx`
- Lines: 1531-1560

The `getUiCapability` function is exported from:
- File: `@modelcontextprotocol/ext-apps/server`
- Source: `ext-apps/src/server/index.ts` line 421
