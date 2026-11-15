import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import {
  getJobImportState,
  requestJobImport,
} from "@/lib/jobs/import-state";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await getJobImportState());
});

export const POST = apiHandler(async () => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  return successResponse(await requestJobImport());
});
