"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";
import { AuthSplitPanel } from "@/app/components/AuthSplitPanel";

type Batch = { id: number; name: string; semester: string };

type RegisterForm = { name: string; email: string; password: string; batchId: string; studentId: string };
const emptyForm: RegisterForm = { name: "", email: "", password: "", batchId: "", studentId: "" };

export default function RegisterStudentPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [devCode, setDevCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  useEffect(() => {
    document.title = "Student Registration · Routine Management System";
  }, []);

  useEffect(() => {
    fetch("/api/public/batches")
      .then((res) => res.json())
      .then((json) => { if (json.ok) setBatches(json.data); });
  }, []);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register-student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          batchId: Number(form.batchId),
          studentId: form.studentId.trim() || null,
        }),
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
    <AuthSplitPanel>
        <Card>
          <CardHeader title="SmartRoutineHub" description="Student registration" accent />

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
                  placeholder="e.g. Jamal Uddin"
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
                <label htmlFor="register-batch" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batch</label>
                <select
                  id="register-batch"
                  required
                  value={form.batchId}
                  onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
                  className="w-full border border-border bg-muted rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                >
                  <option value="">Select batch</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} — {b.semester} sem</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="register-student-id" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Student ID <span className="text-slate/60 normal-case font-normal">(optional)</span>
                </label>
                <input
                  id="register-student-id"
                  type="text"
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                  placeholder="e.g. 2021-1-60-001"
                  className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
                />
              </div>

              {error && <Message type="error">{error}</Message>}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Registering…" : "Register"}
              </Button>

              <p className="text-center text-xs text-slate">
                Already have an account?{" "}
                <Link href="/login/student" className="text-primary font-semibold hover:opacity-80">
                  Sign in
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
              <Message type="success">E-mail verified. You can sign in now — no approval needed.</Message>
              <Link
                href="/login/student"
                className="block text-center w-full bg-primary hover:opacity-90 text-primary-foreground font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
              >
                Go to sign in
              </Link>
            </div>
          )}
        </Card>
    </AuthSplitPanel>
  );
}
