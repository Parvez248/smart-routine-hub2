export function EmptyState({ icon, message, action }: { icon: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-gray-300 text-4xl mb-3">{icon}</p>
      <p className="text-gray-400 text-sm">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
