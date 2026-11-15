import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/api-guard";
import { redirectAfterAccessDenied } from "@/lib/auth/access";
import { jobSearchParamsSchema } from "@/lib/schemas/jobs/jobs.schema";
import { getJobSearch } from "@/lib/jobs/searches";
import { JobSearchDetails } from "@/components/jobs/job-search-details";


export default async function JobSearchPage({ params }: { params: Promise<{ id: string }> }) {
  const apiGate = await requireRole();
  if (!apiGate.ok) redirectAfterAccessDenied(apiGate.response);

  const parsed = jobSearchParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  const search = await getJobSearch(apiGate.user.id, parsed.data.id);
  if (!search) notFound();

  return <JobSearchDetails search={search} />;
}
