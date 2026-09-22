# Routine Management System

A class routine (timetable) manager for a university CSE department —
Hamdard University Bangladesh, Department of Computer Science &
Engineering. One admin-maintained weekly schedule, published to
role-specific read-only views for teachers and students, with a
reschedule-request workflow, reminders, notices, and a print/PDF export of
the full routine.

## Stack

- **Next.js 16** (App Router), React, TypeScript
- **Tailwind CSS v4**
- **Prisma v7** against a **TiDB** database (MySQL/MariaDB-wire-compatible),
  reached via `@prisma/adapter-mariadb`
- **NextAuth (Auth.js)**, credentials provider, JWT sessions
- **Zod** for request validation
- Deployed on **Vercel**

## The three roles

**Admin** — the only role that can write to the routine. Full Routine
grid/rail/table views with inline add/edit/delete/cancel on a session,
two-period lab support, combined-section (`"Both"`) classes with a
one-click Combine/Split action, print/PDF export, reference-data CRUD
(courses, teachers, rooms, batches, time slots), routine versions
(draft/publish), teacher account/login management, reschedule-request
approval, and notices.

**Teacher** — read-only Full Routine (the whole department's schedule, not
just their own classes), "My Classes"/"My Courses" (their own), a
reschedule-request flow for moving one of their own classes on a specific
date (subject to admin approval), rescheduled-classes history, free-room
lookup, and notices. Self-registers, then needs admin approval before
signing in.

**Student** — read-only routine for their batch (every class for that
batch, `"Both"`-section classes included — see the "How sections work"
note below), per-class reminders, rescheduled-classes list, and notices.
Self-registers and only needs to verify their email — no admin approval
step.

## Running locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. `npm run build` runs `prisma generate`
before `next build`; `postinstall` also runs `prisma generate` so the
Prisma client is available immediately after `npm install`.

### Environment variables

Set these in `.env` (names only — get actual values from whoever manages
the deployment, never commit real values):

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | TiDB/MySQL connection string (see `lib/db.ts`) |
| `NEXTAUTH_URL` | Base URL NextAuth uses for callbacks (e.g. `http://localhost:3000` in dev) |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | Session/JWT signing secret |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The admin login the seed script creates |

## Database: migrations, seed, import

- **Migrations** are plain Prisma migrations (`prisma/migrations`), applied
  the normal Prisma way. The schema itself is not documented here — read
  `prisma/schema.prisma`.
- **Seeding a blank database**: `prisma db seed` (or `prisma migrate
  reset`) runs `prisma/seed.ts --apply`, which creates the admin user (from
  `ADMIN_EMAIL`/`ADMIN_PASSWORD`) and then delegates the actual routine
  data to `import:routine:july`. Run `tsx prisma/seed.ts` directly (no
  `--apply`) for a dry run that only reports what it would do.
- **Re-importing the current routine**: `npm run import:routine:july` runs
  `prisma/import-routine-july.ts` against `prisma/routine-data-july.json`,
  the authoritative source for the current published schedule. It is
  dry-run by default; pass `--apply` to actually write. It upserts
  reference data (never deletes it), replaces the published version's
  sessions, and — like every write-capable script in this repo — never
  touches `User`, `Notice`, or migration history.
- `npm run update:titles` (`prisma/update-course-titles.ts`) is a smaller,
  same-pattern script that only updates `Course.title` values.

All of the above scripts share one safety convention: **dry run by
default, `--apply` to actually write**, and a printed plan before any
write happens. Follow that pattern for any new one-off data script.

## Deployment

Vercel (serverless functions) + TiDB Cloud. Two things about that
combination matter enough to be documented where the code lives rather
than only here:

- `lib/db.ts` explains the connection pool/timeout/SSL settings chosen for
  a serverless-functions-talking-to-a-cloud-database setup, and why the
  Prisma client is cached on `globalThis` rather than created per module load.
- `proxy.ts` (Next.js middleware) protects page routes (`/admin`,
  `/teacher`, `/student`) but **excludes `/api/*`** — every API route
  checks authorization itself (`auth()` directly, or
  `getAuthenticatedTeacher()`/`getAuthenticatedStudent()`). This is the
  single most important thing to know before adding a new API route.

## Architecture — where to look

- **`lib/services/scheduling.ts`** — the scheduling engine: the "effective
  schedule" (cancellations and approved reschedules folded in), conflict
  checks (room/teacher/section-overlap), capacity checks, and free-room
  lookup. Read this first to understand how the app decides whether a
  class placement is allowed.
- **`lib/ui/sections.ts`** — the section rules: a batch's `"Sec 1"`/
  `"Sec 2"`/`"Both"` (combined-section) semantics, and `canCombine`, the
  rule for when two section rows may be merged into one `"Both"` class.
- **`app/components/routine/labMerge.ts`** — the two-period-lab rules
  (which two time slots pair up, which two `Session` rows count as "the
  same lab").
- **`lib/auth.ts`** / **`proxy.ts`** — authentication (NextAuth config,
  JWT/session shape, the forced-password-change flow) and route protection.
- **`app/components/routine/RoutineGrid.tsx`** (desktop table),
  **`RoutineTimeRail.tsx`** (mobile list), **`RoutineList.tsx`** (sortable
  table view) — the three ways the same routine data gets rendered, shared
  by all three roles. `RoutineGrid.tsx`'s file header explains how a
  two-period lab (`colSpan`), a `"Both"`-section class (`rowSpan`), and a
  lab-that-is-also-`"Both"` (both at once) compose in the same grid.
- **`app/components/routine/SessionDialog.tsx`** — the admin's inline
  add/edit dialog for one class, including the lab-aware "two rows in
  lockstep" save/delete logic.
- **`app/components/routine/useRoutineFilters.ts`** — routine-view filter
  state, its URL query-string and localStorage persistence.
- **`app/globals.css`**'s `@media print` block plus
  `RoutineMasthead.tsx`/`PrintPanel.tsx` — the print/PDF layout (landscape
  page, repeating header, ink-friendly styling).
- **`app/api/**/route.ts`** — every endpoint has a comment above its
  handler(s) stating its purpose, who may call it, and its error cases.
