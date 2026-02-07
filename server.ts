import { getUiCapability, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "dist/src")
    : import.meta.dirname

export function createServer(): McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0",
        
    },
    {
        capabilities: {
            tools: {
                listChanged: true,
            },
            resources: {
                listChanged: true,
            }
        }
    });
    const resourceUri = "ui://canvas-lms/list-courses";

    // Baseline registration — ensures tools/list handler exists before oninitialized
    const listCoursesTool = server.registerTool("list_courses", {
        title: "List Courses",
        description: "List courses.",
        inputSchema: {},
    }, async () => {
        return { content: [{ type: "text", text: "Placeholder" }] };
    });

    server.server.oninitialized = () => {
        const clientCapabilities = server.server.getClientCapabilities();
        const clientSupportsUI = getUiCapability(clientCapabilities)?.mimeTypes?.includes(RESOURCE_MIME_TYPE);

        if (true) {
            listCoursesTool.update({
                description: "Display the list of courses in an interactive UI to the user.",
                _meta: { ui: { resourceUri } },
                callback: async () => {
                    return { content: [{type: "text", text: "Overriden."}]};
                }
            });

            registerAppResource(
                server,
                "List courses",
                resourceUri,
                { mimeType: RESOURCE_MIME_TYPE },
                async () => {
                    try {
                        const html = await fs.readFile(path.join(DIST_DIR, "mcp-app.html"), "utf-8");
                        return {
                            contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                        };
                    }
                    catch (error) {
                        console.error("Failed to read UI file:", error);
                        throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
                    }
                }
            );
        }
    };




    return server;
}