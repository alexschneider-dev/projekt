import {
  describe,
  it,
  expect,
  afterAll
} from "vitest";
import { prisma } from "@/lib/prisma";
import {
  listProducts,
  listSellerOffers
} from "@/lib/catalog/service";
import { catalogSchema } from "@/lib/schemas/catalog";


const enabled = process.env.MARKETPLACE_TEST_DATABASE === "true";
const url = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
if (enabled && (!url || ![
  "localhost",
  "127.0.0.1"
].includes(url.hostname) || url.port !== "55439")) {
  throw new Error("Die Integrationstests benötigen die isolierte lokale Testdatenbank an Port 55439.");
}

describe.skipIf(!enabled)("Isolierte Marketplace-Datenbank", () => {
  afterAll(async () => prisma.$disconnect());
  it("filtert und sortiert nach dem günstigsten Angebot", async () => {
    const page = await listProducts(
      catalogSchema.parse({
        material: "Holz",
        sort: "priceAsc",
        min: 40,
        max: 500,
      }),
    );
    expect(page.items.length).toBeGreaterThan(0);
    let previous = 0;
    for (const product of page.items) {
      expect(product.attributes.some((attribute) => attribute.textValue === "Holz")).toBe(true);
      const price = product.offers[0]!.priceCents;
      expect(price).toBeGreaterThanOrEqual(4000);
      expect(price).toBeLessThanOrEqual(50000);
      expect(price).toBeGreaterThanOrEqual(previous);
      previous = price;
    }
  });
  it("liefert nur Angebote des geprüften Benutzers", async () => {
    const offers = await listSellerOffers("demo-seller-1");
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((offer) => offer.sellerId === "demo-seller-1")).toBe(true);
    expect(await listSellerOffers("unbekannt")).toEqual([]);
  });
  it("verweigert Zugriff auf das fremde Anwendungsschema", async () => {
    await expect(prisma.$queryRawUnsafe("SELECT * FROM stellensuche.private_test")).rejects.toThrow();
  });
  it("verhindert negative Preise und mehrere Eigenschaftswerte", async () => {
    await expect(
      prisma.offer.update({
        where: { id: "demo-1-0" },
        data: { priceCents: -1 },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.productAttribute.update({
        where: {
          productId_attributeId: {
            productId: 1,
            attributeId: "chairs-color",
          },
        },
        data: { numberValue: 123 },
      }),
    ).rejects.toThrow();
  });
});
