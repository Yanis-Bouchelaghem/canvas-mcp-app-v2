import { z } from "zod";

export const EnrollmentType = z.enum([
    "StudentEnrollment",
    "TeacherEnrollment",
    "TaEnrollment",
    "DesignerEnrollment",
    "ObserverEnrollment",
]);

export const EnrollmentSchema = z.object({
    id: z.number(),
    course_id: z.number(),
    type: EnrollmentType,
    enrollment_state: z.enum(["active", "invited", "inactive", "completed", "deleted", "creation_pending"]),
    role: z.string(),
});

export type Enrollment = z.infer<typeof EnrollmentSchema>;
