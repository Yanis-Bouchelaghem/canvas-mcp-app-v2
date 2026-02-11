import { z } from "zod";

export const EnrollmentTypeEnum = z.enum([
    "StudentEnrollment",
    "TeacherEnrollment",
    "TaEnrollment",
    "DesignerEnrollment",
    "ObserverEnrollment",
]);

export const EnrollmentSchema = z.object({
    id: z.number(),
    course_id: z.number(),
    type: EnrollmentTypeEnum,
    enrollment_state: z.enum(["active", "invited", "inactive", "completed", "deleted", "creation_pending"]),
    role: z.string(),
    html_url: z.string(),
});

export const EnrollmentTypeFilterEnum = z.enum([
    "teacher", "student", "student_view", "ta", "observer", "designer",
]);

export type Enrollment = z.infer<typeof EnrollmentSchema>;
export type EnrollmentTypeFilter = z.infer<typeof EnrollmentTypeFilterEnum>;
