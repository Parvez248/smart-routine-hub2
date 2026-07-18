export function Loading({ message = "Loading…" }: { message?: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <svg className="animate-spin h-6 w-6 mx-auto text-gray-300" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
      </svg>
      <p className="text-gray-400 text-sm mt-3">{message}</p>
    </div>
  );
}
