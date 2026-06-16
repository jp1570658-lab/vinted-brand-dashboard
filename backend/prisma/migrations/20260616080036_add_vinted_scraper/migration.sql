-- CreateTable
CREATE TABLE "VintedSync" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lastSyncAt" DATETIME NOT NULL,
    "listingsSeen" INTEGER NOT NULL,
    "salesFound" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "VintedListing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vintedItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" REAL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "soldDetected" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "VintedListing_vintedItemId_key" ON "VintedListing"("vintedItemId");

-- CreateIndex
CREATE INDEX "VintedListing_active_idx" ON "VintedListing"("active");
