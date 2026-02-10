import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { CourseSchema, type Course } from "../models/course.js";
import { UserSchema, type User } from "../models/user.js";
import type { EnrollmentTypeFilter } from "../models/enrollment.js";
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
    /** Core fetch wrapper: builds URL, sends request, throws on network/HTTP errors. */
    private async request(creds: CanvasCredentials, method: string, url: URL | string, body?: unknown): Promise<Response> {
        const response: Response = await fetch(url, {
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

        return response;
    }

    private getNextPageURL(response: Response): string | null {
        return response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] ?? null;
    }

    /** GET a paginated endpoint, following Link rel="next" until all pages are fetched. */
    private async requestAll(creds: CanvasCredentials, path: string, params?: Record<string, string>): Promise<unknown[]> {
        const url = new URL(`${creds.domain}/api/v1${path}`);
        url.search = new URLSearchParams({ per_page: "100", ...params }).toString();

        const results: unknown[] = [];
        let next: string | null = url.toString();

        while (next) {
            const response = await this.request(creds, "GET", next);
            const data: unknown = await response.json();
            results.push(...(Array.isArray(data) ? data : [data]));

            next = this.getNextPageURL(response);
        }

        return results;
    }

    async getCourses(creds: CanvasCredentials): Promise<Course[]> {
        const data = await this.requestAll(creds, "/courses", { "include[]": "total_students" });
        return z.array(CourseSchema).parse(data);
    }

    async getUsersInCourse(creds: CanvasCredentials, courseId: number, enrollmentType?: EnrollmentTypeFilter): Promise<User[]> {
        const queryParameters: Record<string, string> = { "include[]": "enrollments" };
        if (enrollmentType) queryParameters["enrollment_type[]"] = enrollmentType;
        const data = await this.requestAll(creds, `/courses/${courseId}/users`, queryParameters);
        return z.array(UserSchema).parse(data);
    }
}

export const canvasClient = new CanvasClient();
