"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  jobCsvSchema,
  type JobCsvInput,
} from "@/lib/schemas/jobs/csv.schema";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import type { ApplyJobsCsvResult } from "@/lib/types/jobs";
import { ApiError } from "@/lib/http/api-error";
import { ERROR_API } from "@/lib/http/errors";


export function useJobCsvForm() {
  const form = useForm<JobCsvInput>({ resolver: zodResolver(jobCsvSchema) });
  const mutation = useAppMutation<ApplyJobsCsvResult, JobCsvInput>({
    mutationFn: ({ file }) => {
      const body = new FormData();
      body.append("file", file);
      return fetchJson(ROUTES.jobsCsvApi, {
        method: "POST",
        body,
      });
    },
    invalidateKeys: [["jobs"]],
  });
  const submit = form.handleSubmit(async (values) => {
    form.clearErrors("root");
    mutation.reset();
    try {
      await mutation.mutateAsync(values);
    } catch (error) {
      form.setError("root.server", {
        type: "server",
        message: error instanceof ApiError ? error.message : ERROR_API.INTERNAL_SERVER_ERROR.message,
      });
    }
  });

  return {
    form,
    submit,
    result: mutation.data,
    resetResult: mutation.reset,
    busy: form.formState.isSubmitting,
    ready: form.formState.isReady,
  };
}
