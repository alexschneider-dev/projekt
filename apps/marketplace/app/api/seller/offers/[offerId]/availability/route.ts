import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { SELLER } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { checkApiParams } from "@/lib/http/check-api-params";
import { checkApiRequest } from "@/lib/http/check-api-request";
import {
  offerParamsSchema,
  offerAvailabilitySchema
} from "@/lib/schemas/offer-availability";
import { updateOfferAvailability } from "@/lib/catalog/offer-availability";


export const PATCH = apiHandler(async (request, context: { params: Promise<{ offerId: string }> }) => {
  const apiGate = await requireRole(SELLER);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);

  const params = await checkApiParams(await context.params, offerParamsSchema);
  if (!params.ok) return params.response;

  const body = await checkApiRequest(request, offerAvailabilitySchema);
  if (!body.ok) return body.response;

  const result = await updateOfferAvailability(apiGate.user.id, params.data.offerId, body.data);
  const response = successResponse(result);
  response.headers.set("Cache-Control", "no-store");

  return response;
});
