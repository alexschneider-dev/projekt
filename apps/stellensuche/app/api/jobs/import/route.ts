import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import {
  getJobImportState,
  requestJobImport,
  stopJobImport,
  updateJobSchedule,
} from "@/lib/jobs/import-state";

import { checkApiRequest } from "@/lib/http/check-api-request";
import { jobScheduleSchema } from "@/lib/schemas/jobs/jobs.schema";

export const GET = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await getJobImportState(apiGate.user.id));
});

export const POST = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await requestJobImport(apiGate.user.id));
});

export const DELETE = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await stopJobImport(apiGate.user.id));
});

export const PATCH = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const body = await checkApiRequest(request, jobScheduleSchema);
  if (!body.ok) return body.response;

  return successResponse(await updateJobSchedule(apiGate.user.id, body.data.scheduleTime));
});
