-- Landed cost: optional per-item cost fields (all nullable, no data change).
ALTER TABLE "Item" ADD COLUMN "authFee" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN "otherCosts" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN "platformFee" DOUBLE PRECISION;
ALTER TABLE "Item" ADD COLUMN "outboundShipping" DOUBLE PRECISION;
