import { cn } from "@/lib/utils";

// One small vocabulary, used everywhere a state is shown, so the same state
// always looks the same: Active · Cancelled · Moved · Pending · Approved ·
// Rejected · Free · In use.
export type Status = "Active" | "Cancelled" | "Moved" | "Pending" | "Approved" | "Rejected" | "Free" | "In use";

const STATUS_STYLES: Record<Status, string> = {
  Active: "bg-confirmed/10 text-confirmed",
  Approved: "bg-confirmed/10 text-confirmed",
  Free: "bg-confirmed/10 text-confirmed",
  Cancelled: "bg-cancelled/10 text-cancelled",
  Rejected: "bg-cancelled/10 text-cancelled",
  Moved: "bg-moved/10 text-moved",
  Pending: "bg-moved/10 text-moved",
  "In use": "bg-muted text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <>
      <span
        className={cn(
          "print:hidden inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap",
          STATUS_STYLES[status],
          className
        )}
      >
        {status}
      </span>
      <span className={cn("hidden print:inline text-xs font-semibold", className)}>[{status}]</span>
    </>
  );
}
