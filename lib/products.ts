// Acceso a los productos guardados en PostgreSQL. Solo se usa en el servidor.
import "server-only";
import { connection } from "next/server";
import { valueOf, type Product } from "@/lib/cpa";
import { db } from "@/lib/db";
import type { ProductChanges } from "@/lib/product-schema";

/** Productos en el orden de la lista, con sus costos. Se lee en cada petición. */
export async function listProducts(): Promise<Product[]> {
  await connection();
  const rows = await db.product.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: { costs: { orderBy: { position: "asc" } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price.toNumber(),
    minProfit: row.minProfit.toNumber(),
    minProfitPercent: row.minProfitPercent === null ? null : row.minProfitPercent.toNumber(),
    adCpa: row.adCpa === null ? null : row.adCpa.toNumber(),
    monthlyOrders: row.monthlyOrders,
    projectedOrders: row.projectedOrders,
    shippedRate: row.shippedRate.toNumber(),
    deliveredRate: row.deliveredRate.toNumber(),
    costs: row.costs.map((cost) => ({
      id: cost.id,
      label: cost.label,
      amount: cost.amount.toNumber(),
      percent: cost.percent === null ? null : cost.percent.toNumber(),
      group: cost.group,
    })),
  }));
}

/** Aplica los cambios en una sola transacción: o se guarda todo o nada. */
export async function saveProductChanges({ upsert, remove, order }: ProductChanges): Promise<void> {
  await db.$transaction(async (tx) => {
    if (remove.length > 0) {
      await tx.product.deleteMany({ where: { id: { in: remove } } });
    }

    // Los montos definidos como % se guardan también en pesos, calculados con el precio actual.
    const pesos = (amount: number, percent: number | null, price: number) =>
      Math.round(valueOf(amount, percent, price) * 100) / 100;

    for (const product of upsert) {
      const data = {
        name: product.name,
        price: product.price,
        minProfit: pesos(product.minProfit, product.minProfitPercent, product.price),
        minProfitPercent: product.minProfitPercent,
        adCpa: product.adCpa,
        monthlyOrders: product.monthlyOrders,
        projectedOrders: product.projectedOrders,
        shippedRate: product.shippedRate,
        deliveredRate: product.deliveredRate,
        position: product.position,
      };
      await tx.product.upsert({
        where: { id: product.id },
        create: { id: product.id, ...data },
        update: data,
      });
      // Los costos se reemplazan completos: así se reflejan altas, bajas y orden.
      await tx.costItem.deleteMany({ where: { productId: product.id } });
      if (product.costs.length > 0) {
        await tx.costItem.createMany({
          data: product.costs.map((cost, position) => ({
            id: cost.id,
            productId: product.id,
            label: cost.label,
            amount: pesos(cost.amount, cost.percent, product.price),
            percent: cost.percent,
            group: cost.group,
            position,
          })),
        });
      }
    }

    if (order) {
      for (const [position, id] of order.entries()) {
        await tx.product.updateMany({ where: { id }, data: { position } });
      }
    }
  });
}
