"use client";

import { useId } from "react";
import type { JobStatus } from "@prisma/client";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS
} from "@/lib/jobs/status";
import { jobStatusSchema } from "@/lib/schemas/jobs/jobs.schema";


export function JobsFilter({
  status,
  onChange
}: {
  status: JobStatus | undefined;
  onChange: (value?: JobStatus) => void;
}) {
  const id = useId();
  return (
    <div className="w-full space-y-2 sm:max-w-xs">
      <Label htmlFor={id}>Status</Label>
      <Select
        id={id}
        value={status ?? "all"}
        onChange={(event) => {
          onChange(event.target.value === "all" ? undefined : jobStatusSchema.parse(event.target.value));
        }}
      >
        <option value="all">Alle Stellen</option>
        {JOB_STATUSES.map(value => (
          <option
            key={value}
            value={value}
          >
            {JOB_STATUS_LABELS[value]}
          </option>
        ))}
      </Select>
    </div>
  );
}
