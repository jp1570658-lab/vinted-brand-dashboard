-- AlterTable: latest like count on the dashboard item
ALTER TABLE "Item" ADD COLUMN "vintedLikes" INTEGER;

-- AlterTable: latest like count on the wardrobe snapshot row
ALTER TABLE "VintedListing" ADD COLUMN "favouriteCount" INTEGER;

-- CreateTable: per-scrape engagement time-series
CREATE TABLE "VintedListingSnapshot" (
    "id" TEXT NOT NULL,
    "vintedItemId" TEXT NOT NULL,
    "likes" INTEGER,
    "price" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VintedListingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VintedListingSnapshot_vintedItemId_idx" ON "VintedListingSnapshot"("vintedItemId");

-- CreateIndex
CREATE INDEX "VintedListingSnapshot_takenAt_idx" ON "VintedListingSnapshot"("takenAt");
