ALTER TABLE "JobSearch"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'Gespeicherte Suche',
ADD COLUMN "lastResultCount" INTEGER,
ADD COLUMN "lastFetchedAt" TIMESTAMP(3);

UPDATE "JobSearch" SET "title" = 'Suche ' || "id";
