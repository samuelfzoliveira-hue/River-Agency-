export function ProgressBar({
  label,
  score,
  compact = false,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  const color =
    score >= 80 ? "bg-river-success" : score >= 55 ? "bg-river-primary" : score >= 35 ? "bg-river-warn" : "bg-river-danger";

  return (
    <div className={compact ? "mb-3" : "mb-4"}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-river-navy">{label}</span>
        <span className="text-sm font-semibold text-river-navy">{Math.round(score)}/100</span>
      </div>
      <div className="h-2.5 w-full rounded-full bar-track overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, transition: "width 900ms ease" }}
        />
      </div>
    </div>
  );
}
