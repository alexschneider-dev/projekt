import { JobStatus } from "@prisma/client";
import { z } from "zod";
import { jobSearchUrlSchema } from "./search.mjs";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export const jobSearchSchema = z.object({
  title: z.string({ error: ERROR_JOBS.INVALID_TITLE.message })
    .trim().min(1, ERROR_JOBS.INVALID_TITLE.message).max(200, ERROR_JOBS.INVALID_TITLE.message),
  url: z.string({ error: ERROR_JOBS.INVALID_SEARCH_URL.message }).max(4096, ERROR_JOBS.INVALID_SEARCH_URL.message).transform((value, context) => {
    const result = jobSearchUrlSchema.safeParse(value);
    if (result.success) return result.data;

    context.addIssue({
      code: "custom",
      message: ERROR_JOBS.INVALID_SEARCH_URL.message,
    });
    return z.NEVER;
  }),
});

export const jobSearchStatusSchema = z.object({
  active: z.boolean({ error: ERROR_JOBS.INVALID_SEARCH_STATUS.message }),
}).strict();

export const updateJobSearchSchema = z.union([
  jobSearchSchema.strict(),
  jobSearchStatusSchema,
]);

export const jobSearchParamsSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/, ERROR_JOBS.INVALID_SEARCH_ID.message)
    .transform(Number)
    .pipe(z.number().int().max(2_147_483_647, ERROR_JOBS.INVALID_SEARCH_ID.message)),
});

export const jobStatusSchema = z.enum(JobStatus, { error: ERROR_JOBS.INVALID_STATUS.message });

export const jobsQuerySchema = z.object({
  status: jobStatusSchema.optional(),
  page: z.string({ error: ERROR_JOBS.INVALID_PAGE.message }).regex(/^[1-9]\d*$/, ERROR_JOBS.INVALID_PAGE.message)
    .default("1")
    .transform(Number)
    .pipe(z.number().int().max(1_000_000, ERROR_JOBS.INVALID_PAGE.message)),
});

export const updateJobStatusSchema = z.object({
  status: jobStatusSchema,
  id: z.number({ error: ERROR_JOBS.INVALID_ID.message })
    .int(ERROR_JOBS.INVALID_ID.message)
    .min(1, ERROR_JOBS.INVALID_ID.message)
    .max(2_147_483_647, ERROR_JOBS.INVALID_ID.message),
});

export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>;
export type JobSearchInput = z.input<typeof jobSearchSchema>;
export type JobSearchValues = z.output<typeof jobSearchSchema>;
export type JobsQuery = z.output<typeof jobsQuerySchema>;

export type UpdateJobSearchValues = z.output<typeof updateJobSearchSchema>;
