function tierColor(score: number) {
  if (score >= 80) return "#15804E";
  if (score >= 55) return "#1554F0";
  if (score >= 35) return "#A9760D";
  return "#D23C50";
}

export function ScoreRing({ score, size = 104 }: { score: number; size?: number }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = tierColor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#EEF1F7" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 700ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold tabular-nums" style={{ fontSize: size * 0.32, color }}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] text-river-ink3 -mt-0.5">/ 100</span>
      </div>
    </div>
  );
}
