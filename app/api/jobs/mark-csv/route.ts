import { requireRole } from "@/lib/auth/api-guard";
import {
  apiHandler,
  successResponse,
} from "@/lib/http";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { jobCsvSchema } from "@/lib/schemas/jobs/csv.schema";
import { markJobsFromCsv } from "@/lib/jobs/mark-csv";


export const POST = apiHandler(async (request) => {
  const apiGate = await requireRole();
  if (!apiGate.ok) return apiGate.response;

  const body = await checkApiRequest(request, jobCsvSchema, true);
  if (!body.ok) return body.response;

  return successResponse(await markJobsFromCsv(await body.data.file.text()));
});
