import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerCourseTools } from "./src/tools/courses.js";
import { register as registerUserTools } from "./src/tools/users.js";
import { register as registerEnrollmentTools } from "./src/tools/enrollments.js";

export interface KnownUserEnrollment {
    enrollment_id: number;
    course_id: number;
    course_name: string;
    course_code: string;
    role: string;
    state: string;
}

export interface KnownUser {
    id: number;
    name: string;
    email: string;
    enrollments: KnownUserEnrollment[];
}

export interface SessionState {
    knownUsers: Map<string, KnownUser> | null;
}

export function createServer(): McpServer {
    const server = new McpServer({
        name: "Canvas LMS MCP App",
        version: "1.0.0",
        description: `Canvas LMS management tools. When you would otherwise write data as text in your response (e.g. a list of courses or users), prefer using the display tools (display_courses, display_users) to show it visually instead.

Typical workflows:
- Listing: list_courses → display_courses, list_users_in_course → display_users
- Enrolling: Use get_users_info to get user IDs + list_courses to get course IDs/names, then call enroll_users_in_courses with both IDs and display fields (user_emails, course_names).
- Unenrolling: Use get_users_info to get enrollment IDs, course IDs, and course names per user, then call propose_unenroll_users_from_courses with full details (course names, user names/emails, enrollment IDs, action). No need to call list_courses separately.
- Looking up users by email: refresh_known_users (once per session) → get_users_info. This returns user IDs, names, and all their enrollments (enrollment IDs, course IDs, course names, course codes, roles, states).`,
    });

    const sessionState: SessionState = { knownUsers: null };
    registerCourseTools(server);
    registerUserTools(server, sessionState);
    registerEnrollmentTools(server, sessionState);

    return server;
}
