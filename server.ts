import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";


export function createServer() : McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0"
    });
    const resourceUri = "ui//canvas-lms/list-courses";

    server.server.oninitialized = () => {
        registerAppTool(server, "list_courses", {
            title: "List Courses",
            description: "List courses in Canvas LMS",
            inputSchema: {},
            _meta : { ui: { resourceUri } }
        }, async () => {
            return { content: [{type: "text", text: "This is a placeholder for the list courses tool. Implement the logic to fetch and return courses from Canvas LMS."}] };
        });
    };

    return server;
}