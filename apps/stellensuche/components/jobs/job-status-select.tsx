"use client";

import { Select } from "@/components/ui/select";
import { useUpdateJobStatus } from "@/hooks/jobs/use-jobs-query";
import type { JobLink } from "@/lib/types/jobs";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS
} from "@/lib/jobs/status";
import { jobStatusSchema } from "@/lib/schemas/jobs/jobs.schema";


export function JobStatusSelect({ job }: { job: JobLink }) {
  const mutation = useUpdateJobStatus();
  return (
    <Select
      aria-label="Stellenstatus"
      aria-busy={mutation.isPending}
      disabled={mutation.isPending}
      value={job.status}
      onChange={(event) => mutation.mutate({
        id: job.id,
        status: jobStatusSchema.parse(event.target.value),
      })}
    >
      {JOB_STATUSES.map(value => (
        <option
          key={value}
          value={value}
        >
          {JOB_STATUS_LABELS[value]}
        </option>
      ))}
    </Select>
  );
}
