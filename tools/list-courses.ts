import type { AppToolDefinition } from "./index.js";

export const listCourses: AppToolDefinition = {
    name: "list_courses",
    title: "List Courses",
    description: "List courses in Canvas LMS",
    inputSchema: {},
    uiFile: "list-courses.html",
    handler: async () => {
        return { content: [{ type: "text", text: "This is a placeholder for the list courses tool." }] };
    },
};
