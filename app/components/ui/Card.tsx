export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
      {children}
    </div>
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
    <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-4 ${accent ? "bg-gradient-to-r from-indigo-50 to-white" : ""}`}>
      <div>
        <h2 className="text-base font-semibold text-gray-800">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
