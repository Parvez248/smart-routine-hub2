export function EmptyState({ icon, message }: { icon: string; message: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-gray-300 text-4xl mb-3">{icon}</p>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}
