import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { SELLER } from "@/lib/auth/roles";
import { listSellerOffers } from "@/lib/catalog/service";


export const GET = apiHandler(async () => {
  const apiGate = await requireRole(SELLER);
  if (!apiGate.ok) return apiGate.response;
  const response = successResponse(await listSellerOffers(apiGate.user.id));
  response.headers.set("Cache-Control", "no-store");
  return response;
});
