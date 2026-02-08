import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { CourseSchema } from "../models/course.js"
import fs from "node:fs/promises";
import path from "node:path";
import z from "zod";

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
        const canvasToken = extra.requestInfo?.headers["authorization"];
        const canvasDomain = extra.requestInfo?.headers["x-canvas-domain"];

        if(!canvasToken || !canvasDomain) {
            return {
                content: [{type: "text", text: "Missing credentials or domain. Ask the user to ensure they have properly configured the MCP with headers 'authorization' and 'x-canvas-domain'."}],
                isError: true
            }
        }

        try {
            const response = await fetch(`${canvasDomain}/api/v1/courses`,
                { headers : { Authorization: String(canvasToken)},}
            );

            if (!response.ok){
                const body = await response.text();
                return {
                    content: [{ type: "text", text: `Canvas API error ${response.status}: ${body}`}],
                    isError: true
                }
            }
            const courses = z.array(CourseSchema).parse(await response.json());
            return { content: [{ type: "text", text: JSON.stringify(courses) }] };
        } catch (error) {
            return {
                content: [{ type: "text", text: `Failed to reach Canvas API at ${canvasDomain}: ${error instanceof Error ? error.message : String(error)}`}],
                isError: true
            }
        }
    });
}
