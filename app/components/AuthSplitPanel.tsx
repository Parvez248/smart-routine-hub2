// Shared shell for every pre-login page (login chooser + role logins, register,
// verify): a flat --band-1 panel, the form on a clean card on the other side.
// No gradients, no texture — flat colour and a hairline border do the work.
// On mobile the panel collapses to a slim banner above the form.
export function AuthSplitPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="on-band print:hidden shrink-0 h-28 md:h-auto md:w-2/5 flex items-center justify-center bg-band-1 border-b md:border-b-0 md:border-r border-primary">
        <div className="text-center px-6">
          <p className="font-heading text-2xl font-bold text-white">SmartRoutineHub</p>
          <p className="text-white/80 text-sm mt-1 hidden md:block max-w-[220px]">
            Routine Management System — Hamdard University Bangladesh, Dept. of CSE
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-canvas px-4 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
