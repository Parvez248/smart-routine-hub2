function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

type ButtonVariant = "primary" | "secondary" | "danger";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm",
  secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-200",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-sm",
};

export function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-semibold px-6 py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type LinkTone = "neutral" | "primary" | "danger" | "success" | "warning";

const LINK_TONE_CLASSES: Record<LinkTone, string> = {
  neutral: "text-gray-400 hover:text-gray-600",
  primary: "text-indigo-600 hover:text-indigo-700",
  danger: "text-red-500 hover:text-red-600",
  success: "text-emerald-600 hover:text-emerald-700",
  warning: "text-amber-600 hover:text-amber-700",
};

const LINK_TONE_MUTED_CLASSES: Record<LinkTone, string> = {
  neutral: "text-gray-400 hover:text-gray-600",
  primary: "text-gray-400 hover:text-indigo-600",
  danger: "text-gray-400 hover:text-red-500",
  success: "text-gray-400 hover:text-emerald-600",
  warning: "text-gray-400 hover:text-amber-600",
};

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
      className={`text-xs font-semibold disabled:opacity-50 ${colorClasses} ${revealClasses} ${className}`}
      {...props}
    >
      {loading ? <Spinner className="h-3.5 w-3.5" /> : children}
    </button>
  );
}
