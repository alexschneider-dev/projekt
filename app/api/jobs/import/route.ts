import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import {
  getJobImportState,
  requestJobImport,
  stopJobImport,
} from "@/lib/jobs/import-state";


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
