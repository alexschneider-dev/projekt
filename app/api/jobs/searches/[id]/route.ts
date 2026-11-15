import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiParams } from "@/lib/http/check-api-params";
import { checkApiRequest } from "@/lib/http/check-api-request";
import {
  jobSearchParamsSchema,
  jobSearchSchema,
} from "@/lib/schemas/jobs/jobs.schema";
import { updateJobSearch } from "@/lib/jobs/searches";


export const PATCH = apiHandler(async (request, context: { params: Promise<{ id: string }> }) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const params = await checkApiParams(await context.params, jobSearchParamsSchema);
  if (!params.ok) return params.response;
  const body = await checkApiRequest(request, jobSearchSchema);
  if (!body.ok) return body.response;

  return successResponse(await updateJobSearch(params.data.id, body.data));
});
