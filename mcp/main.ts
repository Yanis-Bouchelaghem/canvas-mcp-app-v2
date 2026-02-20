import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ErrorCode, isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "node:crypto";
import { createServer } from "./server.js";
import cors from "cors";
import express from "express";

const port = parseInt(process.env.PORT ?? "3001", 10);
const SESSION_TTL_MS = 1 * 60 * 60 * 1000; // 60 minutes

interface Session {
    transport: StreamableHTTPServerTransport;
    lastActivity: number;
}

const sessions: Record<string, Session> = {};
const app = express();
app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    const start = Date.now();
    const mcpMethod: string | undefined = req.body?.method;
    const toolName: string | undefined = req.body?.params?.name;
    const methodLabel = mcpMethod
        ? (toolName ? `${mcpMethod}(${toolName})` : mcpMethod)
        : req.method === "GET" ? "sse-connect" : req.method === "DELETE" ? "session-close" : "—";
    res.on("finish", () => {
        const ms = Date.now() - start;
        const sessionId = req.headers["mcp-session-id"] as string | undefined;
        const session = sessionId ? `[${sessionId.slice(0, 8)}]` : "[new]";
        console.log(`${session} ${methodLabel} → ${res.statusCode} (${ms}ms)`);
    });
    next();
});

app.post("/mcp", async (request, result) => {
    // Creates a new session, or forwards the request to the existing session.
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (sessionId && sessions[sessionId]) {
        sessions[sessionId].lastActivity = Date.now();
        await sessions[sessionId].transport.handleRequest(request, result, request.body);
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
            sessions[sessionId] = { transport, lastActivity: Date.now() };
        },
    });
    transport.onclose = () => {
        const sessionId = transport.sessionId;
        if (sessionId) delete sessions[sessionId];
    };

    const mcpServer = createServer();
    await mcpServer.connect(transport);
    await transport.handleRequest(request, result, request.body);
});

app.get("/mcp", async (request, result) => {
    // Forwards the request to the existing session.
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    sessions[sessionId].lastActivity = Date.now();
    await sessions[sessionId].transport.handleRequest(request, result);
});

app.delete("/mcp", async (request, result) => {
    // Forwards the request to the existing session so it can delete itself.
    const sessionId = request.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !sessions[sessionId]) {
        result.status(400).send("Invalid or missing session ID");
        return;
    }
    await sessions[sessionId].transport.handleRequest(request, result);
});


// Evict sessions that have been inactive for longer than SESSION_TTL_MS.
setInterval(() => {
    const now = Date.now();
    let evictedCount = 0;
    for (const [id, session] of Object.entries(sessions)) {
        if (now - session.lastActivity > SESSION_TTL_MS) {
            session.transport.close();
            delete sessions[id];
            evictedCount++;
        }
    }
    if (evictedCount) console.log(`Evicted ${evictedCount} inactive session(s).`)
}, 5 * 60 * 1000); // Check every 5 minutes

app.listen(port, "0.0.0.0", () => {
    console.log(`MCP server listening on http://0.0.0.0:${port}/mcp`);
});