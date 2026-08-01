"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

function PasswordField({
  id, label, value, onChange, minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full border border-border bg-muted rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate hover:text-foreground"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          tabIndex={-1}
        >
          {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export default function ChangePasswordPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const forced = Boolean(session?.user?.mustChangePassword);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/teacher/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (json.ok) {
        setSuccess(true);
        await update();
        router.push("/teacher/classes");
      } else {
        setError(json.error ?? "Failed to change password.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Change Password"
        description={
          forced
            ? "You must set a new password before you can continue."
            : "Update the password you use to sign in."
        }
      />

      <div className="max-w-md mx-auto w-full">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" aria-hidden="true" />
                New Password
              </span>
            }
            accent
          />
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <PasswordField id="current-password" label="Current Password" value={currentPassword} onChange={setCurrentPassword} />
            <PasswordField id="new-password" label="New Password" value={newPassword} onChange={setNewPassword} minLength={8} />
            <PasswordField id="confirm-password" label="Confirm New Password" value={confirmPassword} onChange={setConfirmPassword} minLength={8} />

            {error && <Message type="error">{error}</Message>}
            {success && <Message type="success">Password changed. Redirecting…</Message>}

            <div className="flex justify-end">
              <Button type="submit" loading={submitting}>
                {submitting ? "Saving…" : "Change Password"}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
