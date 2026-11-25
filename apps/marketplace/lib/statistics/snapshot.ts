import { SELLER } from "@/lib/auth/roles";
import type { Prisma } from "@prisma/client";


// Alle relevanten Schreibvorgänge nehmen vor ihrer ersten Änderung dieselbe Transaktionssperre.
export async function lockCatalogStatistics(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(724001)::text AS lock`;
}

export async function readCatalogStatistics(tx: Prisma.TransactionClient) {
  const products = await tx.product.count({
    where: {
      published: true,
      offers: {
        some: {
          active: true,
          stock: { gt: 0 }
        }
      }
    }
  });
  const sellers = await tx.seller.count({
    where: {
      user: {
        active: true,
        role: SELLER
      }
    }
  });
  const [transaction] = await tx.$queryRaw<{ revision: string }[]>`SELECT txid_current()::text AS revision`;

  return {
    version: 1 as const,
    available: true as const,
    products,
    sellers,
    revision: transaction!.revision
  };
}
