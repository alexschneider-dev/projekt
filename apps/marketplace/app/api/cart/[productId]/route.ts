import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { CUSTOMER } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { checkApiParams } from "@/lib/http/check-api-params";
import { cartItemParamsSchema } from "@/lib/schemas/cart";
import { removeFromCart } from "@/lib/cart/service";


export const DELETE = apiHandler(async (request, context: { params: Promise<{ productId: string }> }) => {
  const apiGate = await requireRole(CUSTOMER);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);

  const params = await checkApiParams(await context.params, cartItemParamsSchema);
  if (!params.ok) return params.response;

  const response = successResponse(await removeFromCart(apiGate.user.id, params.data.productId));
  response.headers.set("Cache-Control", "no-store");

  return response;
});
