-- Expenses beyond Wise: where the money left from, and an optional EUR transfer fee.
ALTER TABLE "WiseTransaction" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'WISE';
ALTER TABLE "WiseTransaction" ADD COLUMN "fee" DOUBLE PRECISION;
