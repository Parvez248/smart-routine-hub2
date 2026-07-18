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
}: {
  title: React.ReactNode;
  description?: string;
  accent?: boolean;
}) {
  return (
    <div className={`px-6 py-4 border-b border-gray-100 ${accent ? "bg-gradient-to-r from-indigo-50 to-white" : ""}`}>
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
      {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
    </div>
  );
}
