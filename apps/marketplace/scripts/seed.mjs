import {
  PrismaClient,
  InternalRole
} from "@prisma/client";
import { ERRORS } from "./errors/index.mjs";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/auth/password.mjs";
import {
  databaseGuard,
  positiveInteger,
  reportFailure
} from "./common.mjs";


const db = new PrismaClient();
try {
  databaseGuard();
  const total = positiveInteger(process.argv[2], 120, 10000000);
  const start = positiveInteger(process.argv[3], 1, total);
  const definitions = await db.attributeDefinition.findMany({
    where: { categoryId: "chairs" },
    include: {
      options: {
        where: { active: true },
        orderBy: { id: "asc" },
      },
    },
  });
  const byKey = new Map(definitions.map((definition) => [
    definition.key,
    definition
  ]));
  const values = (key) => {
    const options = byKey.get(key)?.options;
    if (!options?.length) throw new Error(ERRORS.MASTER_DATA);
    return options.map((option) => option.label);
  };
  const materials = values("material");
  const colors = values("color");
  const kinds = values("kind");
  const names = values("model");
  if (!byKey.has("width") || !byKey.has("seatHeight")) throw new Error(ERRORS.MASTER_DATA);
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  for (let index = 0; index < 12; index++) {
    const id = `demo-seller-${index}`;
    await db.user.upsert({
      where: { id },
      create: {
        id,
        email: `${id}@example.invalid`,
        name: `Wohnstudio ${index + 1}`,
        passwordHash,
        role: InternalRole.SELLER,
        active: false,
      },
      update: {},
    });
    await db.seller.upsert({
      where: { id },
      create: {
        id,
        userId: id,
        name: `Wohnstudio ${index + 1}`,
        slug: id,
      },
      update: {},
    });
  }
  const images = process.env.SEED_WITHOUT_IMAGES === "true" ? [] : await db.imageAsset.findMany({
    orderBy: { id: "asc" },
    take: 10000,
  });
  const matchingImages = images.filter((image) =>
    materials.includes(image.material) && colors.includes(image.color) && kinds.includes(image.kind),
  );
  for (let offset = start; offset <= total; offset += 500) {
    const products = [];
    const attributes = [];
    const offers = [];
    for (let id = offset; id < Math.min(offset + 500, total + 1); id++) {
      const random = Math.imul(id, 2654435761) >>> 0;
      const image = matchingImages.length ? matchingImages[random % matchingImages.length] : null;
      const material = image?.material ?? materials[random % materials.length];
      const color = image?.color ?? colors[Math.floor(random / 7) % colors.length];
      const kind = image?.kind ?? kinds[Math.floor(random / 13) % kinds.length];
      products.push({
        id,
        slug: `stuhl-${id}`,
        name: `${kind} ${names[id % names.length]} ${id}`,
        description: `${kind} in ${color} aus ${material}. Ein fiktives Produkt unseres Demo-Marktplatzes zum Vergleichen von Materialien und Verkäuferangeboten.`,
        categoryId: "chairs",
        imageId: image?.id ?? null,
      });
      for (const [
        key,
        value
      ] of Object.entries({
        material,
        color,
        kind,
        model: names[id % names.length],
        width: 42 + (random % 24),
        seatHeight: kind === "Barhocker" ? 75 : 43 + (random % 8),
      })) {
        attributes.push({
          productId: id,
          categoryId: "chairs",
          attributeId: byKey.get(key).id,
          ...(typeof value === "number" ? { numberValue: value } : { textValue: value }),
        });
      }
      for (let offer = 0; offer <= random % 3; offer++) {
        offers.push({
          id: `demo-${id}-${offer}`,
          productId: id,
          sellerId: `demo-seller-${(id + offer) % 12}`,
          priceCents: 3900 + (random % 60000) + offer * 700,
          stock: (random + offer) % 40,
          deliveryDays: 2 + ((random + offer) % 8),
        });
      }
    }
    await db.$transaction(
      async (tx) => {
        await tx.product.createMany({
          data: products,
          skipDuplicates: true,
        });
        await tx.productAttribute.createMany({
          data: attributes,
          skipDuplicates: true,
        });
        await tx.offer.createMany({
          data: offers,
          skipDuplicates: true,
        });
      },
      { timeout: 60000 },
    );
    console.log(
      JSON.stringify({
        ereignis: "produkte_angelegt",
        bis: Math.min(offset + 499, total),
        ziel: total,
      }),
    );
  }
  await db.$executeRaw`SELECT setval(pg_get_serial_sequence('"Product"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 10000000) FROM "Product"), 10000000))`;
} catch (error) {
  reportFailure(error);
} finally {
  await db.$disconnect();
}
