import {
  Card as ShadcnCard,
  CardHeader as ShadcnCardHeader,
  CardTitle,
  CardDescription,
  CardAction,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <ShadcnCard className={cn("rounded-lg border border-border bg-card py-0 gap-0 shadow-none ring-0", className)}>
      {children}
    </ShadcnCard>
  );
}

export function CardHeader({
  title,
  description,
  accent = false,
  action,
}: {
  title: React.ReactNode;
  description?: string;
  accent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <ShadcnCardHeader
      className={cn(
        "border-b border-border py-4",
        accent && "bg-primary/5"
      )}
    >
      <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
      {description && <CardDescription className="text-xs text-muted-foreground mt-0.5">{description}</CardDescription>}
      {action && <CardAction className="shrink-0">{action}</CardAction>}
    </ShadcnCardHeader>
  );
}
