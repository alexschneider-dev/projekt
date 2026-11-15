import { JobSearches } from "@/components/jobs/job-searches";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";


export default async function JobSearchesPage() {
  const apiGate = await requireRole();
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  return <JobSearches />;
}
