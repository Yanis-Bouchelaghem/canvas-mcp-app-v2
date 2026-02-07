import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerCourseTools } from "./tools/courses.js";

export function createServer(): McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0",
    });

    registerCourseTools(server);

    return server;
}
