import { z } from "zod";
import { jobSearchUrlSchema } from "./search.mjs";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export const jobSearchSchema = z.object({
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

export const jobsQuerySchema = z.object({
  page: z.string({ error: ERROR_JOBS.INVALID_PAGE.message }).regex(/^[1-9]\d*$/, ERROR_JOBS.INVALID_PAGE.message)
    .default("1")
    .transform(Number)
    .pipe(z.number().int().max(1_000_000, ERROR_JOBS.INVALID_PAGE.message)),
});

export type JobSearchInput = z.input<typeof jobSearchSchema>;
export type JobSearchValues = z.output<typeof jobSearchSchema>;
export type JobsQuery = z.output<typeof jobsQuerySchema>;
