function tierColor(score: number) {
  if (score >= 80) return "bg-river-good";
  if (score >= 55) return "bg-river-accent";
  if (score >= 35) return "bg-river-warn";
  return "bg-river-bad";
}

export function ProgressBar({
  label,
  score,
  compact = false,
  semantic = true,
}: {
  label: string;
  score: number;
  compact?: boolean;
  semantic?: boolean;
}) {
  return (
    <div className={compact ? "mb-3.5" : "mb-4.5"}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13.5px] font-medium text-river-ink">{label}</span>
        <span className="text-[13px] font-semibold text-river-ink2 tabular-nums">{Math.round(score)}</span>
      </div>
      <div className="h-[4px] w-full rounded-full bg-river-line overflow-hidden">
        <div
          className={`h-full rounded-full ${semantic ? tierColor(score) : "bg-river-accent"}`}
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, transition: "width 700ms ease" }}
        />
      </div>
    </div>
  );
}
