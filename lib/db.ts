import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function buildAdapterConfig(url: string) {
  const parsed = new URL(url.replace(/^mysql:/, "mariadb:"));
  const host = parsed.hostname;
  const port = parseInt(parsed.port || "3306");
  const user = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  // pathname is "/dbname" — strip leading slash and any query params
  const database = parsed.pathname.slice(1).split("?")[0];
  const isLocal = host === "localhost" || host === "127.0.0.1";

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
  };
}

function createClient(): PrismaClient {
  const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
  return new PrismaClient({ adapter });
}

export function getDb(): PrismaClient {
  if (!g.prisma) g.prisma = createClient();
  return g.prisma;
}
