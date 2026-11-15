"use client";

import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import type {
  JobImportStateResult,
  RequestJobImportResult,
  StopJobImportResult,
} from "@/lib/types/jobs";


export function useJobImport() {
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["job-import"],
    queryFn: ({ signal }) => fetchJson<JobImportStateResult>(ROUTES.jobsImportApi, {
      method: "GET",
      signal,
    }),
    refetchInterval: 5000,
  });
  const mutation = useAppMutation<RequestJobImportResult, void>({
    mutationFn: () => fetchJson(ROUTES.jobsImportApi, { method: "POST" }),
    invalidateKeys: [["job-import"]],
  });
  const stopMutation = useAppMutation<StopJobImportResult, void>({
    mutationFn: () => fetchJson(ROUTES.jobsImportApi, { method: "DELETE" }),
    invalidateKeys: [["job-import"]],
  });
  const finishedAt = query.data?.finishedAt;

  useEffect(() => {
    if (!finishedAt) return;
    void client.invalidateQueries({ queryKey: ["jobs"] });
    void client.invalidateQueries({ queryKey: ["job-searches"] });
  }, [
    client,
    finishedAt,
  ]);

  return {
    query,
    mutation,
    stopMutation,
  };
}
