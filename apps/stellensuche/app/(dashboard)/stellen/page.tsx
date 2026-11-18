import { JobLinks } from "@/components/jobs/job-links";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";


export default async function JobsPage() {
  const apiGate = await requireRole();
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  return <JobLinks />;
}
