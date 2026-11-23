import {
  PrismaClient,
  InternalRole,
  AttributeKind
} from "@prisma/client";
import { randomBytes } from "node:crypto";
import { hashPassword } from "../lib/auth/password.mjs";
import {
  databaseGuard,
  positiveInteger,
  reportFailure
} from "./common.mjs";


const db = new PrismaClient();
const materials = [
  "Holz",
  "Metall",
  "Kunststoff",
  "Polster"
];
const colors = [
  "Natur",
  "Schwarz",
  "Weiß",
  "Grau",
  "Grün"
];
const kinds = [
  "Esszimmerstuhl",
  "Bürostuhl",
  "Loungestuhl",
  "Barhocker"
];
const names = [
  "Linie",
  "Kontur",
  "Bogen",
  "Form",
  "Raum",
  "Weitblick",
  "Morgen",
  "Nord"
];
const definitions = [
  {
    key: "material",
    label: "Material",
    kind: AttributeKind.TEXT,
  },
  {
    key: "color",
    label: "Farbe",
    kind: AttributeKind.TEXT,
  },
  {
    key: "kind",
    label: "Stuhltyp",
    kind: AttributeKind.TEXT,
  },
  {
    key: "width",
    label: "Breite",
    kind: AttributeKind.NUMBER,
    unit: "cm",
  },
  {
    key: "seatHeight",
    label: "Sitzhöhe",
    kind: AttributeKind.NUMBER,
    unit: "cm",
  },
];

try {
  databaseGuard();
  const total = positiveInteger(process.argv[2], 120, 10000000);
  const start = positiveInteger(process.argv[3], 1, total);
  await db.category.upsert({
    where: { id: "chairs" },
    create: {
      id: "chairs",
      slug: "stuehle",
      name: "Stühle",
    },
    update: {},
  });
  for (const definition of definitions) {
    await db.attributeDefinition.upsert({
      where: { id: `chairs-${definition.key}` },
      create: {
        ...definition,
        id: `chairs-${definition.key}`,
        categoryId: "chairs",
      },
      update: {},
    });
  }
  const passwordHash = await hashPassword(randomBytes(32).toString("hex"));
  for (let index = 0;index < 12;index++) {
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
  const images = await db.imageAsset.findMany({
    orderBy: { id: "asc" },
    take: 10000,
  });
  for (let offset = start;offset <= total;offset += 500) {
    const products = [];
    const attributes = [];
    const offers = [];
    for (let id = offset;id < Math.min(offset + 500, total + 1);id++) {
      const random = Math.imul(id, 2654435761) >>> 0;
      const image = images.length ? images[random % images.length] : null;
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
        width: 42 + (random % 24),
        seatHeight: kind === "Barhocker" ? 75 : 43 + (random % 8),
      })) {
        attributes.push({
          productId: id,
          categoryId: "chairs",
          attributeId: `chairs-${key}`,
          ...(typeof value === "number" ? { numberValue: value } : { textValue: value }),
        });
      }
      for (let offer = 0;offer <= random % 3;offer++) {
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
