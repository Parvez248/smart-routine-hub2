"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/app/components/ui/PageHeader";
import { Card, CardHeader } from "@/app/components/ui/Card";
import { Button } from "@/app/components/ui/Button";
import { Message } from "@/app/components/ui/Message";

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

      <Card>
        <CardHeader title="New Password" accent />
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-w-sm">
          <div className="flex flex-col gap-1">
            <label htmlFor="current-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Current Password
            </label>
            <input
              id="current-password"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="new-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="confirm-password" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="border border-border bg-muted rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
            />
          </div>

          {error && <Message type="error">{error}</Message>}
          {success && <Message type="success">Password changed. Redirecting…</Message>}

          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : "Change Password"}
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
