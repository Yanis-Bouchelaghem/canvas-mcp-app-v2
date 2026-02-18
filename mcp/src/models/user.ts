import { z } from "zod";
import { EnrollmentSchema } from "./enrollment.js";

export const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    short_name: z.string(),
    sortable_name: z.string(),
    login_id: z.string().optional(),
    email: z.string().optional(),
    avatar_url: z.string().optional(),
    enrollments: z.array(EnrollmentSchema).optional(),
});

export type User = z.infer<typeof UserSchema>;

export const UserEnrollmentOutputSchema = z.object({
    enrollment_id: z.number(),
    role: z.string(),
});

export const UserOutputSchema = z.object({
    name: z.string(),
    email: z.string().nullable(),
    avatar_url: z.string().nullable(),
    html_url: z.string().nullable(),
    enrollments: z.array(UserEnrollmentOutputSchema),
});

export type UserOutput = z.infer<typeof UserOutputSchema>;

export const UserListOutputSchema = z.object({
    users: z.array(UserOutputSchema),
    student_count: z.number().optional(),
    teacher_count: z.number().optional(),
    ta_count: z.number().optional(),
    designer_count: z.number().optional(),
    observer_count: z.number().optional(),
});

export type UserListOutput = z.infer<typeof UserListOutputSchema>;
