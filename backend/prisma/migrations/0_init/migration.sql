-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('SOURCED', 'IN_TRANSIT', 'IN_STOCK', 'SOLD');

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "grade" TEXT,
    "color" TEXT,
    "photoUrl" TEXT,
    "status" "ItemStatus" NOT NULL DEFAULT 'SOURCED',
    "sourcedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitAt" TIMESTAMP(3),
    "stockAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "purchaseCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "purchasePriceEur" DOUBLE PRECISION,
    "shippingCost" DOUBLE PRECISION,
    "customsFees" DOUBLE PRECISION,
    "listedPrice" DOUBLE PRECISION,
    "salePrice" DOUBLE PRECISION,
    "netProfit" DOUBLE PRECISION,
    "notes" TEXT,
    "vintedOrderId" TEXT,
    "saleSource" TEXT,
    "runnerId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Runner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WiseTransaction" (
    "id" TEXT NOT NULL,
    "wiseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "amountEur" DOUBLE PRECISION,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "itemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WiseTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GmailSync" (
    "id" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "emailCount" INTEGER NOT NULL,
    "salesFound" INTEGER NOT NULL,

    CONSTRAINT "GmailSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VintedSync" (
    "id" TEXT NOT NULL,
    "lastSyncAt" TIMESTAMP(3) NOT NULL,
    "listingsSeen" INTEGER NOT NULL,
    "salesFound" INTEGER NOT NULL,

    CONSTRAINT "VintedSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VintedListing" (
    "id" TEXT NOT NULL,
    "vintedItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "soldDetected" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VintedListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoogleToken" (
    "id" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiry" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Item_status_idx" ON "Item"("status");

-- CreateIndex
CREATE INDEX "Item_sourcedAt_idx" ON "Item"("sourcedAt");

-- CreateIndex
CREATE INDEX "Item_soldAt_idx" ON "Item"("soldAt");

-- CreateIndex
CREATE INDEX "Item_deletedAt_idx" ON "Item"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WiseTransaction_wiseId_key" ON "WiseTransaction"("wiseId");

-- CreateIndex
CREATE INDEX "WiseTransaction_date_idx" ON "WiseTransaction"("date");

-- CreateIndex
CREATE INDEX "WiseTransaction_category_idx" ON "WiseTransaction"("category");

-- CreateIndex
CREATE UNIQUE INDEX "VintedListing_vintedItemId_key" ON "VintedListing"("vintedItemId");

-- CreateIndex
CREATE INDEX "VintedListing_active_idx" ON "VintedListing"("active");

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WiseTransaction" ADD CONSTRAINT "WiseTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

