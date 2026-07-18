"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

const ERROR_MESSAGES: Record<string, string> = {
  "email-unverified": "Please verify your e-mail before signing in.",
  "account-pending": "Your account is awaiting admin approval.",
  "account-rejected": "Your account request was rejected.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError(ERROR_MESSAGES[result.code ?? ""] ?? "Invalid email or password.");
    } else {
      router.push("/admin/routine");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title="SmartRoutineHub" description="Admin sign in" accent />

          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@routinehub.local"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
              />
            </div>

            {error && <Message type="error">{error}</Message>}

            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Signing in…" : "Sign in"}
            </Button>

            <p className="text-center text-xs text-gray-400">
              Not registered yet?{" "}
              <Link href="/register" className="text-indigo-600 font-semibold hover:text-indigo-700">
                Register as a teacher
              </Link>
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
