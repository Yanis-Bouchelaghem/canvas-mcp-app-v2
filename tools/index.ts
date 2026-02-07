import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { listCourses } from "./list-courses.js";

export interface AppToolDefinition {
    name: string;
    title: string;
    description: string;
    inputSchema: Record<string, unknown>;
    uiFile: string;
    handler: (args: Record<string, unknown>) => Promise<CallToolResult>;
}

const DIST_DIR = import.meta.filename.endsWith(".ts")
    ? path.join(import.meta.dirname, "../dist/ui")
    : import.meta.dirname;

const tools: AppToolDefinition[] = [listCourses];

export function registerAllTools(server: McpServer) {
    for (const tool of tools) {
        const resourceUri = `ui://canvas-lms/${tool.name.replaceAll("_", "-")}`;

        registerAppResource(
            server,
            tool.title,
            resourceUri,
            { mimeType: RESOURCE_MIME_TYPE },
            async () => {
                try {
                    const html = await fs.readFile(path.join(DIST_DIR, tool.uiFile), "utf-8");
                    return {
                        contents: [{ uri: resourceUri, mimeType: RESOURCE_MIME_TYPE, text: html }],
                    };
                }
                catch (error) {
                    console.error(`Failed to read UI file for ${tool.name}:`, error);
                    throw new McpError(ErrorCode.InternalError, "UI resource unavailable.");
                }
            }
        );

        registerAppTool(server, tool.name, {
            title: tool.title,
            description: tool.description,
            inputSchema: tool.inputSchema,
            _meta: { ui: { resourceUri } },
        }, tool.handler);
    }
}
