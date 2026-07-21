"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

type RegisterForm = { name: string; email: string; password: string; initials: string };
const emptyForm: RegisterForm = { name: "", email: "", password: "", initials: "" };

export default function RegisterTeacherPage() {
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [devCode, setDevCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    document.title = "Teacher Registration · Routine Management System";
  }, []);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        setDevCode(json.data.devVerifyCode);
        setRegisteredEmail(json.data.email);
        setStep("code");
      } else {
        setError(json.error ?? "Registration failed.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: registeredEmail, code }),
      });
      const json = await res.json();
      if (json.ok) {
        setStep("done");
      } else {
        setVerifyError(json.error ?? "Verification failed.");
      }
    } catch {
      setVerifyError("Network error. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title="SmartRoutineHub" description="Teacher registration" accent />

          {step === "form" && (
            <form onSubmit={handleRegister} className="px-8 py-6 space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="register-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</label>
                <input
                  id="register-name"
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Md. Khaled Parvez"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</label>
                <input
                  id="register-email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Password</label>
                <input
                  id="register-password"
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-initials" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Initials</label>
                <input
                  id="register-initials"
                  type="text"
                  required
                  value={form.initials}
                  onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
                  placeholder="e.g. MKP"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              {error && <Message type="error">{error}</Message>}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Registering…" : "Register"}
              </Button>

              <p className="text-center text-xs text-slate">
                Already have an account?{" "}
                <Link href="/login/teacher" className="text-primary font-semibold hover:opacity-80">
                  Sign in
                </Link>
              </p>
              <p className="text-center text-xs text-slate">
                Registering as a student instead?{" "}
                <Link href="/register/student" className="text-primary font-semibold hover:opacity-80">
                  Register as a student
                </Link>
              </p>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerify} className="px-8 py-6 space-y-4">
              <div className="rounded-lg px-4 py-3 text-sm bg-moved/10 text-moved border border-moved/20">
                <p className="font-semibold">Dev mode: your code is {devCode}</p>
                <p className="text-xs mt-1 text-moved">
                  In production this would be e-mailed to {registeredEmail}.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Verification code
                </label>
                <input
                  id="register-code"
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              {verifyError && <Message type="error">{verifyError}</Message>}

              <Button type="submit" loading={verifyLoading} className="w-full">
                {verifyLoading ? "Verifying…" : "Verify e-mail"}
              </Button>
            </form>
          )}

          {step === "done" && (
            <div className="px-8 py-6 space-y-4">
              <Message type="success">E-mail verified. Your account is now awaiting admin approval.</Message>
              <Link
                href="/login/teacher"
                className="block text-center w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
