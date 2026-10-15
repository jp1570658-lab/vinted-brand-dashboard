-- Direct / multi-channel sales: where it sold and how the money arrived.
ALTER TABLE "Item" ADD COLUMN "saleChannel" TEXT;
ALTER TABLE "Item" ADD COLUMN "paymentMethod" TEXT;
