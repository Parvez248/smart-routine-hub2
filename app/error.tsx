"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-6">
      <div className="text-center max-w-sm">
        <p className="text-sm font-semibold text-cancelled">Error</p>
        <h1 className="mt-2 text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate">
          An unexpected error occurred. You can try again, or head back and retry from there.
        </p>
        <button
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 hover:opacity-90 transition-opacity focus-visible:outline-none"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
