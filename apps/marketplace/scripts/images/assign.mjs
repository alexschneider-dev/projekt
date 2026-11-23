import { PrismaClient } from "@prisma/client";
import {
  databaseGuard,
  reportFailure
} from "../common.mjs";


const db = new PrismaClient();
try {
  databaseGuard();
  const images = await db.imageAsset.findMany({
    orderBy: { id: "asc" },
    take: 10000,
  });
  // Nur bildlose Demoprodukte mit passenden sichtbaren Eigenschaften ergänzen.
  const groups = new Map();
  for (const image of images) {
    const key = JSON.stringify([
      image.material,
      image.color,
      image.kind
    ]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(image);
  }
  for (const group of groups.values()) {
    const first = group[0];
    for (let index = 0;index < group.length;index++) {
      const count = await db.$executeRaw`
        UPDATE "Product" p SET "imageId" = ${group[index].id}
        WHERE p."imageId" IS NULL AND p."categoryId" = 'chairs'
          AND p.slug = 'stuhl-' || p.id::text AND p.id % ${group.length} = ${index}
          AND EXISTS (SELECT 1 FROM "ProductAttribute" a WHERE a."productId" = p.id AND a."attributeId" = 'chairs-material' AND a."textValue" = ${first.material})
          AND EXISTS (SELECT 1 FROM "ProductAttribute" a WHERE a."productId" = p.id AND a."attributeId" = 'chairs-color' AND a."textValue" = ${first.color})
          AND EXISTS (SELECT 1 FROM "ProductAttribute" a WHERE a."productId" = p.id AND a."attributeId" = 'chairs-kind' AND a."textValue" = ${first.kind})
      `;
      console.log(
        JSON.stringify({
          ereignis: "bilder_zugeordnet",
          anzahl: count,
        }),
      );
    }
  }
} catch (error) {
  reportFailure(error);
} finally {
  await db.$disconnect();
}
