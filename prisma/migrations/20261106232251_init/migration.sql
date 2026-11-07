-- CreateEnum
CREATE TYPE "cost_group" AS ENUM ('producto', 'flete', 'riesgo', 'operacion');

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "min_profit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "ad_cpa" DECIMAL(14,2),
    "monthly_orders" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_items" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "group" "cost_group" NOT NULL DEFAULT 'operacion',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "products_position_idx" ON "products"("position");

-- CreateIndex
CREATE INDEX "cost_items_product_id_position_idx" ON "cost_items"("product_id", "position");

-- AddForeignKey
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
