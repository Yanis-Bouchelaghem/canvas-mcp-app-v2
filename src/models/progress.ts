import { z } from "zod";

export const ProgressSchema = z.object({
    id: z.number(),
    completion: z.number().nullable(),
    workflow_state: z.enum(["queued", "running", "completed", "failed"]),
    message: z.string().nullable().optional(),
    url: z.string(),
});

export type Progress = z.infer<typeof ProgressSchema>;
