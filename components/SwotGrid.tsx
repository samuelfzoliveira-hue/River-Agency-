import { Swot } from "@/lib/types";

const quadrants: {
  key: keyof Swot;
  title: string;
  bg: string;
  border: string;
  dot: string;
}[] = [
  { key: "strengths", title: "Forças", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
  { key: "weaknesses", title: "Fraquezas", bg: "bg-rose-50", border: "border-rose-200", dot: "bg-rose-500" },
  { key: "opportunities", title: "Oportunidades", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-river-primary" },
  { key: "threats", title: "Ameaças", bg: "bg-amber-50", border: "border-amber-200", dot: "bg-amber-500" },
];

export function SwotGrid({ swot }: { swot: Swot }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {quadrants.map((q) => (
        <div key={q.key} className={`rounded-xl border ${q.border} ${q.bg} p-5`}>
          <h3 className="text-xs font-bold tracking-wide uppercase text-river-navy/70 mb-3">
            {q.title}
          </h3>
          <ul className="space-y-2">
            {swot[q.key]?.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-river-navy/90 leading-snug">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${q.dot}`} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
