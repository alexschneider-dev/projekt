import type {
  PrismaClient,
  Prisma
} from "@prisma/client";


type Database = PrismaClient | Prisma.TransactionClient;
export const USER_SEARCH_LIMIT: 1;
export const USER_JOB_LIMIT: 100;
export function createSearch(database: Database, data: {
  url: string;
  title?: string
}, userId: string): Promise<number>;
export function userLimits(database: Database, userId: string): Promise<{
  searches: number;
  jobs: number
}>;
export function remainingJobCapacity(database: Database, userId: string): Promise<number>;
