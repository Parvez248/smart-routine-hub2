import { Loader2 } from "lucide-react";
import { Button as ShadcnButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_MAP: Record<ButtonVariant, "default" | "outline" | "destructive"> = {
  primary: "default",
  secondary: "outline",
  danger: "destructive",
};

// Primary buttons carry the one brand gradient in the app — never a second gradient
// direction, never on secondary/destructive actions. Buttons never print (Step 24).
const GRADIENT_PRIMARY =
  "print:hidden bg-brand-gradient text-white border-transparent shadow-tinted hover:opacity-90 hover:-translate-y-0.5 transition-[opacity,transform]";

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <ShadcnButton
      variant={VARIANT_MAP[variant]}
      disabled={disabled || loading}
      className={cn("h-9 px-6 text-sm font-medium gap-2", variant === "primary" && GRADIENT_PRIMARY, className)}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </ShadcnButton>
  );
}

type LinkTone = "neutral" | "primary" | "danger" | "success" | "warning";

const LINK_TONE_CLASSES: Record<LinkTone, string> = {
  neutral: "text-slate hover:text-ink",
  primary: "text-primary hover:opacity-80",
  danger: "text-cancelled hover:opacity-80",
  success: "text-confirmed hover:opacity-80",
  warning: "text-moved hover:opacity-80",
};

const LINK_TONE_MUTED_CLASSES: Record<LinkTone, string> = {
  neutral: "text-slate hover:text-ink",
  primary: "text-slate hover:text-primary",
  danger: "text-slate hover:text-cancelled",
  success: "text-slate hover:text-confirmed",
  warning: "text-slate hover:text-moved",
};

function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}

export function LinkButton({
  tone = "neutral",
  muted = false,
  revealOnHover = false,
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: LinkTone;
  muted?: boolean;
  revealOnHover?: boolean;
  loading?: boolean;
}) {
  const colorClasses = muted ? LINK_TONE_MUTED_CLASSES[tone] : LINK_TONE_CLASSES[tone];
  const revealClasses = revealOnHover ? "opacity-0 group-hover:opacity-100 transition-opacity" : "transition-colors";
  return (
    <button
      disabled={disabled || loading}
      className={cn("text-xs font-semibold disabled:opacity-50", colorClasses, revealClasses, className)}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : children}
    </button>
  );
}
