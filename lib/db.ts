import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { requireDatabaseEnv } from "@/lib/database-env";
import { PrismaClient } from "@/lib/generated/prisma/client";

function createClient() {
  const { url, schema } = requireDatabaseEnv();
  // El adaptador de pg no lee `?schema=` de la URL; hay que pasarlo aparte.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }, { schema }) });
}

// En desarrollo el hot reload vuelve a evaluar este módulo; se reutiliza el
// cliente para no abrir una conexión nueva en cada recarga.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
