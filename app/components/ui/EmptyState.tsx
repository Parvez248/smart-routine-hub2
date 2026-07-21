export function EmptyState({ icon, message, action }: { icon: string; message: string; action?: React.ReactNode }) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-muted-foreground/50 text-4xl mb-3">{icon}</p>
      <p className="text-muted-foreground text-sm">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
