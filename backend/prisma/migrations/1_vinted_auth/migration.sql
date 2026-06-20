-- CreateTable
CREATE TABLE "VintedAuth" (
    "id" TEXT NOT NULL,
    "cookie" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VintedAuth_pkey" PRIMARY KEY ("id")
);
