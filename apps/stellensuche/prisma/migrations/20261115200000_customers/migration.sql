-- Bestehende Daten und Benutzer gehören zum bisherigen gemeinsamen Kunden.
CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
INSERT INTO "Customer" ("id", "name") VALUES ('existing-customer', 'Bestandskunde');

ALTER TABLE "User" ADD COLUMN "customerId" TEXT;
ALTER TABLE "JobListing" ADD COLUMN "customerId" TEXT;
ALTER TABLE "JobSearch" ADD COLUMN "customerId" TEXT;
ALTER TABLE "JobImportState" ADD COLUMN "customerId" TEXT;
UPDATE "User" SET "customerId" = 'existing-customer';
UPDATE "JobListing" SET "customerId" = 'existing-customer';
UPDATE "JobSearch" SET "customerId" = 'existing-customer';
UPDATE "JobImportState" SET "customerId" = 'existing-customer';
ALTER TABLE "User" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "JobListing" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "JobSearch" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "JobImportState" ALTER COLUMN "customerId" SET NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobSearch" ADD CONSTRAINT "JobSearch_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobImportState" ADD CONSTRAINT "JobImportState_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP INDEX "JobListing_url_key";
DROP INDEX "JobSearch_url_key";
DROP INDEX "JobListing_createdAt_id_idx";
CREATE UNIQUE INDEX "JobListing_customerId_url_key" ON "JobListing"("customerId", "url");
CREATE UNIQUE INDEX "JobSearch_customerId_url_key" ON "JobSearch"("customerId", "url");
CREATE UNIQUE INDEX "JobImportState_customerId_key" ON "JobImportState"("customerId");
CREATE INDEX "JobListing_customerId_createdAt_id_idx" ON "JobListing"("customerId", "createdAt", "id");
CREATE SEQUENCE "JobImportState_id_seq";
SELECT setval('"JobImportState_id_seq"', COALESCE((SELECT MAX("id") FROM "JobImportState"), 0) + 1, false);
ALTER TABLE "JobImportState" ALTER COLUMN "id" SET DEFAULT nextval('"JobImportState_id_seq"');
ALTER SEQUENCE "JobImportState_id_seq" OWNED BY "JobImportState"."id";

-- Die bisherige Zwischenrolle erhält Benutzerrechte, keine Observability-Rechte.
UPDATE "User" SET "role" = 'USER', "sessionVersion" = "sessionVersion" + 1 WHERE "role" = 'ADMIN';
ALTER TYPE "InternalRole" RENAME TO "InternalRole_old";
CREATE TYPE "InternalRole" AS ENUM ('USER', 'SUPER_ADMIN');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "InternalRole" USING ("role"::text::"InternalRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'USER';
DROP TYPE "InternalRole_old";
