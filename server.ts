import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerCourseTools } from "./src/tools/courses.js";
import { register as registerUserTools } from "./src/tools/users.js";

export function createServer(): McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0",
    });

    registerCourseTools(server);
    registerUserTools(server);

    return server;
}
