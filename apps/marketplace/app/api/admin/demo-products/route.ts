import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { requireRole } from "@/lib/auth/api-guard";
import { SUPER_ADMIN } from "@/lib/auth/roles";
import { checkOrigin } from "@/lib/http/check-origin";
import { createDemoProducts } from "@/lib/catalog/demo-products";


export const POST = apiHandler(async request => {
  const apiGate = await requireRole(SUPER_ADMIN);
  if (!apiGate.ok) return apiGate.response;

  checkOrigin(request);
  const response = successResponse(await createDemoProducts());
  response.headers.set("Cache-Control", "no-store");
  return response;
});
