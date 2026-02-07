import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ErrorCode, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { createServer } from "./server.js";
import cors from "cors";
import express from "express";

const port = parseInt(process.env.PORT ?? "3001", 10);
const transports: Record<string, StreamableHTTPServerTransport> = {};
const app = express();
app.use(cors());
app.use(express.json());

app.post("/mcp", async (request, result) => {
    // Creates a new session, or forwards the request to the existing session.
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
        onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
        },
    });
    transport.onclose = () => {
        const sessionId = transport.sessionId;
        if (sessionId) delete transports[sessionId];
    };

    const mcpServer = createServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(request, result, request.body);
});

app.get("/mcp", async (request, result) => {
    // Forwards the request to the existing session.
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    await transports[sessionId].handleRequest(request, result);
});

app.delete("/mcp", async (request, result) => {
    // Forwards the request to the existing session.
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    await transports[sessionId].handleRequest(request, result);
});


app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
});