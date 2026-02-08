import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import fs from "node:fs/promises";
import path from "node:path";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../../dist/src/ui/courses")
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
    }, async (args, extra) => {
        try {
            const creds = extractCredentials(extra);
            const courses = await canvasClient.getCourses(creds);
            return { content: [{ type: "text", text: JSON.stringify(courses) }] };
        } catch (error) {
            return {
                content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true
            };
        }
    });
}
