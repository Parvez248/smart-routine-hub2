type ColumnHeader = string | { label: string; className?: string };

export function Table({
  headers,
  children,
}: {
  headers: ColumnHeader[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-gray-400 text-xs uppercase tracking-wide">
            {headers.map((h, i) => {
              const label = typeof h === "string" ? h : h.label;
              const className = typeof h === "string" ? "" : h.className ?? "";
              return (
                <th key={i} className={`px-5 py-3 text-left font-semibold ${className}`}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">{children}</tbody>
      </table>
    </div>
  );
}
