"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/http/fetch-json";
import { ROUTES } from "@/lib/constants/routes";
import { useAppMutation } from "@/lib/query/use-app-mutation";
import type { JobSearchValues } from "@/lib/schemas/jobs/jobs.schema";
import type {
  CreateJobSearchResult,
  JobsPageResult,
} from "@/lib/types/jobs";
import {
  createPageQueryString,
  createQueryHref,
} from "@/lib/shared/search-params/query-state";


export function useJobsQuery(page: number) {
  return useQuery({
    queryKey: [
      "jobs",
      page,
    ],
    queryFn: ({ signal }) => fetchJson<JobsPageResult>(
      createQueryHref(ROUTES.jobsApi, createPageQueryString("", page)),
      {
        method: "GET",
        signal,
      }
    ),
  });
}

export function useCreateJobSearch() {
  return useAppMutation<CreateJobSearchResult, JobSearchValues>({
    mutationFn: (body) => fetchJson(ROUTES.jobSearchesApi, {
      method: "POST",
      body,
    }),
    invalidateKeys: [["job-searches"]],
  });
}
