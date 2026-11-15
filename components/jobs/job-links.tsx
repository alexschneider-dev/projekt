import { Suspense } from "react";
import { QueryProvider } from "@/components/ui/query-provider";
import { Text } from "@/components/ui/text";
import { JobsContent } from "./jobs-content";


export function JobLinks() {
  return (
    <QueryProvider>
      <Suspense fallback={<Text>Stellen werden geladen …</Text>}>
        <JobsContent />
      </Suspense>
    </QueryProvider>
  );
}
