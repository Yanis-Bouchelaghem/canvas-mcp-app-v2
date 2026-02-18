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
import type { SessionState, KnownUser, KnownUserEnrollment } from "../../server.js";

const DIST_DIR = path.join(import.meta.dirname, "../../dist/src/ui/users");

const ROLE_LABELS: Record<string, string> = {
    StudentEnrollment: "student",
    TeacherEnrollment: "teacher",
    TaEnrollment: "ta",
    DesignerEnrollment: "designer",
    ObserverEnrollment: "observer",
};

export function register(server: McpServer, sessionState: SessionState) {
    server.registerTool(
        "list_users_in_course",
        {
            description: "List all users enrolled in a Canvas course, with their enrollment IDs and roles. Use display_users to show the results visually when you would otherwise write them as text. Each user includes enrollment_id + role pairs needed for unenrolling.",
            inputSchema: {
                course_id: z.number().describe("The Canvas course ID"),
                enrollment_types: z.array(EnrollmentTypeFilterEnum).optional().describe("Filter by enrollment type(s)"),
            },
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        async (args, extra) => {
            try {
                const creds = extractCredentials(extra);
                const users = await canvasClient.getUsersInCourse(
                    creds,
                    args.course_id,
                    { enrollmentTypes: args.enrollment_types, include: ["enrollments", "avatar_url"] }
                );

                const simplified = users.map((user) => {
                    const enrollments = user.enrollments?.map((e) => ({
                        enrollment_id: e.id,
                        role: ROLE_LABELS[e.type] ?? e.type,
                    })) ?? [];
                    return {
                        name: user.name,
                        email: user.email || user.login_id || null,
                        avatar_url: user.avatar_url ?? null,
                        html_url: user.enrollments?.[0]?.html_url ?? null,
                        enrollments,
                    };
                });

                const countRole = (role: string) => simplified.filter((u) => u.enrollments.some((e) => e.role === role)).length;
                const include = args.enrollment_types ?? Object.values(ROLE_LABELS);

                const output: UserListOutput = {
                    users: simplified,
                    ...(include.includes("student") && { student_count: countRole("student") }),
                    ...(include.includes("teacher") && { teacher_count: countRole("teacher") }),
                    ...(include.includes("ta") && { ta_count: countRole("ta") }),
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
        description: "Display users visually in a rich UI. When you would otherwise write the user list as text, use this instead — it displays an interactive UI to the user. Pass the user objects from list_users_in_course directly.",
        annotations: { readOnlyHint: true },
        inputSchema: { users: z.array(UserOutputSchema) },
        _meta: { ui: { resourceUri: listUsersUri } },
    }, async (args) => {
        return { content: [{ type: "text", text: `Displayed ${args.users.length} user(s).` }] };
    });

    server.registerTool(
        "refresh_known_users",
        {
            title: "Refresh known users",
            description: "Indexes all Canvas users across all courses into a session cache. Must be called once before using get_users_info. Caches user IDs, names, emails, and all their enrollments (enrollment IDs, course IDs, roles, states).",
            inputSchema: {},
            annotations: { readOnlyHint: true },
        },
        async (args, extra) => {
            try {
                const creds = extractCredentials(extra);
                const allCourses = await canvasClient.getCourses(creds);
                const knownUsers = new Map<string, KnownUser>();
                for (const course of allCourses) {
                    const users = await canvasClient.getUsersInCourse(creds, course.id, { include: ["email", "enrollments"] });
                    for (const user of users) {
                        let email = user.email || user.login_id;
                        if (email) {
                            email = email.toLowerCase();
                            const newEnrollments: KnownUserEnrollment[] = user.enrollments?.map((e) => ({
                                enrollment_id: e.id,
                                course_id: e.course_id,
                                course_name: course.name,
                                course_code: course.course_code,
                                role: ROLE_LABELS[e.type] ?? e.type,
                                state: e.enrollment_state,
                            })) ?? [];

                            const existing = knownUsers.get(email);
                            if (existing) {
                                existing.enrollments.push(...newEnrollments);
                            } else {
                                knownUsers.set(email, { id: user.id, name: user.name, email, enrollments: newEnrollments });
                            }
                        }
                    }
                }
                sessionState.knownUsers = knownUsers;
                return {
                    content: [{ type: "text", text:  `Indexed ${knownUsers.size} unique users across ${allCourses.length} courses.`}]
                }
            }
            catch (error) {
            return {
                content: [{type: "text", text: error instanceof Error ? error.message : String(error) }],
                isError: true,
            }
            }
        }
    );

    server.registerTool(
        "get_users_info",
        {
            title: "Get users info",
            description: "Look up users by email from the session cache. Returns user IDs, names, and all their enrollments (enrollment_id, course_id, course_name, course_code, role, state). Use this to get user IDs for enroll_users_in_courses, or enrollment IDs and course info for propose_unenroll_users_from_courses — no need to call list_courses separately. Requires refresh_known_users to have been called first.",
            inputSchema: { emails: z.array(z.string()) },
            annotations: { readOnlyHint: true }
        },
        async (args, extra) => {
            if (sessionState.knownUsers == null) {
                return {
                    content: [{type: "text", text: "Call refresh_known_users before using this tool."}],
                    isError: true
                }
            }
            let found: KnownUser[] = [];
            let notFound: string[] = [];
            for (const email of args.emails) {
                const knownUser = sessionState.knownUsers.get(email.toLowerCase());
                if(knownUser) {
                    found.push(knownUser);
                } else {
                    notFound.push(email);
                }
            }
            return {
                content: [{type: "text", text: JSON.stringify({ found, notFound })}]
            }
        }
    )
}
