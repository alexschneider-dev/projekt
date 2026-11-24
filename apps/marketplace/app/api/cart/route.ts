import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { CUSTOMER } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { checkApiRequest } from "@/lib/http/check-api-request";
import { addToCartSchema } from "@/lib/schemas/cart";
import {
  getCart,
  addToCart
} from "@/lib/cart/service";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole(CUSTOMER);
  if (!apiGate.ok) return apiGate.response;

  const response = successResponse(await getCart(apiGate.user.id));
  response.headers.set("Cache-Control", "no-store");

  return response;
});

export const POST = apiHandler(async (request) => {
  const apiGate = await requireRole(CUSTOMER);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);

  const body = await checkApiRequest(request, addToCartSchema);
  if (!body.ok) return body.response;

  const response = successResponse(await addToCart(apiGate.user.id, body.data.offerId));
  response.headers.set("Cache-Control", "no-store");

  return response;
});
