import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { register as registerCourseTools } from "./src/tools/courses.js";
import { register as registerUserTools } from "./src/tools/users.js";
import { register as registerEnrollmentTools } from "./src/tools/enrollments.js";

export interface KnownUserEnrollment {
    enrollment_id: number;
    course_id: number;
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
    });

    const sessionState: SessionState = { knownUsers: null };
    registerCourseTools(server);
    registerUserTools(server, sessionState);
    registerEnrollmentTools(server, sessionState);

    return server;
}
