"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { AuthPageShell, AuthMasthead } from "@/app/components/AuthPageShell";

export default function VerifyPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    document.title = "Verify Email · Routine Management System";
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const json = await res.json();
      if (json.ok) {
        setDone(true);
      } else {
        setError(json.error ?? "Verification failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthPageShell>
        <Card>
          <AuthMasthead />
          <CardHeader title="Verify Your E-mail" accent />

          {done ? (
            <div className="px-8 py-6 space-y-4">
              <Message type="success">E-mail verified.</Message>
              <Link
                href="/"
                className="block text-center w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors"
              >
                Go to homepage
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="verify-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                <input
                  id="verify-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="verify-code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Verification code
                </label>
                <input
                  id="verify-code"
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              {error && <Message type="error">{error}</Message>}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Verifying…" : "Verify e-mail"}
              </Button>
            </form>
          )}
        </Card>
    </AuthPageShell>
  );
}
