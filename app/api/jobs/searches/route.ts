import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { jobSearchSchema } from "@/lib/schemas/jobs/jobs.schema";
import { prisma } from "@/lib/prisma";
import { listJobSearches } from "@/lib/jobs/searches";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await listJobSearches());
});

export const POST = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const body = await checkApiRequest(request, jobSearchSchema);
  if (!body.ok) return body.response;

  const result = await prisma.jobSearch.createMany({
    data: [body.data],
    skipDuplicates: true,
  });
  return successResponse({ created: result.count > 0 });
});
