import { z } from "zod";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";


export const JOB_CSV_MAX_BYTES = 2 * 1024 * 1024;
export const JOB_CSV_MAX_LINKS = 10_000;

export const jobCsvSchema = z.object({
  file: z.file({ error: ERROR_JOBS.CSV_FILE.message })
    .min(1, ERROR_JOBS.CSV_FILE.message)
    .max(JOB_CSV_MAX_BYTES, ERROR_JOBS.CSV_FILE.message)
    .refine((file) => file.name.toLowerCase().endsWith(".csv"), ERROR_JOBS.CSV_FILE.message),
});

export type JobCsvInput = z.infer<typeof jobCsvSchema>;
