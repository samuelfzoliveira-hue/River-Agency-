export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const text = variant === "dark" ? "text-river-navy" : "text-white";
  const accent = variant === "dark" ? "text-river-primary" : "text-river-light";

  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect width="34" height="34" rx="9" className="fill-river-primary" />
        <path
          d="M6 20c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M6 25c2.5 0 2.5-4 5-4s2.5 4 5 4 2.5-4 5-4 2.5 4 5 4"
          stroke="white"
          strokeOpacity="0.55"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      <div className="leading-none">
        <div className={`font-display font-bold text-lg tracking-tight ${text}`}>
          River<span className={accent}>Agency</span>
        </div>
        <div
          className={`text-[10px] font-semibold tracking-[0.2em] uppercase ${
            variant === "dark" ? "text-river-blue/60" : "text-white/60"
          }`}
        >
          Diagnóstico PMM
        </div>
      </div>
    </div>
  );
}
