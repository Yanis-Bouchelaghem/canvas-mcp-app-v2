import { z } from "zod";
import { EnrollmentSchema } from "./enrollment.js";

export const UserSchema = z.object({
    id: z.number(),
    name: z.string(),
    short_name: z.string(),
    sortable_name: z.string(),
    login_id: z.string().optional(),
    email: z.string().optional(),
    enrollments: z.array(EnrollmentSchema).optional(),
});

export type User = z.infer<typeof UserSchema>;

export const UserOutputSchema = z.object({
    name: z.string(),
    email: z.string().nullable(),
    roles: z.array(z.string()),
});

export const UserListOutputSchema = z.object({
    users: z.array(UserOutputSchema),
    student_count: z.number(),
    teacher_count: z.number(),
    ta_count: z.number(),
    designer_count: z.number(),
    observer_count: z.number(),
});

export type UserListOutput = z.infer<typeof UserListOutputSchema>;
