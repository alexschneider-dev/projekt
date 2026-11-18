"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  jobScheduleSchema,
  type JobScheduleValues,
} from "@/lib/schemas/jobs/jobs.schema";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import type { JobImportStateResult } from "@/lib/types/jobs";


export function useJobScheduleForm(scheduleTime: string | null) {
  const [message, setMessage] = useState("");
  const form = useForm<JobScheduleValues>({
    resolver: zodResolver(jobScheduleSchema),
    defaultValues: { scheduleTime },
  });
  const mutation = useAppMutation<JobImportStateResult, JobScheduleValues>({
    mutationFn: values => fetchJson(ROUTES.jobsImportApi, {
      method: "PATCH",
      body: values,
    }),
    invalidateKeys: [["job-import"]],
    fn: { showErrorNotification: false },
  });
  const submit = form.handleSubmit(async values => {
    setMessage("");
    try {
      await mutation.mutateAsync(values);
      form.reset(values);
      setMessage(values.scheduleTime ? "Uhrzeit gespeichert." : "Automatische Suche deaktiviert.");
    } catch (error) {
      form.setError("root.server", {
        message: error instanceof ApiError ? error.message : ERROR_JOBS.SCHEDULE_FAILED.message,
      });
    }
  });

  return {
    form,
    submit,
    message,
    busy: form.formState.isSubmitting,
  };
}
