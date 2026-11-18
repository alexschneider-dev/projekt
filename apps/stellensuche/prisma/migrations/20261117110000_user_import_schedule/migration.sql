ALTER TABLE "JobImportState" ADD COLUMN "scheduleTime" TEXT, ADD COLUMN "nextScheduledAt" TIMESTAMP(3);
ALTER TABLE "JobImportState" ADD CONSTRAINT "JobImportState_scheduleTime_check" CHECK ("scheduleTime" IS NULL OR "scheduleTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
