import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { checkApiQuery } from "@/lib/http/check-api-query";
import { catalogSchema } from "@/lib/schemas/catalog";
import { listProducts } from "@/lib/catalog/service";


export const GET = apiHandler(async (request) => {
  const query = await checkApiQuery(request, catalogSchema);
  if (!query.ok) return query.response;
  return successResponse(await listProducts(query.data));
});
