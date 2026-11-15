import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiQuery } from "@/lib/http/check-api-query";
import { jobsQuerySchema } from "@/lib/schemas/jobs/jobs.schema";
import { listJobs } from "@/lib/jobs/list";


export const GET = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const query = await checkApiQuery(request, jobsQuerySchema);
  if (!query.ok) return query.response;

  const result = await listJobs(query.data.page)
  const response = successResponse(result)

  return response;
});
