"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  jobSearchSchema,
  type JobSearchInput,
  type JobSearchValues,
} from "@/lib/schemas/jobs/jobs.schema";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { ApiError } from "@/lib/http/api-error";
import { useCreateJobSearch } from "./use-jobs-query";


export function useJobSearchForm() {
  const [message, setMessage] = useState("");
  const mutation = useCreateJobSearch();
  const form = useForm<JobSearchInput, unknown, JobSearchValues>({
    resolver: zodResolver(jobSearchSchema),
    defaultValues: { url: "" },
  });
  const submit = form.handleSubmit(async (values) => {
    setMessage("");
    try {
      const result = await mutation.mutateAsync(values);
      form.reset();
      setMessage(result.created
        ? "Such-URL gespeichert. Sie wird beim nächsten Import berücksichtigt."
        : "Diese Such-URL ist bereits gespeichert und wurde unverändert belassen.");
    } catch (error) {
      form.setError("root.server", {
        type: "server",
        message: error instanceof ApiError ? error.message : ERROR_JOBS.SAVE_FAILED.message,
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
