export function Logo({
  variant = "dark",
  subtitle = "Diagnóstico de Perfil",
}: {
  variant?: "dark" | "light";
  subtitle?: string;
}) {
  const ink = variant === "dark" ? "text-river-ink" : "text-white";
  const faint = variant === "dark" ? "text-river-ink3" : "text-white/55";

  return (
    <div className="leading-none select-none">
      <div className={`font-bold text-[15px] tracking-tight ${ink}`}>
        River <span className="text-river-accent">Agency</span>
      </div>
      <div className={`text-[10px] tracking-[0.16em] uppercase font-medium ${faint}`}>{subtitle}</div>
    </div>
  );
}
