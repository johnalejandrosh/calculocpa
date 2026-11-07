// Conexión a PostgreSQL armada con las variables DB_* del .env.
// La usan la CLI de Prisma (prisma.config.ts), la app (lib/db.ts) y el seed.

const REQUIRED = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASSWORD"] as const;

export interface DatabaseEnv {
  /** Cadena de conexión con el usuario y la contraseña ya codificados. */
  url: string;
  /** Esquema de PostgreSQL donde viven las tablas de la app. */
  schema: string;
}

/** `null` si falta alguna variable: la CLI puede generar el cliente sin conexión. */
export function databaseEnv(env: NodeJS.ProcessEnv = process.env): DatabaseEnv | null {
  if (REQUIRED.some((key) => !env[key])) return null;

  // Se acepta también DB_SHEMA, el nombre con el que se definió la variable.
  const schema = env.DB_SCHEMA || env.DB_SHEMA || "public";
  const url = new URL(`postgresql://${env.DB_HOST}:${env.DB_PORT || "5432"}`);
  url.pathname = `/${encodeURIComponent(env.DB_NAME!)}`;
  url.username = env.DB_USER!;
  url.password = env.DB_PASSWORD!;
  url.searchParams.set("schema", schema);
  // Opcional: "require" en servidores que exigen TLS, "disable" en bases locales sin TLS.
  if (env.DB_SSLMODE) url.searchParams.set("sslmode", env.DB_SSLMODE);
  return { url: url.href, schema };
}

export function requireDatabaseEnv(env: NodeJS.ProcessEnv = process.env): DatabaseEnv {
  const config = databaseEnv(env);
  if (!config) {
    const missing = REQUIRED.filter((key) => !env[key]);
    throw new Error(`Faltan variables de entorno de la base de datos: ${missing.join(", ")}.`);
  }
  return config;
}
