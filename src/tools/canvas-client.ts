import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { CourseSchema, type Course } from "../models/course.js";
import { z } from "zod";

export interface CanvasCredentials {
    token: string;
    domain: string;
}

/** Extract Canvas credentials from MCP request headers. Throws if missing. */
export function extractCredentials(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): CanvasCredentials {
    const token = extra.requestInfo?.headers["authorization"];
    const domain = extra.requestInfo?.headers["x-canvas-domain"];

    if (!token || !domain) {
        throw new Error("Missing credentials or domain. Ask the user to ensure they have properly configured the MCP with headers 'authorization' and 'x-canvas-domain'.");
    }

    return { token: String(token), domain: String(domain) };
}

class CanvasClient {
    private async request(creds: CanvasCredentials, method: string, path: string, body?: unknown): Promise<unknown> {
        const response = await fetch(`${creds.domain}/api/v1${path}`, {
            method,
            headers: {
                Authorization: creds.token,
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Canvas API error ${response.status}: ${text}`);
        }

        return response.json();
    }

    async getCourses(creds: CanvasCredentials): Promise<Course[]> {
        const data = await this.request(creds, "GET", "/courses");
        return z.array(CourseSchema).parse(data);
    }
}

export const canvasClient = new CanvasClient();
