-- Enum anlegen
CREATE TYPE "InternalRole" AS ENUM ('CUSTOMER', 'SELLER', 'SUPER_ADMIN');

-- Enum anlegen
CREATE TYPE "AttributeKind" AS ENUM ('TEXT', 'NUMBER', 'BOOLEAN');

-- Tabelle anlegen
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "InternalRole" NOT NULL DEFAULT 'CUSTOMER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "PendingRegistration" (
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingRegistration_pkey" PRIMARY KEY ("email")
);

-- Tabelle anlegen
CREATE TABLE "LoginAttempt" (
    "key" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("key")
);

-- Tabelle anlegen
CREATE TABLE "Seller" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "Seller_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "AttributeDefinition" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "kind" "AttributeKind" NOT NULL,
    "unit" TEXT,
    "filterable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "imageId" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "ProductAttribute" (
    "productId" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "textValue" TEXT,
    "numberValue" DOUBLE PRECISION,
    "booleanValue" BOOLEAN,

    CONSTRAINT "ProductAttribute_pkey" PRIMARY KEY ("productId","attributeId")
);

-- Tabelle anlegen
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "deliveryDays" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- Tabelle anlegen
CREATE TABLE "ImageAsset" (
    "id" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "photographer" TEXT NOT NULL,
    "photographerUrl" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "smallUrl" TEXT NOT NULL,
    "mediumUrl" TEXT NOT NULL,
    "largeUrl" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,

    CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);

-- Index anlegen
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- Index anlegen
CREATE UNIQUE INDEX "PendingRegistration_tokenHash_key" ON "PendingRegistration"("tokenHash");

-- Index anlegen
CREATE INDEX "PendingRegistration_expiresAt_idx" ON "PendingRegistration"("expiresAt");

-- Index anlegen
CREATE INDEX "LoginAttempt_expiresAt_idx" ON "LoginAttempt"("expiresAt");

-- Index anlegen
CREATE UNIQUE INDEX "Seller_userId_key" ON "Seller"("userId");

-- Index anlegen
CREATE UNIQUE INDEX "Seller_slug_key" ON "Seller"("slug");

-- Index anlegen
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- Index anlegen
CREATE UNIQUE INDEX "AttributeDefinition_categoryId_key_key" ON "AttributeDefinition"("categoryId", "key");

-- Index anlegen
CREATE UNIQUE INDEX "AttributeDefinition_id_categoryId_key" ON "AttributeDefinition"("id", "categoryId");

-- Index anlegen
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- Index anlegen
CREATE INDEX "Product_categoryId_published_id_idx" ON "Product"("categoryId", "published", "id");

-- Index anlegen
CREATE INDEX "Product_imageId_idx" ON "Product"("imageId");

-- Index anlegen
CREATE UNIQUE INDEX "Product_id_categoryId_key" ON "Product"("id", "categoryId");

-- Index anlegen
CREATE INDEX "ProductAttribute_attributeId_textValue_productId_idx" ON "ProductAttribute"("attributeId", "textValue", "productId");

-- Index anlegen
CREATE INDEX "ProductAttribute_attributeId_numberValue_productId_idx" ON "ProductAttribute"("attributeId", "numberValue", "productId");

-- Index anlegen
CREATE INDEX "Offer_productId_active_priceCents_idx" ON "Offer"("productId", "active", "priceCents");

-- Index anlegen
CREATE INDEX "Offer_sellerId_active_productId_idx" ON "Offer"("sellerId", "active", "productId");

-- Index anlegen
CREATE INDEX "Offer_active_priceCents_productId_idx" ON "Offer"("active", "priceCents", "productId");

-- Index anlegen
CREATE UNIQUE INDEX "Offer_sellerId_productId_key" ON "Offer"("sellerId", "productId");

-- Index anlegen
CREATE UNIQUE INDEX "ImageAsset_contentHash_key" ON "ImageAsset"("contentHash");

-- Fremdschlüssel anlegen
ALTER TABLE "Seller" ADD CONSTRAINT "Seller_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "AttributeDefinition" ADD CONSTRAINT "AttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "Product" ADD CONSTRAINT "Product_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_productId_categoryId_fkey" FOREIGN KEY ("productId", "categoryId") REFERENCES "Product"("id", "categoryId") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_attributeId_categoryId_fkey" FOREIGN KEY ("attributeId", "categoryId") REFERENCES "AttributeDefinition"("id", "categoryId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "Seller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Fremdschlüssel anlegen
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Fachliche Grenzen auch außerhalb der Anwendung erzwingen.
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_price_positive" CHECK ("priceCents" >= 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_stock_positive" CHECK (stock >= 0);
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_delivery_positive" CHECK ("deliveryDays" >= 0);
ALTER TABLE "ProductAttribute" ADD CONSTRAINT "ProductAttribute_single_value"
  CHECK (num_nonnulls("textValue", "numberValue", "booleanValue") = 1);
ALTER TABLE "ImageAsset" ADD CONSTRAINT "ImageAsset_size_budget" CHECK (bytes > 0 AND bytes <= 200000);

-- IDs unterhalb dieser Grenze bleiben dem Demogenerator vorbehalten.
SELECT setval(pg_get_serial_sequence('"Product"', 'id'), 10000000, true);
