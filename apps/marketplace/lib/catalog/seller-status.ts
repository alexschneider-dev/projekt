import { prisma } from "@/lib/prisma";
import type { SellerStatusInput } from "@/lib/schemas/seller-status";
import { SELLER } from "@/lib/auth/roles";
import { createApiError } from "@/lib/http/errors";
import { ERROR_SELLERS } from "@/lib/http/errors/sellers";
import {
  lockCatalogStatistics,
  readCatalogStatistics
} from "@/lib/statistics/snapshot";
import { publishCatalogChanged } from "@/lib/statistics/publish";


export async function updateSellerStatus(sellerId: string, input: SellerStatusInput) {
  const snapshot = await prisma.$transaction(async tx => {
    await lockCatalogStatistics(tx);
    // Der Verwaltungsendpunkt verändert nur Verkäuferkonten, keine Administratoren oder Rollen.
    const updated = await tx.user.updateMany({
      where: {
        role: SELLER,
        seller: { id: sellerId }
      },
      data: {
        active: input.active,
        sessionVersion: { increment: 1 }
      }
    });
    if (updated.count !== 1) throw createApiError(ERROR_SELLERS.NOT_FOUND);

    return readCatalogStatistics(tx);
  });
  const realtimeUpdated = await publishCatalogChanged(snapshot);

  return {
    success: true,
    realtimeUpdated
  };
}
