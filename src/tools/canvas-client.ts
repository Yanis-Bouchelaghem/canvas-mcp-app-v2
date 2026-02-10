import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { CourseSchema, type Course } from "../models/course.js";
import { z } from "zod";

export interface CanvasCredentials {
    token: string;
    domain: string;
}

/** Extract Canvas credentials from MCP request headers, falling back to env vars. */
export function extractCredentials(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): CanvasCredentials {
    const token = extra.requestInfo?.headers["authorization"] ?? process.env["CANVAS_TOKEN"];
    const domain = extra.requestInfo?.headers["x-canvas-domain"] ?? process.env["CANVAS_DOMAIN"];

    if (!token || !domain) {
        throw new Error("Missing credentials or domain. Provide headers 'authorization' and 'x-canvas-domain', or set CANVAS_TOKEN and CANVAS_DOMAIN env vars.");
    }

    return { token: String(token), domain: String(domain) };
}

class CanvasClient {
    private async request(creds: CanvasCredentials, method: string, path: string, params?: Record<string, string>, body?: unknown): Promise<unknown> {
        const url = new URL(`${creds.domain}/api/v1${path}`);
        if (params) url.search = new URLSearchParams(params).toString();
        const response = await fetch(url, {
            method,
            headers: {
                Authorization: creds.token,
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }).catch(() => {
            throw new Error(`Could not reach ${creds.domain}, are you sure this is the right domain?`);
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Canvas API error ${response.status}: ${text}`);
        }

        return response.json();
    }

    async getCourses(creds: CanvasCredentials): Promise<Course[]> {
        const data = await this.request(creds, "GET", "/courses", { "include[]": "total_students" });
        return z.array(CourseSchema).parse(data);
    }
}

export const canvasClient = new CanvasClient();
