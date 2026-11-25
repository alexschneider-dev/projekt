import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { checkApiParams } from "@/lib/http/check-api-params";
import { checkApiRequest } from "@/lib/http/check-api-request";
import {
  sellerParamsSchema,
  sellerStatusSchema
} from "@/lib/schemas/seller-status";
import { updateSellerStatus } from "@/lib/catalog/seller-status";


export const PATCH = apiHandler(async (request, context: { params: Promise<{ sellerId: string }> }) => {
  const apiGate = await requireRole(SUPER_ADMIN);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);

  const params = await checkApiParams(await context.params, sellerParamsSchema);
  if (!params.ok) return params.response;

  const body = await checkApiRequest(request, sellerStatusSchema);
  if (!body.ok) return body.response;

  const result = await updateSellerStatus(params.data.sellerId, body.data);
  const response = successResponse(result);
  response.headers.set("Cache-Control", "no-store");

  return response;
});
