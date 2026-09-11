export function ProgressBar({
  label,
  score,
  compact = false,
}: {
  label: string;
  score: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-3.5" : "mb-4.5"}>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[13.5px] font-medium text-river-ink">{label}</span>
        <span className="text-[13px] font-semibold text-river-ink2 tabular-nums">{Math.round(score)}</span>
      </div>
      <div className="h-[3px] w-full rounded-full bg-river-line overflow-hidden">
        <div
          className="h-full rounded-full bg-river-accent"
          style={{ width: `${Math.max(2, Math.min(100, score))}%`, transition: "width 700ms ease" }}
        />
      </div>
    </div>
  );
}
