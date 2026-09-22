/**
 * Prisma client factory for the TiDB (MySQL/MariaDB-wire-compatible) database.
 *
 * Every route/service calls `getDb()` rather than constructing its own
 * PrismaClient — this file is the single place that knows how to connect.
 * Two things make this non-trivial:
 *
 *  - TiDB Cloud requires TLS and is reached over the public internet, so the
 *    connection needs SSL and generous timeouts (a local dev DB doesn't).
 *  - This app deploys to Vercel serverless functions, where each invocation
 *    can be a fresh, short-lived process. A naive "new PrismaClient() at
 *    module scope" would still risk creating a new client (and a new
 *    connection) per invocation in dev's hot-reload, exhausting the
 *    database's connection limit — hence the `globalThis` cache below.
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/app/generated/prisma/client";

// Cache the client on `globalThis` (not a module-level `let`) so it survives
// Next.js dev-mode hot module reloading, which re-evaluates modules but not
// the global object — without this, every hot reload would open a new
// connection to TiDB and slowly leak the connection pool.
const g = globalThis as unknown as { prisma?: PrismaClient };

// Turns a standard `mysql://user:pass@host:port/db` connection string into
// the shape @prisma/adapter-mariadb expects.
function buildAdapterConfig(url: string) {
  // The MariaDB driver doesn't parse `mysql://` URLs itself, but the WHATWG
  // URL parser does — swap the scheme just to get host/port/user/etc. out of it.
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
    // TiDB Cloud (and any non-local host) requires TLS; a local dev
    // database typically isn't configured for it, so skip SSL there.
    ssl: isLocal ? undefined : { rejectUnauthorized: true },
    // Generous timeouts: TiDB Cloud is reached over the public internet and
    // a serverless function's first connection can be slow (cold start +
    // TLS handshake), so short defaults would cause spurious failures.
    connectTimeout: 20000,
    acquireTimeout: 20000,
    // Kept low deliberately: a serverless deployment can spin up many
    // concurrent function instances, each with its own connection pool —
    // a high per-instance limit multiplies across instances and can exhaust
    // TiDB's total connection budget. 3 is enough for one function's own
    // concurrency without risking that.
    connectionLimit: 3,
  };
}

function createClient(): PrismaClient {
  const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
  return new PrismaClient({ adapter });
}

// The one function every route/service should use to reach the database.
// Lazily creates the client on first call, then reuses it (see the
// globalThis cache above) for the lifetime of the process/module.
export function getDb(): PrismaClient {
  if (!g.prisma) g.prisma = createClient();
  return g.prisma;
}
