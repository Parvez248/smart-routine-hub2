import Link from "next/link";
import { auth } from "@/lib/auth";

const HOME_BY_ROLE: Record<string, string> = {
  ADMIN: "/admin/dashboard",
  TEACHER: "/teacher/classes",
  STUDENT: "/student/routine",
};

export default async function NotFound() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const homeHref = (role && HOME_BY_ROLE[role]) ?? "/login";

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="text-center max-w-sm">
        <p className="text-sm font-semibold text-primary">404</p>
        <h1 className="mt-2 text-xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-slate">
          The page you&apos;re looking for doesn&apos;t exist or may have moved.
        </p>
        <Link
          href={homeHref}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity focus-visible:outline-none"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
