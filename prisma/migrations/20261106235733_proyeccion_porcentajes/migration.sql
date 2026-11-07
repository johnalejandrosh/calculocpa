-- AlterTable
ALTER TABLE "products" ADD COLUMN     "delivered_rate" DECIMAL(5,2) NOT NULL DEFAULT 60,
ADD COLUMN     "projected_orders" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "shipped_rate" DECIMAL(5,2) NOT NULL DEFAULT 80;
