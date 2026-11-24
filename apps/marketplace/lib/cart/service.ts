import { productSlug } from "@/lib/catalog/product-slug";
import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/http/api-error";
import { prisma } from "@/lib/prisma";
import {
  createApiError,
  ERROR_AUTH
} from "@/lib/http/errors";
import { ERROR_CART } from "@/lib/http/errors/cart";
import { CART_LIMIT } from "./config";


export async function getCart(userId: string, db: Pick<Prisma.TransactionClient, "cartItem"> = prisma) {
  const rows = await db.cartItem.findMany({
    where: { userId },
    orderBy: { slot: "asc" },
    select: {
      productId: true,
      offer: {
        select: {
          id: true,
          priceCents: true,
          stock: true,
          active: true,
          seller: { select: { name: true } },
          product: {
            select: {
              id: true,
              attributes: { include: { definition: true } },
              name: true,
              slug: true,
              published: true,
              image: true
            },
          },
        },
      },
    },
  });

  const items = rows.map(item => ({
    productId: item.productId,
    offer: {
      ...item.offer,
      product: {
        name: item.offer.product.name,
        slug: productSlug(item.offer.product),
        published: item.offer.product.published,
        image: item.offer.product.image
      }
    }
  }));

  return {
    items,
    limit: CART_LIMIT,
    totalCents: items.reduce((sum, item) => sum + item.offer.priceCents, 0),
  };
}

async function lockCustomer(tx: Prisma.TransactionClient, userId: string) {
  // Alle Änderungen desselben Warenkorbs werden vor dem Zählen serialisiert.
  const users = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "User" WHERE id = ${userId} AND active = true FOR UPDATE
  `;
  if (!users.length) throw createApiError(ERROR_AUTH.UNAUTHORIZED);
}

async function insertOffer(tx: Prisma.TransactionClient, userId: string, offerId: string) {
  const offer = await tx.offer.findUnique({
    where: { id: offerId },
    select: {
      productId: true,
      active: true,
      stock: true,
      product: { select: { published: true } }
    },
  });
  if (!offer || !offer.active || offer.stock < 1 || !offer.product.published) {
    throw createApiError(ERROR_CART.UNAVAILABLE);
  }

  const existing = await tx.cartItem.findUnique({
    where: {
      userId_productId: {
        userId,
        productId: offer.productId
      }
    },
  });
  // Wiederholte Klicks legen weder Mengen noch weitere Verkäuferpositionen an.
  if (existing) return;

  const used = await tx.cartItem.findMany({
    where: { userId },
    select: { slot: true }
  });
  const occupied = new Set(used.map((item) => item.slot));
  let slot = 1;
  while (occupied.has(slot) && slot <= CART_LIMIT) slot++;
  if (slot > CART_LIMIT) throw createApiError(ERROR_CART.FULL);

  await tx.cartItem.create({
    data: {
      userId,
      productId: offer.productId,
      offerId,
      slot
    }
  });

}

export async function addToCart(userId: string, offerId: string) {
  return prisma.$transaction(async (tx) => {
    await lockCustomer(tx, userId);
    await insertOffer(tx, userId, offerId);

    return getCart(userId, tx);
  }, {
    maxWait: 10000,
    timeout: 10000
  });
}

export async function syncCart(userId: string, offerIds: string[]) {
  return prisma.$transaction(async (tx) => {
    await lockCustomer(tx, userId);

    const skipped: {
      offerId: string;
      reason: "full" | "unavailable"
    }[] = [];
    for (const offerId of offerIds) {
      try {
        await insertOffer(tx, userId, offerId);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.code !== ERROR_CART.FULL.code && error.code !== ERROR_CART.UNAVAILABLE.code) throw error;
        skipped.push({
          offerId,
          reason: error.code === ERROR_CART.FULL.code ? "full" : "unavailable"
        });
      }
    }

    return {
      cart: await getCart(userId, tx),
      skipped
    };
  }, {
    maxWait: 10000,
    timeout: 10000
  });
}

export async function removeFromCart(userId: string, productId: number) {
  return prisma.$transaction(async (tx) => {
    await lockCustomer(tx, userId);
    await tx.cartItem.deleteMany({
      where: {
        userId,
        productId
      }
    });

    return getCart(userId, tx);
  });
}

export type Cart = Awaited<ReturnType<typeof getCart>>;

export type CartSync = Awaited<ReturnType<typeof syncCart>>;
