import { QueryProvider } from "@/components/ui/query-provider";
import { JobSearchesContent } from "./job-searches-content";


export function JobSearches() {
  return (
    <QueryProvider>
      <JobSearchesContent />
    </QueryProvider>
  );
}
