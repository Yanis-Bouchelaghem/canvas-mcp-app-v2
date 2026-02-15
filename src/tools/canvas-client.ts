import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerRequest, ServerNotification } from "@modelcontextprotocol/sdk/types.js";
import { CourseSchema, type Course } from "../models/course.js";
import { UserSchema, type User } from "../models/user.js";
import { ProgressSchema, type Progress } from "../models/progress.js";
import type { EnrollmentTypeFilter } from "../models/enrollment.js";
import { z } from "zod";

export interface CanvasCredentials {
    token: string;
    domain: string;
    isAdmin: boolean;
}

/** Extract Canvas credentials from MCP request headers, falling back to env vars. */
export function extractCredentials(extra: RequestHandlerExtra<ServerRequest, ServerNotification>): CanvasCredentials {
    const token = extra.requestInfo?.headers["authorization"] ?? process.env["CANVAS_TOKEN"];
    const domain = extra.requestInfo?.headers["x-canvas-domain"] ?? process.env["CANVAS_DOMAIN"];

    if (!token || !domain) {
        throw new Error("Missing credentials or domain. Provide headers 'authorization' and 'x-canvas-domain', or set CANVAS_TOKEN and CANVAS_DOMAIN env vars.");
    }

    const noAdmin = extra.requestInfo?.headers["x-canvas-no-admin"] ?? process.env["CANVAS_NO_ADMIN"];
    return { token: String(token), domain: String(domain), isAdmin: !noAdmin };
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
    private async requestAll(creds: CanvasCredentials, path: string, params?: Record<string, string | string[]>): Promise<unknown[]> {
        const url = new URL(`${creds.domain}/api/v1${path}`);
        const searchParams = new URLSearchParams({ per_page: "100" });
        for (const [key, value] of Object.entries(params ?? {})) {
            for (const v of Array.isArray(value) ? value : [value]) {
                searchParams.append(key, v);
            }
        }
        url.search = searchParams.toString();

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

    async getUsersInCourse(creds: CanvasCredentials, courseId: number, options?: { enrollmentTypes?: EnrollmentTypeFilter[], include?: string[]}): Promise<User[]> {
        const queryParameters: Record<string, string | string[]> = {};
        if (options?.include) queryParameters["include[]"] = options?.include
        if (options?.enrollmentTypes?.length) queryParameters["enrollment_type[]"] = options?.enrollmentTypes;
        const data = await this.requestAll(creds, `/courses/${courseId}/users`, queryParameters);
        return z.array(UserSchema).parse(data);
    }

    async bulkEnroll(creds: CanvasCredentials, userIds: number[], courseIds: number[], enrollmentType?: string): Promise<Progress> {
        const url = `${creds.domain}/api/v1/accounts/self/bulk_enrollment`;
        const body: Record<string, unknown> = { user_ids: userIds, course_ids: courseIds };
        if (enrollmentType) body.enrollment_type = enrollmentType;
        const response = await this.request(creds, "POST", url, body);
        return ProgressSchema.parse(await response.json());
    }

    async getProgress(creds: CanvasCredentials, progressId: number): Promise<Progress> {
        const url = `${creds.domain}/api/v1/progress/${progressId}`;
        const response = await this.request(creds, "GET", url);
        return ProgressSchema.parse(await response.json());
    }
}

export const canvasClient = new CanvasClient();
