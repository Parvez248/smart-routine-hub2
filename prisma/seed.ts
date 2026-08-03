import "dotenv/config";
import { execFileSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../app/generated/prisma/client";

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

// Bootstraps a blank database. The routine import (reference data, the
// published version, and every session) is delegated to
// import-routine-july.ts — the same script that refreshes production from
// the current source — so there is exactly one place that knows how to
// build the routine. This file only adds what that script doesn't cover:
// the admin login, since nothing else creates it.
//
// Safe by default: without --apply this only reports what it would do
// (both here and in the delegated import). `prisma db seed` passes
// --apply explicitly (see prisma.config.ts); a bare `tsx prisma/seed.ts`
// stays a dry run.
const APPLY = process.argv.includes("--apply");

async function main() {
  console.log(`\n=== Database seed — ${APPLY ? "APPLY MODE (will write to the database)" : "DRY RUN (no changes will be made)"} ===`);

  console.log("\n--- Admin user ---");
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin user seed.");
  } else {
    const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
    const prisma = new PrismaClient({ adapter });
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (APPLY) {
      const passwordHash = await bcrypt.hash(adminPassword, 12);
      await prisma.user.upsert({
        where: { email: adminEmail },
        update: { status: "ACTIVE", emailVerified: true },
        create: { email: adminEmail, passwordHash, role: "ADMIN", status: "ACTIVE", emailVerified: true },
      });
      console.log(`Admin user ${existing ? "confirmed" : "created"}: ${adminEmail}`);
    } else {
      console.log(existing ? `Would confirm existing admin user: ${adminEmail}` : `Would create admin user: ${adminEmail}`);
    }
    await prisma.$disconnect();
  }

  console.log("\n--- Routine (reference data, published version, sessions) ---");
  console.log(`Delegating to import-routine-july.ts${APPLY ? " --apply" : " (dry run)"}...\n`);
  execFileSync("npx", ["tsx", "prisma/import-routine-july.ts", ...(APPLY ? ["--apply"] : [])], {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  console.log(`\n=== Seed ${APPLY ? "complete" : "dry run complete — no changes were made"} ===`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
