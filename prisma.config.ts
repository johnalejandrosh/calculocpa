// Prisma 7 no lee .env por su cuenta; dotenv lo carga para la CLI.
import "dotenv/config";
import { defineConfig } from "prisma/config";
import { databaseEnv } from "./lib/database-env";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Sin variables DB_* (por ejemplo en CI) `prisma generate` funciona igual.
    url: databaseEnv()?.url,
  },
});
