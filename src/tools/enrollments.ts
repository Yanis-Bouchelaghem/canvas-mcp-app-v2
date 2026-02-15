import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import { ProgressSchema } from "../models/progress.js";
import { EnrollmentTypeEnum } from "../models/enrollment.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { SessionState } from "../../server.js";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../../dist/src/ui/enrollments")
    : import.meta.dirname;

export function register(server: McpServer, sessionState: SessionState) {
    const enrollProgressUri = "ui://canvas-lms/enroll-progress";

    registerAppResource(
        server,
        "Enrollment progress",
        enrollProgressUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try {
                const html = await fs.readFile(path.join(DIST_DIR, "enroll-progress.html"), "utf-8");
                return {
                    contents: [{ uri: enrollProgressUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                };
            } catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
            }
        }
    );

    registerAppTool(server, "enroll_users_in_courses", {
        title: "Enroll Users in Courses",
        description: "Bulk-enroll users into one or more courses. Takes user IDs, course IDs, and an optional enrollment type. Returns a progress object tracking the async job.",
        annotations: { readOnlyHint: false },
        inputSchema: {
            user_ids: z.array(z.number()).describe("Canvas user IDs to enroll"),
            course_ids: z.array(z.number()).describe("Canvas course IDs to enroll users into"),
            enrollment_type: EnrollmentTypeEnum.optional().describe("Enrollment type (defaults to StudentEnrollment)"),
        },
        _meta: { ui: { resourceUri: enrollProgressUri } },
    }, async (args, extra) => {
        try {
            const creds = extractCredentials(extra);
            const progress = await canvasClient.bulkEnroll(
                creds,
                args.user_ids,
                args.course_ids,
                args.enrollment_type,
            );
            return {
                content: [{ type: "text", text: JSON.stringify(progress) }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true,
            };
        }
    });

    registerAppTool(server, "get_enrollment_progress", {
        title: "Get Enrollment Progress",
        description: "Check the progress of a bulk enrollment job.",
        annotations: { readOnlyHint: true },
        inputSchema: {
            progress_id: z.number().describe("The progress ID returned by enroll_users_in_courses"),
        },
        _meta: { ui: { visibility: ["app"] } },
    }, async (args, extra) => {
        try {
            const creds = extractCredentials(extra);
            const progress = await canvasClient.getProgress(creds, args.progress_id);
            return {
                content: [{ type: "text", text: JSON.stringify(progress) }],
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true,
            };
        }
    });
}
