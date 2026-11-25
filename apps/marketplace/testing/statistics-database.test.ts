import {
  afterAll,
  describe,
  expect,
  it
} from "vitest";
import Redis from "ioredis";
import { prisma } from "@/lib/prisma";
import { updateOfferAvailability } from "@/lib/catalog/offer-availability";
import { updateSellerStatus } from "@/lib/catalog/seller-status";
import { SELLER } from "@/lib/auth/roles";
import { STATISTICS_KEY } from "@/services/websocket/protocol.mjs";


// Dieser Test schreibt ausschließlich in die eigene isolierte Container-Datenbank.
const enabled = process.env.DATABASE_URL
  === "postgresql://marketplace_app:isolated-websocket-app@127.0.0.1:55441/postgres?schema=marketplace"
  && process.env.REDIS_URL === "redis://127.0.0.1:56381";

describe.skipIf(!enabled)("Verfügbarkeit und Redis-Snapshot in echten Diensten", () => {
  let redis: Redis;

  afterAll(async () => {
    redis?.disconnect();
    await prisma.$disconnect();
  });

  it("zählt eindeutige Produkte und aktive Verkäufer, trennt Benutzer und verarbeitet parallele Änderungen", async () => {
    redis = new Redis(process.env.REDIS_URL!);
    await redis.del(STATISTICS_KEY);
    await prisma.offer.deleteMany();
    await prisma.product.deleteMany();
    await prisma.seller.deleteMany();
    await prisma.user.deleteMany();
    await prisma.category.upsert({
      where: { id: "test" },
      create: {
        id: "test",
        slug: "test",
        name: "Test"
      },
      update: {}
    });
    for (const id of [
      "eins",
      "zwei"
    ]) {
      await prisma.user.create({
        data: {
          id,
          email: `${id}@example.invalid`,
          passwordHash: "kein-anmeldefaehiger-hash",
          role: SELLER,
          seller: {
            create: {
              id,
              name: id,
              slug: id
            }
          }
        }
      });
    }
    const product = await prisma.product.create({
      data: {
        slug: "test",
        name: "Testprodukt",
        description: "Test",
        categoryId: "test"
      }
    });
    for (const id of [
      "eins",
      "zwei"
    ]) {
      await prisma.offer.create({
        data: {
          id,
          sellerId: id,
          productId: product.id,
          priceCents: 100,
          stock: 2
        }
      });
    }

    expect(await updateOfferAvailability("eins", "eins", {
      active: true,
      stock: 3
    })).toMatchObject({ realtimeUpdated: true });
    expect(JSON.parse((await redis.get(STATISTICS_KEY))!)).toMatchObject({
      products: 1,
      sellers: 2
    });
    await expect(updateOfferAvailability("eins", "zwei", {
      active: false,
      stock: 0
    })).rejects.toMatchObject({ code: "OFFER_NOT_FOUND" });

    await Promise.all([
      "eins",
      "zwei"
    ].map(id => updateOfferAvailability(id, id, {
      active: true,
      stock: 0
    })));
    expect(JSON.parse((await redis.get(STATISTICS_KEY))!)).toMatchObject({ products: 0 });

    await updateSellerStatus("zwei", { active: false });
    expect(JSON.parse((await redis.get(STATISTICS_KEY))!)).toMatchObject({ sellers: 1 });
    expect(await prisma.user.findUnique({ where: { id: "zwei" } })).toMatchObject({ sessionVersion: 1 });
    await updateSellerStatus("zwei", { active: true });
    expect(JSON.parse((await redis.get(STATISTICS_KEY))!)).toMatchObject({ sellers: 2 });
  });
});
