-- Runner balance ledger: which sourcing contact an expense was paid to.
ALTER TABLE "WiseTransaction" ADD COLUMN "runnerId" TEXT;
ALTER TABLE "WiseTransaction" ADD CONSTRAINT "WiseTransaction_runnerId_fkey" FOREIGN KEY ("runnerId") REFERENCES "Runner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
