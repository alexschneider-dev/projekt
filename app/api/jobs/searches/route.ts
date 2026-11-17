import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { jobSearchSchema } from "@/lib/schemas/jobs/jobs.schema";
import { prisma } from "@/lib/prisma";
import { createSearch } from "@/scripts/jobs/limits.mjs";
import { createApiError } from "@/lib/http/errors";
import { ERROR_JOBS } from "@/lib/http/errors/jobs";
import { listJobSearches } from "@/lib/jobs/searches";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await listJobSearches(apiGate.user.id));
});

export const POST = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const body = await checkApiRequest(request, jobSearchSchema);
  if (!body.ok) return body.response;

  try {
    const count = await createSearch(prisma, body.data, apiGate.user.id);
    return successResponse({ created: count > 0 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "SEARCH_LIMIT") {
      throw createApiError(ERROR_JOBS.SEARCH_LIMIT);
    }
    throw error;
  }
});
