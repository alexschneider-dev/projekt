import { JobStatus } from "@prisma/client";


export const JOB_STATUS_LABELS = {
  [JobStatus.PENDING]: "Pending",
  [JobStatus.BEWORBEN]: "Beworben",
  [JobStatus.NICHT_PASSEND]: "Nicht passend",
  [JobStatus.AUSGELAUFEN]: "Ausgelaufen",
} satisfies Record<JobStatus, string>;

export const JOB_STATUSES = Object.values(JobStatus);
