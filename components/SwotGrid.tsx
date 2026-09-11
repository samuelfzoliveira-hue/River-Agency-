import { Swot } from "@/lib/types";

const quadrants: { key: keyof Swot; title: string; bg: string; line: string; text: string }[] = [
  { key: "strengths", title: "Forças", bg: "bg-river-goodSoft", line: "border-river-goodLine", text: "text-river-good" },
  { key: "weaknesses", title: "Fraquezas", bg: "bg-river-badSoft", line: "border-river-badLine", text: "text-river-bad" },
  { key: "opportunities", title: "Oportunidades", bg: "bg-river-accentSoft", line: "border-blue-200", text: "text-river-accentDeep" },
  { key: "threats", title: "Ameaças", bg: "bg-river-warnSoft", line: "border-river-warnLine", text: "text-river-warn" },
];

export function SwotGrid({ swot }: { swot: Swot }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {quadrants.map((q) => (
        <div key={q.key} className={`rounded-xl border ${q.line} ${q.bg} p-5`}>
          <h3 className={`text-[11px] font-bold tracking-[0.08em] uppercase mb-3 ${q.text}`}>{q.title}</h3>
          <ul className="space-y-2">
            {swot[q.key]?.map((item, i) => (
              <li key={i} className="text-[13.5px] text-river-ink leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
