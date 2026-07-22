import { APP_NAME, APP_SUBTITLE } from "@/lib/config/app";

// Shared shell for every pre-login page (login chooser + role logins, register,
// verify): one plain page, single centred card. No side panel, no illustration,
// no background image — the previous split layout filled the viewport and hid
// the form, so it's gone for good.
export function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-[380px]">{children}</div>
    </div>
  );
}

// Small text header inside the card: product name, subtitle, then the
// page's own role heading (rendered by the caller right after this).
export function AuthMasthead() {
  return (
    <div className="px-6 pt-6 text-center">
      <p className="font-heading text-xl font-semibold text-foreground">{APP_NAME}</p>
      <p className="text-[13px] text-muted-foreground mt-1">{APP_SUBTITLE}</p>
    </div>
  );
}
