"use client";

import { useEffect } from "react";
import { toast } from "sonner";

// Renders nothing itself — mounting/updating fires a sonner toast instead of an
// inline banner. Callers keep using `{status && <Message type={...}>{msg}</Message>}`
// exactly as before; <Toaster /> in the root layout renders the actual UI.
export function Message({ type, children }: { type: "success" | "error"; children: React.ReactNode }) {
  useEffect(() => {
    if (type === "success") {
      toast.success(children);
    } else {
      toast.error(children);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, children]);

  return null;
}
