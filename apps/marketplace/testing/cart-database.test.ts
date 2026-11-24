import { randomUUID } from "node:crypto";
import {
  afterAll,
  describe,
  expect,
  it
} from "vitest";
import { prisma } from "@/lib/prisma";
import {
  addToCart,
  getCart,
  removeFromCart
} from "@/lib/cart/service";
import { CUSTOMER } from "@/lib/auth/roles";
import { ERROR_CART } from "@/lib/http/errors/cart";


const enabled = process.env.MARKETPLACE_TEST_DATABASE === "true";
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (enabled && (!url || ![
  "localhost",
  "127.0.0.1"
].includes(url.hostname) || url.port !== "55439")) {
  throw new Error("Die Integrationstests benötigen die isolierte lokale Testdatenbank an Port 55439.");
}
const userIds = [
  `cart-test-${randomUUID()}`,
  `cart-test-${randomUUID()}`
];

describe.skipIf(!enabled)("Warenkorb in PostgreSQL", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  it("begrenzt parallele Zugriffe, verhindert Duplikate und trennt Benutzer", async () => {
    await prisma.user.createMany({
      data: userIds.map((id) => ({
        id,
        email: `${id}@example.invalid`,
        passwordHash: "kein-anmeldefaehiger-hash",
        role: CUSTOMER
      }))
    });
    const offers = await prisma.offer.findMany({
      where: {
        active: true,
        stock: { gt: 0 },
        product: { published: true }
      },
      distinct: ["productId"],
      orderBy: { id: "asc" },
      take: 12,
    });
    expect(offers).toHaveLength(12);

    const results = await Promise.allSettled(offers.map((offer) => addToCart(userIds[0]!, offer.id)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    for (const result of results) {
      if (result.status === "rejected") expect(result.reason.code).toBe(ERROR_CART.FULL.code);
    }
    const cart = await getCart(userIds[0]!);
    expect(cart.items).toHaveLength(10);
    expect(new Set(cart.items.map((item) => item.productId)).size).toBe(10);
    expect((await addToCart(userIds[0]!, cart.items[0]!.offer.id)).items).toHaveLength(10);

    expect((await getCart(userIds[1]!)).items).toHaveLength(0);
    await removeFromCart(userIds[1]!, cart.items[0]!.productId);
    expect((await getCart(userIds[0]!)).items).toHaveLength(10);
    expect((await addToCart(userIds[1]!, cart.items[0]!.offer.id)).items).toHaveLength(1);

    const extra = offers.find((offer) => !cart.items.some((item) => item.productId === offer.productId))!;
    await expect(prisma.$executeRaw`
      INSERT INTO "CartItem" ("userId", "productId", "offerId", slot)
      VALUES (${userIds[0]!}, ${extra.productId}, ${extra.id}, 11)
    `).rejects.toMatchObject({
      code: "P2010",
      meta: { code: "23514" }
    });

    await removeFromCart(userIds[0]!, cart.items[0]!.productId);
    expect((await addToCart(userIds[0]!, extra.id)).items).toHaveLength(10);
  }, 20000);
});
