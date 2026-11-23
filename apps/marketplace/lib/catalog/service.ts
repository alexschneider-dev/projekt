import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PAGE_SIZE } from "./config";
import type { CatalogFilters } from "@/lib/schemas/catalog";


export const productInclude = {
  image: true,
  category: true,
  attributes: { include: { definition: true } },
  offers: {
    where: { active: true },
    orderBy: { priceCents: "asc" },
    include: {
      seller: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
  },
} satisfies Prisma.ProductInclude;
export type CatalogProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export async function listProducts(filters: CatalogFilters) {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`p."published" = true`,
    Prisma.sql`p."categoryId" = 'chairs'`
  ];
  if (filters.q) clauses.push(Prisma.sql`p."name" ILIKE ${`%${filters.q.replace(/[\\%_]/g, "\\$&")}%`}`);
  for (const key of [
    "material",
    "color",
    "kind"
  ] as const) {
    if (filters[key])
      clauses.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "ProductAttribute" a WHERE a."productId" = p.id
      AND a."attributeId" = ${`chairs-${key}`} AND a."textValue" = ${filters[key]}
    )`);
  }
  const order =
    filters.sort === "priceAsc"
      ? Prisma.sql`price ASC, p.id DESC`
      : filters.sort === "priceDesc"
        ? Prisma.sql`price DESC, p.id DESC`
        : Prisma.sql`p.id DESC`;
  const minimum = filters.min * 100;
  const maximum = filters.max ? filters.max * 100 : 2147483647;
  // Die Preisgrenze bezieht sich auf das günstigste aktive Angebot, wie auf der Produktkarte.
  const rows = await prisma.$queryRaw<{ id: number }[]>(Prisma.sql`
    SELECT p.id FROM "Product" p
    JOIN LATERAL (SELECT MIN(o."priceCents") AS price FROM "Offer" o
      WHERE o."productId" = p.id AND o.active = true) prices ON true
    WHERE ${Prisma.join(clauses, " AND ")} AND price BETWEEN ${minimum} AND ${maximum}
    ORDER BY ${order} LIMIT ${PAGE_SIZE + 1} OFFSET ${(filters.page - 1) * PAGE_SIZE}
  `);
  const ids = rows.slice(0, PAGE_SIZE).map((row) => row.id);
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: productInclude,
  });
  const byId = new Map(products.map((product) => [
    product.id,
    product
  ]));
  return {
    items: ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : [])),
    hasNext: rows.length > PAGE_SIZE,
    page: filters.page,
  };
}

export function getProduct(slug: string) {
  return prisma.product.findFirst({
    where: {
      slug,
      published: true,
    },
    include: productInclude,
  });
}

export function listSellerOffers(userId: string) {
  return prisma.offer.findMany({
    where: { seller: { userId } },
    include: {
      product: {
        select: {
          name: true,
          slug: true,
        },
      },
    },
    orderBy: { id: "asc" },
    take: 100,
  });
}

export type ProductsPage = Awaited<ReturnType<typeof listProducts>>;
export type SellerOffers = Awaited<ReturnType<typeof listSellerOffers>>;
