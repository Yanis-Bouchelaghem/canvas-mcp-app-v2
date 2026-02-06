import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "dist")
    : import.meta.dirname

export function createServer() : McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0"
    });
    const resourceUri = "ui://canvas-lms/list-courses";

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
    
    registerAppResource(
        server,
        "List courses",
        resourceUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try
            {
                const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
                return {
                    contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                };
            }
            catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable");
            }
        }
    )

    return server;
}