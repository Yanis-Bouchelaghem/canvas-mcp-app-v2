import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../dist/ui/courses")
    : import.meta.dirname;

export function register(server: McpServer) {
    const listCoursesUri = "ui://canvas-lms/list-courses";

    registerAppResource(
        server,
        "List courses",
        listCoursesUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try {
                const html = await fs.readFile(path.join(DIST_DIR, "list-courses.html"), "utf-8");
                return {
                    contents: [{ uri: listCoursesUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                };
            }
            catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
            }
        }
    );

    registerAppTool(server, "list_courses", {
        title: "List Courses",
        description: "List courses in Canvas LMS",
        inputSchema: {},
        _meta: { ui: { resourceUri: listCoursesUri } },
    }, async () => {
        return { content: [{ type: "text", text: "This is a placeholder for the list courses tool." }] };
    });
}
