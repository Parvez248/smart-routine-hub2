import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
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

const data = JSON.parse(
  readFileSync(join(__dirname, "routine-data.json"), "utf-8")
) as {
  timeSlots: { id: number; label: string }[];
  teachers: Record<string, string>;
  rooms: { name: string; capacity: number }[];
  batches: { name: string; semester: string }[];
  courses: { code: string; type: "LAB" | "THEORY" }[];
};

async function main() {
  const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
  const prisma = new PrismaClient({ adapter });

  for (const ts of data.timeSlots) {
    await prisma.timeSlot.upsert({
      where: { id: ts.id },
      update: { label: ts.label, sortOrder: ts.id },
      create: { id: ts.id, label: ts.label, sortOrder: ts.id },
    });
  }

  for (const [initials, name] of Object.entries(data.teachers)) {
    await prisma.teacher.upsert({
      where: { initials },
      update: { name },
      create: { initials, name },
    });
  }

  for (const room of data.rooms) {
    await prisma.room.upsert({
      where: { name: room.name },
      update: { capacity: room.capacity },
      create: { name: room.name, capacity: room.capacity },
    });
  }

  for (const batch of data.batches) {
    await prisma.batch.upsert({
      where: { name: batch.name },
      update: { semester: batch.semester },
      create: { name: batch.name, semester: batch.semester },
    });
  }

  const validCodes = new Set(data.courses.map((c) => c.code));
  const allCourses = await prisma.course.findMany({ select: { id: true, code: true } });
  for (const existing of allCourses) {
    if (!validCodes.has(existing.code)) {
      await prisma.session.deleteMany({ where: { courseId: existing.id } });
      await prisma.course.delete({ where: { id: existing.id } });
      console.log(`Removed stale course: ${existing.code}`);
    }
  }

  for (const course of data.courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: { type: course.type },
      create: { code: course.code, title: course.code, type: course.type },
    });
  }

  // Seed admin user
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { status: "ACTIVE", emailVerified: true },
      create: {
        email: adminEmail,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        emailVerified: true,
      },
    });
    console.log(`Admin user seeded: ${adminEmail}`);
  }

  console.log("Seed complete.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
