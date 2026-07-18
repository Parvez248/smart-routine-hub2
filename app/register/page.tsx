"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

type RegisterForm = { name: string; email: string; password: string; initials: string };
const emptyForm: RegisterForm = { name: "", email: "", password: "", initials: "" };

export default function RegisterPage() {
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [step, setStep] = useState<"form" | "code" | "done">("form");
  const [devCode, setDevCode] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [code, setCode] = useState("");
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Card>
          <CardHeader title="SmartRoutineHub" description="Teacher registration" accent />

          {step === "form" && (
            <form onSubmit={handleRegister} className="px-8 py-6 space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Md. Khaled Parvez"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="At least 8 characters"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Initials</label>
                <input
                  type="text"
                  required
                  value={form.initials}
                  onChange={(e) => setForm((f) => ({ ...f, initials: e.target.value }))}
                  placeholder="e.g. MKP"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                />
              </div>

              {error && <Message type="error">{error}</Message>}

              <Button type="submit" loading={loading} className="w-full">
                {loading ? "Registering…" : "Register"}
              </Button>

              <p className="text-center text-xs text-gray-400">
                Already have an account?{" "}
                <Link href="/login" className="text-indigo-600 font-semibold hover:text-indigo-700">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {step === "code" && (
            <form onSubmit={handleVerify} className="px-8 py-6 space-y-4">
              <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 text-amber-800 border border-amber-200">
                <p className="font-semibold">Dev mode: your code is {devCode}</p>
                <p className="text-xs mt-1 text-amber-700">
                  In production this would be e-mailed to {registeredEmail}.
                </p>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Verification code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="123456"
                  className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
                href="/login"
                className="block text-center w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors shadow-sm"
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
