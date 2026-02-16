import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import { ProgressSchema } from "../models/progress.js";
import { EnrollmentTypeEnum, UnenrollActionEnum } from "../models/enrollment.js";
import { randomUUID } from "node:crypto";
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
            user_emails: z.array(z.string()).optional().describe("User emails (display only, shown in the UI)"),
            course_names: z.array(z.string()).optional().describe("Course names (display only, shown in the UI)"),
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
                _meta: { viewUUID: randomUUID() },
            };
        } catch (error) {
            return {
                content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true,
            };
        }
    });

    // ── Unenroll preview + apply ──

    const unenrollPreviewUri = "ui://canvas-lms/unenroll-preview";

    registerAppResource(
        server,
        "Unenroll preview",
        unenrollPreviewUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try {
                const html = await fs.readFile(path.join(DIST_DIR, "unenroll-preview.html"), "utf-8");
                return {
                    contents: [{ uri: unenrollPreviewUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                };
            } catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
            }
        }
    );

    const unenrollCourseSchema = z.object({
        course_id: z.number(),
        course_name: z.string(),
        users: z.array(z.object({
            enrollment_id: z.number(),
            user_name: z.string(),
            user_email: z.string(),
            action: UnenrollActionEnum,
        })),
    });

    registerAppTool(server, "propose_unenroll_users_from_courses", {
        title: "Propose Unenroll Users from Courses",
        description: "Show a preview of users to be unenrolled from courses. The teacher can review and confirm or cancel. Provide course names, user names/emails, enrollment IDs, and the action (conclude, delete, or deactivate) for each.",
        annotations: { readOnlyHint: true },
        inputSchema: {
            courses: z.array(unenrollCourseSchema).describe("Courses with users to unenroll"),
        },
        _meta: { ui: { resourceUri: unenrollPreviewUri } },
    }, async () => {
        return {
            content: [{ type: "text", text: "Unenrollment proposal displayed. Waiting for teacher to confirm or cancel." }],
            _meta: { viewUUID: randomUUID() },
        };
    });

    registerAppTool(server, "apply_unenrollment", {
        title: "Apply Unenrollment",
        description: "Execute the proposed unenrollments.",
        annotations: { readOnlyHint: false },
        inputSchema: {
            courses: z.array(z.object({
                course_id: z.number(),
                users: z.array(z.object({
                    enrollment_id: z.number(),
                    action: UnenrollActionEnum,
                })),
            })),
        },
        _meta: { ui: { visibility: ["app"] } },
    }, async (args, extra) => {
        try {
            const creds = extractCredentials(extra);
            let succeeded = 0;
            const failed: { enrollment_id: number; error: string }[] = [];

            for (const course of args.courses) {
                for (const user of course.users) {
                    try {
                        await canvasClient.deleteEnrollment(creds, course.course_id, user.enrollment_id, user.action);
                        succeeded++;
                    } catch (error) {
                        failed.push({
                            enrollment_id: user.enrollment_id,
                            error: error instanceof Error ? error.message : String(error),
                        });
                    }
                }
            }

            return {
                content: [{ type: "text", text: JSON.stringify({ succeeded, failed }) }],
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
