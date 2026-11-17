import type {
  PrismaClient,
  Prisma
} from "@prisma/client";


type Database = PrismaClient | Prisma.TransactionClient;
type ImportResult = { skipped: true } | {
  skipped: false;
  inserted: number;
  stopped?: boolean;
};
type LockClient = {
  query(query: string, values: number[]): Promise<{ rows: { locked?: boolean }[] }>;
};
export function saveNewUrls(database: Database, urls: string[], userId: string): Promise<number>;
export function importJobs(
  database: Database,
  lockClient: LockClient,
  loadPage: ((url: URL, wait?: unknown, signal?: AbortSignal) => Promise<string>) | undefined,
  userId: string
): Promise<ImportResult>;
