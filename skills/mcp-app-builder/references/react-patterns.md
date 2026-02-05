# React Patterns

Complete patterns for MCP App React UI setup.

## Table of Contents
- [mcp-app.html - Entry Point](#mcp-apphtml)
- [mcp-app.tsx - Main Component](#mcp-apptsx)
- [useApp Hook Details](#useapp-hook)
- [Host Context and Styling](#host-context)
- [Calling Server Tools](#calling-server-tools)

## mcp-app.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <title>My MCP App</title>
  <link rel="stylesheet" href="/src/global.css">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/mcp-app.tsx"></script>
</body>
</html>
```

## mcp-app.tsx

```tsx
import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";
import { useApp } from "@modelcontextprotocol/ext-apps/react";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { StrictMode, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import styles from "./mcp-app.module.css";

function MyApp() {
  const [toolResult, setToolResult] = useState<CallToolResult | null>(null);
  const [hostContext, setHostContext] = useState<McpUiHostContext | undefined>();

  const { app, error } = useApp({
    appInfo: { name: "My App", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (app) => {
      // Register ALL handlers BEFORE connection
      app.onteardown = async () => {
        console.info("App teardown");
        return {};
      };

      app.ontoolinput = async (input) => {
        console.info("Tool input:", input);
      };

      app.ontoolresult = async (result) => {
        console.info("Tool result:", result);
        setToolResult(result);
      };

      app.ontoolcancelled = (params) => {
        console.info("Tool cancelled:", params.reason);
      };

      app.onerror = console.error;

      app.onhostcontextchanged = (params) => {
        setHostContext((prev) => ({ ...prev, ...params }));
      };
    },
  });

  useEffect(() => {
    if (app) {
      setHostContext(app.getHostContext());
    }
  }, [app]);

  if (error) return <div>Error: {error.message}</div>;
  if (!app) return <div>Connecting...</div>;

  return <AppContent app={app} toolResult={toolResult} hostContext={hostContext} />;
}

interface AppContentProps {
  app: App;
  toolResult: CallToolResult | null;
  hostContext?: McpUiHostContext;
}

function AppContent({ app, toolResult, hostContext }: AppContentProps) {
  const [data, setData] = useState<string>("No data yet");

  useEffect(() => {
    if (toolResult?.content) {
      const textContent = toolResult.content.find((c) => c.type === "text");
      if (textContent && "text" in textContent) {
        setData(textContent.text);
      }
    }
  }, [toolResult]);

  const handleRefresh = useCallback(async () => {
    try {
      const result = await app.callServerTool({ name: "my_tool", arguments: {} });
      const textContent = result.content?.find((c) => c.type === "text");
      if (textContent && "text" in textContent) {
        setData(textContent.text);
      }
    } catch (e) {
      console.error(e);
      setData("Error fetching data");
    }
  }, [app]);

  return (
    <main
      className={styles.main}
      style={{
        paddingTop: hostContext?.safeAreaInsets?.top,
        paddingRight: hostContext?.safeAreaInsets?.right,
        paddingBottom: hostContext?.safeAreaInsets?.bottom,
        paddingLeft: hostContext?.safeAreaInsets?.left,
      }}
    >
      <h1>My MCP App</h1>
      <p>Data: {data}</p>
      <button onClick={handleRefresh}>Refresh</button>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MyApp />
  </StrictMode>,
);
```

## useApp Hook

The `useApp` hook from `@modelcontextprotocol/ext-apps/react`:

1. Creates PostMessage transport to `window.parent`
2. Creates App instance
3. Calls `onAppCreated` callback (register handlers here)
4. Calls `app.connect()`

**Critical:** Register ALL handlers in `onAppCreated` BEFORE connection completes.

### Handler Reference

| Handler | When Called |
|---------|-------------|
| `ontoolinput` | When host sends tool input args |
| `ontoolresult` | When tool execution completes |
| `ontoolcancelled` | When tool execution is cancelled |
| `onhostcontextchanged` | When host context updates (theme, safe area) |
| `onteardown` | When app is being destroyed |
| `onerror` | On errors |

## Host Context

The host provides context including theme and safe area insets:

```typescript
interface McpUiHostContext {
  theme?: "light" | "dark";
  safeAreaInsets?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  // ... other properties
}
```

Always respect safe area insets for proper rendering:

```tsx
<main style={{
  paddingTop: hostContext?.safeAreaInsets?.top,
  paddingRight: hostContext?.safeAreaInsets?.right,
  paddingBottom: hostContext?.safeAreaInsets?.bottom,
  paddingLeft: hostContext?.safeAreaInsets?.left,
}}>
```

## Calling Server Tools

From the React UI, call registered server tools:

```typescript
// Basic call
const result = await app.callServerTool({
  name: "tool_name",
  arguments: { param1: "value" }
});

// With error handling
try {
  const result = await app.callServerTool({
    name: "search",
    arguments: { query: searchTerm }
  });
  handleResult(result);
} catch (error) {
  console.error("Tool call failed:", error);
}
```

## Other App Methods

```typescript
// Send message to host
await app.sendMessage({
  role: "user",
  content: [{ type: "text", text: "User action occurred" }]
});

// Send debug log
await app.sendLog({ level: "info", data: "Debug info" });

// Open link in host
await app.openLink({ url: "https://example.com" });
```
