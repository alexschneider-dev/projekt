import {
  expect,
  it,
  vi
} from "vitest";
import { createDemoProducts } from "@/lib/catalog/demo-products";


const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  attributes: vi.fn(),
  offers: vi.fn(),
  publish: vi.fn()
}));
vi.mock("@/lib/statistics/publish", () => ({ publishCatalogChanged: mocks.publish }));
vi.mock("@/lib/auth/password.mjs", () => ({ hashPassword: async () => "test-hash" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn().mockResolvedValue([{ revision: "1" }]),
      attributeDefinition: {
        findMany: async () => [
          "material",
          "color",
          "kind",
          "model",
          "width",
          "seatHeight"
        ].map(key => ({
          id: `chairs-${key}`,
          key,
          options: [{ label: `DB-${key}` }]
        }))
      },
      user: { upsert: vi.fn() },
      seller: {
        upsert: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
      },
      product: {
        createManyAndReturn: mocks.products,
        count: vi.fn().mockResolvedValue(1000)
      },
      productAttribute: { createMany: mocks.attributes },
      offer: { createMany: mocks.offers }
    })
  }
}));

it("erzeugt pro Aufruf 1.000 neue Produkte mit DB-Stammdaten und zugeordneten Angeboten", async () => {
  let id = 0;
  mocks.products.mockImplementation(async ({ data }: {
    data: {
      slug: string;
      name: string
    }[]
  }) =>
    data.map(product => ({
      ...product,
      id: ++id
    })));

  expect(await createDemoProducts()).toEqual({ created: 1000 });
  expect(await createDemoProducts()).toEqual({ created: 1000 });
  expect(mocks.publish).toHaveBeenCalledTimes(2);
  expect(mocks.publish.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.offers.mock.invocationCallOrder[0]!);
  const first = mocks.products.mock.calls[0]![0].data;
  const second = mocks.products.mock.calls[1]![0].data;
  expect(new Set([
    ...first,
    ...second
  ].map(product => product.slug)).size).toBe(2000);
  expect(first.every((product: { name: string }) => /^DB-kind DB-model [0-9]+$/.test(product.name))).toBe(true);
  expect(mocks.attributes.mock.calls[0]![0].data).toHaveLength(6000);
  expect(mocks.attributes.mock.calls[1]![0].data.every((entry: { productId: number }) => entry.productId > 1000)).toBe(true);
  expect(new Set(mocks.offers.mock.calls[1]![0].data.map((entry: { productId: number }) => entry.productId)).size).toBe(1000);
});

it("veröffentlicht bei einem fehlgeschlagenen Schreibvorgang kein Ereignis", async () => {
  mocks.publish.mockClear();
  mocks.products.mockRejectedValueOnce(new Error());

  await expect(createDemoProducts()).rejects.toThrow();
  expect(mocks.publish).not.toHaveBeenCalled();
});
