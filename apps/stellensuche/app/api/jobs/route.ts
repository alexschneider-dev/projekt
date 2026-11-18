import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiQuery } from "@/lib/http/check-api-query";
import {
  jobsQuerySchema,
  updateJobStatusSchema,
} from "@/lib/schemas/jobs/jobs.schema";
import { listJobs } from "@/lib/jobs/list";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { prisma } from "@/lib/prisma";
import { JOB_LINK_SELECT } from "@/lib/jobs/select";


export const GET = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const query = await checkApiQuery(request, jobsQuerySchema);
  if (!query.ok) return query.response;

  const result = await listJobs(apiGate.user.id, query.data.page, query.data.status);
  const response = successResponse(result);

  return response;
});

export const PATCH = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const body = await checkApiRequest(request, updateJobStatusSchema);
  if (!body.ok) return body.response;

  const result = await prisma.jobListing.update({
    where: {
      id: body.data.id,
      userId: apiGate.user.id,
    },
    data: { status: body.data.status },
    select: JOB_LINK_SELECT,
  });
  return successResponse(result);
});
