import { z } from "zod";

export const CourseSchema = z.object({
    id: z.number(),
    uuid: z.string(),
    name: z.string(),
    course_code: z.string(),
    workflow_state: z.enum(["unpublished", "available", "completed", "deleted"]),
    created_at: z.string(),
    start_at: z.string().nullable(),
    end_at: z.string().nullable(),
    default_view: z.enum(["feed", "wiki", "modules", "assignments", "syllabus"]),
    enrollment_term_id: z.number(),
    is_public: z.boolean().nullable(),
    grading_standard_id: z.number().nullable(),
    license: z.string().nullable(),
    grade_passback_setting: z.string().nullable(),
    course_color: z.string().nullable(),
    time_zone: z.string().nullable(),
    blueprint: z.boolean().optional(),
    template: z.boolean().optional(),
    total_students: z.number().optional(),
});

export type Course = z.infer<typeof CourseSchema>;
