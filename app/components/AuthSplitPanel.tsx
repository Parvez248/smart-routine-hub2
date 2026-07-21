// Shared shell for every pre-login page (login chooser + role logins, register,
// verify): a full-height brand-gradient panel with a faint timetable-grid pattern
// on one side, the form on a clean card on the other. On mobile the gradient
// collapses to a slim banner above the form, per the vivid redesign spec.
export function AuthSplitPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div
        className="on-gradient print:hidden relative shrink-0 h-28 md:h-auto md:w-2/5 flex items-center justify-center overflow-hidden"
        style={{ backgroundImage: "linear-gradient(135deg, var(--brand-from), var(--brand-to))" }}
      >
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative text-center px-6">
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
