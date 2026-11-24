import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { CUSTOMER } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { syncCartSchema } from "@/lib/schemas/cart";
import { syncCart } from "@/lib/cart/service";


export const POST = apiHandler(async (request) => {
  const apiGate = await requireRole(CUSTOMER);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);

  const body = await checkApiRequest(request, syncCartSchema);
  if (!body.ok) return body.response;

  const response = successResponse(await syncCart(apiGate.user.id, body.data.offerIds));
  response.headers.set("Cache-Control", "no-store");

  return response;
});
