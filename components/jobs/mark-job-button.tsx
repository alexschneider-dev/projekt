"use client";

import { Button } from "@/components/ui/button";
import { useMarkJob } from "@/hooks/jobs/use-jobs-query";
import type { JobLink } from "@/lib/types/jobs";


export function MarkJobButton({ job }: { job: JobLink }) {
  const mutation = useMarkJob();
  const marked = job.isMarkiert;

  return (
    <Button
      variant="outline"
      disabled={mutation.isPending}
      aria-pressed={marked}
      onClick={() => mutation.mutate({
        id: job.id,
        isMarkiert: !marked,
      })}
    >
      {mutation.isPending ? "Wird gespeichert …" : marked ? "Markierung aufheben" : "Markieren"}
    </Button>
  );
}
