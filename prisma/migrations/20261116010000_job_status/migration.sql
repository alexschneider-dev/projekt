CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'BEWORBEN', 'NICHT_PASSEND', 'AUSGELAUFEN');
ALTER TABLE "JobListing" ADD COLUMN "status" "JobStatus" NOT NULL DEFAULT 'PENDING';
UPDATE "JobListing" SET "status" = 'BEWORBEN' WHERE "isMarkiert" = true;
ALTER TABLE "JobListing" DROP COLUMN "isMarkiert";
