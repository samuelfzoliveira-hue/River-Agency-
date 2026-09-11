export function ScoreRing({ score, size = 120 }: { score: number; size?: number }) {
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  const color =
    score >= 80 ? "#12A16B" : score >= 55 ? "#1D63E8" : score >= 35 ? "#E8A400" : "#E14B4B";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="score-ring">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E6EDFB"
          strokeWidth={stroke}
          fill="none"
        />
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
          style={{ transition: "stroke-dashoffset 900ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display font-bold text-river-navy" style={{ fontSize: size * 0.3 }}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] font-medium text-river-blue/60 -mt-1">/ 100</span>
      </div>
    </div>
  );
}
