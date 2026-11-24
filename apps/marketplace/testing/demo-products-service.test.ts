import {
  expect,
  it,
  vi
} from "vitest";
import { createDemoProducts } from "@/lib/catalog/demo-products";


const mocks = vi.hoisted(() => ({
  products: vi.fn(),
  attributes: vi.fn(),
  offers: vi.fn()
}));
vi.mock("@/lib/auth/password.mjs", () => ({ hashPassword: async () => "test-hash" }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: async (callback: (tx: unknown) => unknown) => callback({
      $queryRaw: vi.fn().mockResolvedValue([]),
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
      seller: { upsert: vi.fn() },
      product: { createManyAndReturn: mocks.products },
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
