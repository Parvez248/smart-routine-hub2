import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function buildAdapterConfig(url: string) {
  const parsed = new URL(url.replace(/^mysql:/, "mariadb:"));
  const isCloud = parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1";
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "3306"),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    ...(isCloud ? { ssl: { rejectUnauthorized: true } } : {}),
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
