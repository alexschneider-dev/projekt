BEGIN;

-- Nur für Bestandsdaten ohne Benutzer einen deaktivierten Besitzer erhalten.
INSERT INTO "User" ("id", "email", "name", "passwordHash", "role", "active", "updatedAt", "customerId")
SELECT 'legacy-owner-' || c."id", 'legacy-owner-' || c."id" || '@migration.invalid',
       'Deaktivierter Bestandsbesitzer', '', 'USER', false, CURRENT_TIMESTAMP, c."id"
FROM "Customer" c
WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u."customerId" = c."id")
  AND (EXISTS (SELECT 1 FROM "JobSearch" s WHERE s."customerId" = c."id")
    OR EXISTS (SELECT 1 FROM "JobListing" j WHERE j."customerId" = c."id")
    OR EXISTS (SELECT 1 FROM "JobImportState" i WHERE i."customerId" = c."id"));

-- Der bisherige Super-Admin erhält die Bestandsdaten; andernfalls der älteste Benutzer.
CREATE TEMP TABLE "ownership_mapping" ON COMMIT DROP AS
SELECT DISTINCT ON ("customerId") "customerId", "id" AS "userId"
FROM "User"
ORDER BY "customerId", ("role" = 'SUPER_ADMIN') DESC, "createdAt", "id";

ALTER TABLE "JobListing" DROP CONSTRAINT "JobListing_customerId_fkey";
ALTER TABLE "JobSearch" DROP CONSTRAINT "JobSearch_customerId_fkey";
ALTER TABLE "JobImportState" DROP CONSTRAINT "JobImportState_customerId_fkey";
UPDATE "JobListing" j SET "customerId" = m."userId" FROM "ownership_mapping" m WHERE j."customerId" = m."customerId";
UPDATE "JobSearch" s SET "customerId" = m."userId" FROM "ownership_mapping" m WHERE s."customerId" = m."customerId";
UPDATE "JobImportState" i SET "customerId" = m."userId" FROM "ownership_mapping" m WHERE i."customerId" = m."customerId";
ALTER TABLE "JobListing" RENAME COLUMN "customerId" TO "userId";
ALTER TABLE "JobSearch" RENAME COLUMN "customerId" TO "userId";
ALTER TABLE "JobImportState" RENAME COLUMN "customerId" TO "userId";
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobSearch" ADD CONSTRAINT "JobSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JobImportState" ADD CONSTRAINT "JobImportState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER INDEX "JobListing_customerId_url_key" RENAME TO "JobListing_userId_url_key";
ALTER INDEX "JobSearch_customerId_url_key" RENAME TO "JobSearch_userId_url_key";
ALTER INDEX "JobImportState_customerId_key" RENAME TO "JobImportState_userId_key";
ALTER INDEX "JobListing_customerId_createdAt_id_idx" RENAME TO "JobListing_userId_createdAt_id_idx";
ALTER TABLE "User" DROP CONSTRAINT "User_customerId_fkey";
ALTER TABLE "User" DROP COLUMN "customerId";
DROP TABLE "Customer";

COMMIT;
