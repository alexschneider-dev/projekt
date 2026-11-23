import { PrismaClient } from "@prisma/client";
import {
  createApiError,
  ERROR_API
} from "@/lib/http/errors";


const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (url.username !== "marketplace_app" || url.searchParams.get("schema") !== "marketplace") {
    throw createApiError(ERROR_API.INTERNAL_SERVER_ERROR);
  }
}
const globalForPrisma = globalThis as unknown as { marketplacePrisma?: PrismaClient };
export const prisma = globalForPrisma.marketplacePrisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.marketplacePrisma = prisma;
