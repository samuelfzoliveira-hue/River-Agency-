import { Swot } from "@/lib/types";

const quadrants: { key: keyof Swot; title: string }[] = [
  { key: "strengths", title: "Forças" },
  { key: "weaknesses", title: "Fraquezas" },
  { key: "opportunities", title: "Oportunidades" },
  { key: "threats", title: "Ameaças" },
];

export function SwotGrid({ swot }: { swot: Swot }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-l border-river-line">
      {quadrants.map((q) => (
        <div key={q.key} className="border-r border-b border-river-line p-5">
          <h3 className="text-[11px] font-semibold tracking-[0.08em] uppercase text-river-ink3 mb-3">
            {q.title}
          </h3>
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
