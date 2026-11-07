// Carga el producto de ejemplo si la base está vacía.
// Uso: npm run db:seed
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { sampleProduct } from "../lib/cpa";
import { requireDatabaseEnv } from "../lib/database-env";
import { PrismaClient } from "../lib/generated/prisma/client";

const { url, schema } = requireDatabaseEnv();
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema }) });

async function main() {
  const existing = await db.product.count();
  if (existing > 0) {
    console.log(`La base ya tiene ${existing} productos; no se carga el ejemplo.`);
    return;
  }

  const product = sampleProduct();
  await db.product.create({
    data: {
      id: product.id,
      name: product.name,
      price: product.price,
      minProfit: product.minProfit,
      adCpa: product.adCpa,
      monthlyOrders: product.monthlyOrders,
      projectedOrders: product.projectedOrders,
      shippedRate: product.shippedRate,
      deliveredRate: product.deliveredRate,
      position: 0,
      costs: {
        create: product.costs.map((cost, position) => ({
          id: cost.id,
          label: cost.label,
          amount: cost.amount,
          group: cost.group,
          position,
        })),
      },
    },
  });
  console.log(`Se cargó el producto de ejemplo “${product.name}”.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
