import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import type { UserListOutput } from "../models/user.js";
import { UserOutputSchema } from "../models/user.js";
import { EnrollmentTypeFilterEnum } from "../models/enrollment.js";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../../dist/src/ui/users")
    : import.meta.dirname;

const ROLE_LABELS: Record<string, string> = {
    StudentEnrollment: "student",
    TeacherEnrollment: "teacher",
    TaEnrollment: "ta",
    DesignerEnrollment: "designer",
    ObserverEnrollment: "observer",
};

export function register(server: McpServer) {
    server.registerTool(
        "list_users_in_course",
        {
            description: "List all users enrolled in a Canvas course, with their roles and enrollment counts per role.",
            inputSchema: {
                course_id: z.number().describe("The Canvas course ID"),
                enrollment_types: z.array(EnrollmentTypeFilterEnum).optional().describe("Filter by enrollment type(s)"),
            },
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        async (args, extra) => {
            try {
                const creds = extractCredentials(extra);
                const users = await canvasClient.getUsersInCourse(creds, args.course_id, args.enrollment_types);

                const simplified = users.map((user) => {
                    const roles = [...new Set(
                        user.enrollments?.map((e) => ROLE_LABELS[e.type] ?? e.type) ?? []
                    )];
                    return {
                        name: user.name,
                        email: user.email ?? user.login_id ?? null,
                        avatar_url: user.avatar_url ?? null,
                        html_url: user.enrollments?.[0]?.html_url ?? null,
                        roles,
                    };
                });

                const countRole = (role: string) => simplified.filter((u) => u.roles.includes(role)).length;
                const include = args.enrollment_types ?? Object.values(ROLE_LABELS);

                const output: UserListOutput = {
                    users: simplified,
                    ...(include.includes("student")  && { student_count:  countRole("student") }),
                    ...(include.includes("teacher")  && { teacher_count:  countRole("teacher") }),
                    ...(include.includes("ta")       && { ta_count:       countRole("ta") }),
                    ...(include.includes("designer") && { designer_count: countRole("designer") }),
                    ...(include.includes("observer") && { observer_count: countRole("observer") }),
                };

                return {
                    content: [{ type: "text", text: JSON.stringify(output) }],
                };
            } catch (error) {
                return {
                    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
                    isError: true,
                };
            }
        }
    );

    const listUsersUri = "ui://canvas-lms/list-users";

    registerAppResource(
        server,
        "List users",
        listUsersUri,
        { mimeType: RESOURCE_MIME_TYPE },
        async () => {
            try {
                const html = await fs.readFile(path.join(DIST_DIR, "list-users.html"), "utf-8");
                return {
                    contents: [{ uri: listUsersUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                };
            } catch (error) {
                console.error("Failed to read UI file:", error);
                throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
            }
        }
    );

    registerAppTool(server, "display_users", {
        title: "Display Users",
        description: "Display a list of users in a visual UI. Takes an array of user objects as input. This usually receives the output of list_users_in_course if you want to display them.",
        annotations: { readOnlyHint: true },
        inputSchema: { users: z.array(UserOutputSchema) },
        _meta: { ui: { resourceUri: listUsersUri } },
    }, async (args) => {
        return { content: [{ type: "text", text: `Displayed ${args.users.length} user(s).` }] };
    });
}
