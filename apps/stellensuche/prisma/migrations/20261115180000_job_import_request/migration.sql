CREATE TABLE "JobImportState" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "requested" BOOLEAN NOT NULL DEFAULT false,
  "running" BOOLEAN NOT NULL DEFAULT false,
  "requestedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "succeeded" BOOLEAN,
  "inserted" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "JobImportState_pkey" PRIMARY KEY ("id")
);

INSERT INTO "JobImportState" ("id") VALUES (1);
