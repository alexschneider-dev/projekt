BEGIN;

CREATE UNIQUE INDEX "Offer_id_productId_key" ON "Offer"("id", "productId");
CREATE INDEX "Product_categoryId_published_createdAt_id_idx" ON "Product"("categoryId", "published", "createdAt", "id");

CREATE TABLE "CartItem" (
  "userId" TEXT NOT NULL,
  "productId" INTEGER NOT NULL,
  "offerId" TEXT NOT NULL,
  "slot" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("userId", "productId"),
  CONSTRAINT "CartItem_slot_range" CHECK ("slot" BETWEEN 1 AND 10)
);
CREATE UNIQUE INDEX "CartItem_userId_slot_key" ON "CartItem"("userId", "slot");
CREATE INDEX "CartItem_offerId_productId_idx" ON "CartItem"("offerId", "productId");
CREATE INDEX "CartItem_productId_idx" ON "CartItem"("productId");
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_offerId_productId_fkey"
  FOREIGN KEY ("offerId", "productId") REFERENCES "Offer"("id", "productId") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
