"use client";

import { Button } from "@/components/ui/button";
import { useUpdateJobSearch } from "@/hooks/jobs/use-jobs-query";
import type { JobSearchesResult } from "@/lib/types/jobs";


export function JobSearchStatusButton({ search }: { search: JobSearchesResult[number] }) {
  const mutation = useUpdateJobSearch();

  return (
    <Button
      variant="outline"
      disabled={mutation.isPending}
      aria-pressed={search.active}
      onClick={() => mutation.mutate({
        id: search.id,
        active: !search.active,
      })}
    >
      {mutation.isPending ? "Wird gespeichert …" : search.active ? "Deaktivieren" : "Aktivieren"}
    </Button>
  );
}
