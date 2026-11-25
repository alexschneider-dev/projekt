import { prisma } from "@/lib/prisma";
import type { OfferAvailabilityInput } from "@/lib/schemas/offer-availability";
import { createApiError } from "@/lib/http/errors";
import { ERROR_OFFERS } from "@/lib/http/errors/offers";
import {
  lockCatalogStatistics,
  readCatalogStatistics
} from "@/lib/statistics/snapshot";
import { publishCatalogChanged } from "@/lib/statistics/publish";


export async function updateOfferAvailability(userId: string, offerId: string, input: OfferAvailabilityInput) {
  const snapshot = await prisma.$transaction(async tx => {
    await lockCatalogStatistics(tx);
    const updated = await tx.offer.updateMany({
      where: {
        id: offerId,
        seller: { userId }
      },
      data: input
    });
    if (updated.count !== 1) throw createApiError(ERROR_OFFERS.NOT_FOUND);

    return readCatalogStatistics(tx);
  });
  const realtimeUpdated = await publishCatalogChanged(snapshot);

  return {
    success: true,
    realtimeUpdated
  };
}
