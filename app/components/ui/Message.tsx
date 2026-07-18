export function Message({ type, children }: { type: "success" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm ${
        type === "success"
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
          : "bg-red-50 text-red-700 border border-red-200"
      }`}
    >
      <span className="text-base leading-none mt-0.5">{type === "success" ? "✓" : "⚠"}</span>
      <span>{children}</span>
    </div>
  );
}
