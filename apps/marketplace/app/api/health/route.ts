import {
  apiHandler,
  successResponse
} from "@/lib/http";
import { prisma } from "@/lib/prisma";


export const dynamic = "force-dynamic";
export const GET = apiHandler(async () => {
  await prisma.$queryRaw`SELECT 1`;
  const response = successResponse({ ready: true });
  response.headers.set("Cache-Control", "no-store");
  return response;
});
