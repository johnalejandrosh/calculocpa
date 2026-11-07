-- AlterTable
ALTER TABLE "cost_items" ADD COLUMN     "percent" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "min_profit_percent" DECIMAL(5,2);
