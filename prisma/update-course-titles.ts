import "dotenv/config";
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

// Step 43 — the real title for all 61 courses, matched by code. Title-only:
// never touches code or type, never creates/deletes a course. Safe by
// default: without --apply this only reports what it would do.
const APPLY = process.argv.includes("--apply");

const TITLES: Record<string, string> = {
  ACT215: "Financial and Managerial Accounting",
  BAN211: "History of Emergence of Bangladesh",
  CSE112: "Basic Computer Skills Lab",
  CSE113: "Discrete Mathematics",
  CSE117: "Engineering Ethics and Cyber Law",
  CSE121: "Structured Programming Language",
  CSE122: "Structured Programming Language Lab",
  CSE213: "Digital Electronics",
  CSE214: "Digital Electronics Lab",
  CSE215: "Data Structures",
  CSE216: "Data Structures Lab",
  CSE221: "Computer Algorithms",
  CSE222: "Computer Algorithms Lab",
  CSE223: "Object Oriented Programming",
  CSE224: "Object Oriented Programming Lab",
  CSE225: "Digital Logic Design",
  CSE226: "Digital Logic Design Lab",
  CSE227: "Data Communication",
  CSE229: "Computer Architecture",
  CSE311: "Theory of Computing",
  CSE313: "Database Management System",
  CSE314: "Database Management System Lab",
  CSE315: "Microprocessors & Embedded System",
  CSE316: "Microprocessors & Embedded System Lab",
  CSE317: "Computer Networks",
  CSE318: "Computer Networks Lab",
  CSE321: "Operating System",
  CSE322: "Operating System Lab",
  CSE323: "System Analysis & Design",
  CSE324: "System Analysis & Design Lab",
  CSE325: "Computer Peripherals & Interfacing",
  CSE326: "Computer Peripherals & Interfacing Lab",
  CSE411: "Artificial Intelligence",
  CSE412: "Artificial Intelligence Lab",
  CSE413: "Computer Graphics",
  CSE414: "Computer Graphics Lab",
  CSE415: "Digital Signal Processing",
  CSE416: "Digital Signal Processing Lab",
  CSE417: "Compiler Design",
  CSE418: "Compiler Design Lab",
  CSE419: "Communication Engineering",
  CSE421: "Software Engineering",
  CSE423: "Digital Image Processing",
  CSE469: "Digital Image Processing",
  EEE117: "Electrical Engineering",
  EEE127: "Electronic Devices & Circuits",
  EEE128: "Electrical and Electronic Circuits Lab",
  ENG111: "English Basics",
  ENG127: "English Skills",
  ENS221: "Environmental Science",
  MAT115: "Differential & Integral Calculus",
  MAT125: "Linear Algebra & Complex Variables",
  MAT213: "Statistics and Probability",
  MAT217: "Ordinary & Partial Differential Equation",
  MAT317: "Engineering Mathematics",
  MAT323: "Numerical Analysis",
  MGT329: "Industrial and Operational Management",
  MGT417: "Industrial and Operational Management",
  PHY111: "Physics I",
  PHY121: "Physics II",
  PHY122: "Physics II Lab",
};

async function main() {
  console.log(`\n=== Course title update — ${APPLY ? "APPLY MODE (will write to the database)" : "DRY RUN (no changes will be made)"} ===`);

  const adapter = new PrismaMariaDb(buildAdapterConfig(process.env.DATABASE_URL!));
  const prisma = new PrismaClient({ adapter });

  const codes = Object.keys(TITLES);
  const existing = await prisma.course.findMany({ where: { code: { in: codes } } });
  const existingByCode = new Map(existing.map((c) => [c.code, c]));

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const code of codes) {
    const newTitle = TITLES[code];
    const course = existingByCode.get(code);
    if (!course) {
      console.log(`${code}: SKIP (not found)`);
      skipped++;
      continue;
    }
    if (course.title === newTitle) {
      console.log(`${code}: already "${newTitle}" — unchanged`);
      unchanged++;
      continue;
    }
    console.log(`${code}: "${course.title}" -> "${newTitle}"`);
    updated++;
    if (APPLY) {
      await prisma.course.update({ where: { id: course.id }, data: { title: newTitle } });
    }
  }

  console.log(`\n${APPLY ? "Updated" : "Would update"}: ${updated}, unchanged: ${unchanged}, skipped (not found): ${skipped}`);

  if (APPLY) {
    const stillEqual = await prisma.course.findMany({ where: { code: { in: codes } } });
    const stale = stillEqual.filter((c) => c.title === c.code);
    console.log(`\nCourses still with title === code after apply: ${stale.length}`);
    if (stale.length > 0) console.log(stale.map((c) => c.code).join(", "));
  }

  console.log(`\n=== ${APPLY ? "APPLY COMPLETE" : "DRY RUN COMPLETE — no changes were made"} ===`);
  if (!APPLY) console.log("Review the plan above. Re-run with --apply to execute it for real.\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
