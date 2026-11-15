"use client";

import { Button } from "@/components/ui/button";
import { useMarkJob } from "@/hooks/jobs/use-jobs-query";
import type { JobLink } from "@/lib/types/jobs";


export function MarkJobButton({ job }: { job: JobLink }) {
  const mutation = useMarkJob();
  const marked = job.isMarkiert || mutation.data?.isMarkiert;

  return (
    <Button
      variant="outline"
      disabled={marked || mutation.isPending}
      onClick={() => mutation.mutate({ id: job.id })}
    >
      {marked ? "Markiert" : mutation.isPending ? "Wird markiert …" : "Markieren"}
    </Button>
  );
}
