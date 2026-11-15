CREATE TABLE "JobListing" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobListing_url_key" ON "JobListing"("url");
CREATE INDEX "JobListing_createdAt_id_idx" ON "JobListing"("createdAt", "id");
