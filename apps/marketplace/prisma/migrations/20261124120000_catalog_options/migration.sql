BEGIN;

-- Stammdaten statt fest eingebauter Auswahlwerte. Bestehende Texte bleiben erhalten.
CREATE TABLE "AttributeOption" (
  "id" TEXT NOT NULL,
  "attributeId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AttributeOption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttributeOption_label_valid" CHECK (length(trim("label")) BETWEEN 1 AND 80)
);
CREATE UNIQUE INDEX "AttributeOption_attributeId_label_key" ON "AttributeOption"("attributeId", "label");
CREATE INDEX "AttributeOption_attributeId_active_label_idx" ON "AttributeOption"("attributeId", "active", "label");
ALTER TABLE "AttributeOption" ADD CONSTRAINT "AttributeOption_attributeId_fkey"
  FOREIGN KEY ("attributeId") REFERENCES "AttributeDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Category" ("id", "slug", "name") VALUES ('chairs', 'stuehle', 'Stühle') ON CONFLICT DO NOTHING;
INSERT INTO "AttributeDefinition" ("id", "categoryId", "key", "label", "kind", "unit", "filterable") VALUES
  ('chairs-material', 'chairs', 'material', 'Material', 'TEXT', NULL, true),
  ('chairs-color', 'chairs', 'color', 'Farbe', 'TEXT', NULL, true),
  ('chairs-kind', 'chairs', 'kind', 'Stuhltyp', 'TEXT', NULL, true),
  ('chairs-model', 'chairs', 'model', 'Modellname', 'TEXT', NULL, false),
  ('chairs-width', 'chairs', 'width', 'Breite', 'NUMBER', 'cm', true),
  ('chairs-seatHeight', 'chairs', 'seatHeight', 'Sitzhöhe', 'NUMBER', 'cm', true)
ON CONFLICT ("categoryId", "key") DO NOTHING;

INSERT INTO "AttributeOption" ("id", "attributeId", "label")
SELECT 'bestand-' || md5("attributeId" || ':' || "textValue"), "attributeId", "textValue"
FROM "ProductAttribute" WHERE "textValue" IS NOT NULL
GROUP BY "attributeId", "textValue";

-- Eine Umbenennung aktualisiert alle Produktzuordnungen atomar; Löschen ist gesperrt.
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeId_textValue_fkey"
  FOREIGN KEY ("attributeId", "textValue") REFERENCES "AttributeOption"("attributeId", "label")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
