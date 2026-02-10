import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import { CourseSchema } from "../models/course.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

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

    // Data tool — returns raw JSON for the model to reason about
    server.registerTool(
        "list_courses",
        { description: "List all courses in Canvas LMS" },
        async (extra) => {
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

    // UI tool — pass-through, renders whatever courses the model gives it
    registerAppTool(server, "display_courses", {
        title: "Display Courses",
        description: "Display a list of courses in a visual UI. Takes an array of course objects as input. This usually receives the output of list_courses if you want to display them.",
        inputSchema: { courses: z.array(CourseSchema) },
        _meta: { ui: { resourceUri: listCoursesUri } },
    }, async (args) => {
        return { content: [{ type: "text", text: `Displayed ${args.courses.length} course(s).` }] };
    });
}
