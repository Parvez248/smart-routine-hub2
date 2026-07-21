"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn, getSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { Input } from "@/components/ui/input";

type Role = "ADMIN" | "TEACHER" | "STUDENT";

const ERROR_MESSAGES: Record<string, string> = {
  "email-unverified": "Please verify your e-mail before signing in.",
  "account-pending": "Your account is awaiting admin approval.",
  "account-rejected": "Your account request was rejected.",
};

const ROLE_REDIRECT: Record<Role, string> = {
  ADMIN: "/admin/dashboard",
  TEACHER: "/teacher/classes",
  STUDENT: "/student/routine",
};

const ROLE_LOGIN_PATH: Record<Role, string> = {
  ADMIN: "/login/admin",
  TEACHER: "/login/teacher",
  STUDENT: "/login/student",
};

const ROLE_NAME: Record<Role, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "TEACHER" || value === "STUDENT";
}

export default function RoleLoginForm({
  role,
  heading,
  description,
  signup,
  note,
}: {
  role: Role;
  heading: string;
  description: string;
  signup?: { href: string; label: string };
  note?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<React.ReactNode>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (result?.error) {
      setLoading(false);
      setError(ERROR_MESSAGES[result.code ?? ""] ?? "Invalid email or password.");
      return;
    }

    const session = await getSession();
    const actualRole = session?.user?.role;

    if (actualRole !== role) {
      await signOut({ redirect: false });
      setLoading(false);
      if (isRole(actualRole)) {
        setError(
          <>
            This account is not a {ROLE_NAME[role]} account. Please use the{" "}
            <Link href={ROLE_LOGIN_PATH[actualRole]} className="font-semibold underline">
              {ROLE_NAME[actualRole]} login
            </Link>
            .
          </>
        );
      } else {
        setError("This account cannot access this area.");
      }
      return;
    }

    router.push(ROLE_REDIRECT[role]);
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                {heading}
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary">
                  {ROLE_NAME[role]}
                </span>
              </span>
            }
            description={description}
            accent
          />

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-10 bg-canvas"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 bg-canvas"
              />
            </div>

            {error && <Message type="error">{error}</Message>}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            {signup && (
              <p className="text-center text-xs text-muted-foreground">
                New {ROLE_NAME[role].toLowerCase()}?{" "}
                <Link href={signup.href} className="text-primary font-semibold hover:opacity-80">
                  {signup.label}
                </Link>
              </p>
            )}
            {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}

            <p className="text-center text-xs text-muted-foreground">
              <Link href="/" className="hover:text-foreground">
                ← Back
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
