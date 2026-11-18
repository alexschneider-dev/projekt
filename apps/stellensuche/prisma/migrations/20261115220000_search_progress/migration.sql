ALTER TABLE "JobSearch"
  ADD COLUMN "lastScannedPages" INTEGER,
  ADD COLUMN "lastTotalPages" INTEGER,
  ADD COLUMN "lastScannedCount" INTEGER,
  ADD COLUMN "lastScanComplete" BOOLEAN;
