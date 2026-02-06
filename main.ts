import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import cors from "cors";
import express from "express";

const port = parseInt(process.env.PORT ?? "3001", 10);
const app = express();
app.use(cors());

app.all("/mcp", async (request, result) => {
    const mcpServer = createServer()
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined // Stateless MCP
    });
    result.on("close", async () => {
        try
        {
            await transport.close();
            await mcpServer.close();
        }
        catch(error)
        {
            console.error(error);
        }
    });
    
    await mcpServer.connect(transport);
    await transport.handleRequest(request, result, request.body);
});



app.listen(port, () => {
    console.log(`MCP server listening on http://localhost:${port}/mcp`);
});