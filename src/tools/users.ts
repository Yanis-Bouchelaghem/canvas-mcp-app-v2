import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { canvasClient, extractCredentials } from "./canvas-client.js";
import type { UserListOutput } from "../models/user.js";
import { EnrollmentTypeFilterEnum } from "../models/enrollment.js";
import { z } from "zod";

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
                enrollment_type: EnrollmentTypeFilterEnum.optional().describe("Filter by enrollment type"),
            },
            annotations: { readOnlyHint: true, openWorldHint: true },
        },
        async (args, extra) => {
            try {
                const creds = extractCredentials(extra);
                const users = await canvasClient.getUsersInCourse(creds, args.course_id, args.enrollment_type);

                const output: UserListOutput = {
                    users: [],
                    student_count: 0,
                    teacher_count: 0,
                    ta_count: 0,
                    designer_count: 0,
                    observer_count: 0,
                };

                for (const user of users) {
                    const roles = [...new Set(
                        user.enrollments?.map((e) => ROLE_LABELS[e.type] ?? e.type) ?? []
                    )];
                    for (const role of roles) {
                        const key = `${role}_count` as keyof typeof output;
                        if (key in output) (output[key] as number)++;
                    }
                    output.users.push({
                        name: user.name,
                        email: user.email ?? user.login_id ?? null,
                        roles,
                    });
                }

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
}
