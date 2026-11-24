import {
  randomBytes,
  randomUUID
} from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password.mjs";
import { SELLER } from "@/lib/auth/roles";
import { createApiError } from "@/lib/http/errors";
import { ERROR_DEMO_PRODUCTS } from "@/lib/http/errors/demo-products";


export async function createDemoProducts() {
  const batchId = randomUUID();
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  return prisma.$transaction(async tx => {
    // Parallele Aufrufe serialisieren; jeder Aufruf erzeugt eine eigene Produktserie.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(724001)::text AS lock`;
    const definitions = await tx.attributeDefinition.findMany({
      where: { categoryId: "chairs" },
      include: {
        options: {
          where: { active: true },
          orderBy: { id: "asc" }
        }
      }
    });
    const byKey = new Map(definitions.map(definition => [
      definition.key,
      definition
    ]));
    const values = (key: string) => {
      const options = byKey.get(key)?.options;
      if (!options?.length) throw createApiError(ERROR_DEMO_PRODUCTS.MASTER_DATA);
      return options.map(option => option.label);
    };
    const materials = values("material");
    const colors = values("color");
    const kinds = values("kind");
    const names = values("model");
    if (!byKey.has("width") || !byKey.has("seatHeight")) throw createApiError(ERROR_DEMO_PRODUCTS.MASTER_DATA);

    for (let index = 0; index < 12; index++) {
      const id = `demo-seller-${index}`;
      await tx.user.upsert({
        where: { id },
        create: {
          id,
          email: `${id}@example.invalid`,
          name: `Wohnstudio ${index + 1}`,
          passwordHash,
          role: SELLER,
          active: false
        },
        update: {}
      });
      await tx.seller.upsert({
        where: { id },
        create: {
          id,
          userId: id,
          name: `Wohnstudio ${index + 1}`,
          slug: id
        },
        update: {}
      });
    }

    const products = Array.from({ length: 1000 }, (_, index) => {
      const number = index + 1;
      const random = Math.imul(number, 2654435761) >>> 0;
      const material = materials[random % materials.length];
      const color = colors[Math.floor(random / 7) % colors.length];
      const kind = kinds[Math.floor(random / 13) % kinds.length];
      return {
        slug: `demo-stuhl-${batchId}-${number}`,
        name: `${kind} ${names[number % names.length]} ${number}`,
        description: `${kind} in ${color} aus ${material}. Ein fiktives Produkt unseres Demo-Marktplatzes.`,
        categoryId: "chairs",
      };
    });
    const created = await tx.product.createManyAndReturn({
      data: products
    });
    const attributes: Prisma.ProductAttributeCreateManyInput[] = [];
    const offers: Prisma.OfferCreateManyInput[] = [];
    for (const product of created) {
      const number = Number(product.slug.split("-").at(-1));
      const random = Math.imul(number, 2654435761) >>> 0;
      const kind = kinds[Math.floor(random / 13) % kinds.length];
      const properties = {
        material: materials[random % materials.length],
        color: colors[Math.floor(random / 7) % colors.length],
        kind,
        model: names[number % names.length],
        width: 42 + (random % 24),
        seatHeight: kind === "Barhocker" ? 75 : 43 + (random % 8),
      };
      for (const [
        key,
        value
      ] of Object.entries(properties)) {
        attributes.push({
          productId: product.id,
          categoryId: "chairs",
          attributeId: byKey.get(key)!.id,
          ...(typeof value === "number" ? { numberValue: value } : { textValue: value! })
        });
      }
      for (let index = 0; index <= random % 3; index++) {
        offers.push({
          id: `demo-${product.id}-${index}`,
          productId: product.id,
          sellerId: `demo-seller-${(number + index) % 12}`,
          priceCents: 3900 + random % 60000 + index * 700,
          stock: (random + index) % 40,
          deliveryDays: 2 + (random + index) % 8
        });
      }
    }
    await tx.productAttribute.createMany({ data: attributes });
    await tx.offer.createMany({ data: offers });

    return {
      created: created.length
    };
  }, {
    timeout: 30000,
    maxWait: 5000
  });
}
