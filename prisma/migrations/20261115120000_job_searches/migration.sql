CREATE TABLE "JobSearch" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JobSearch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JobSearch_url_key" ON "JobSearch"("url");

INSERT INTO "JobSearch" ("url") VALUES
('https://www.stepstone.de/jobs/%2Btypescript-%2Bnextjs?siteId=250&q=%2BTypescript+%2BNext.js&searchOrigin=Resultlist_top-search')
ON CONFLICT ("url") DO NOTHING;
