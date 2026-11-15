"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  jobSearchSchema,
  type JobSearchInput,
  type JobSearchValues,
} from "@/lib/schemas/jobs/jobs.schema";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { ApiError } from "@/lib/http/api-error";
import {
  useCreateJobSearch,
  useUpdateJobSearch,
} from "./use-jobs-query";
import type { JobSearchesResult } from "@/lib/types/jobs";


export function useJobSearchForm(search?: JobSearchesResult[number]) {
  const [message, setMessage] = useState("");
  const router = useRouter();
  const mutation = useCreateJobSearch();
  const updateMutation = useUpdateJobSearch();
  const form = useForm<JobSearchInput, unknown, JobSearchValues>({
    resolver: zodResolver(jobSearchSchema),
    defaultValues: {
      title: search?.title ?? "",
      url: search?.url ?? "",
    },
  });
  const submit = form.handleSubmit(async (values) => {
    setMessage("");
    try {
      if (search) {
        await updateMutation.mutateAsync({
          id: search.id,
          ...values,
        });
        form.reset(values);
        setMessage("Suche gespeichert.");
        router.refresh();
        return;
      }

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
    ready: form.formState.isReady,
    busy: form.formState.isSubmitting,
  };
}
