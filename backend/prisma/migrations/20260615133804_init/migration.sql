-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "grade" TEXT,
    "color" TEXT,
    "photoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SOURCED',
    "sourcedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transitAt" DATETIME,
    "stockAt" DATETIME,
    "soldAt" DATETIME,
    "purchasePrice" REAL NOT NULL,
    "purchaseCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "purchasePriceEur" REAL,
    "shippingCost" REAL,
    "customsFees" REAL,
    "listedPrice" REAL,
    "salePrice" REAL,
    "netProfit" REAL,
    "notes" TEXT,
    "vintedOrderId" TEXT,
    "saleSource" TEXT,
    "runnerId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Item_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Runner" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WiseTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wiseId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "amount" REAL NOT NULL,
    "currency" TEXT NOT NULL,
    "amountEur" REAL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "itemId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WiseTransaction_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GmailSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastSyncAt" DATETIME NOT NULL,
    "emailCount" INTEGER NOT NULL,
    "salesFound" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "GoogleToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "expiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
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
