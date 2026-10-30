import Link from "next/link";
import { ESTIMATE_NOTE, type OpsAlert } from "@/lib/domain/alerts";
import { Empty, LevelBadge } from "./ui";

export function AlertList({ alerts, limit }: { alerts: OpsAlert[]; limit?: number }) {
  if (alerts.length === 0) return <Empty>Nenhum alerta no momento. Tudo dentro dos limites configurados.</Empty>;
  const shown = limit ? alerts.slice(0, limit) : alerts;
  return (
    <>
      <ul className="divide-y divide-line">
        {shown.map((a) => (
          <li key={a.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2">
              <LevelBadge level={a.level} />
              {a.estimated && <span className="badge" title={ESTIMATE_NOTE}>estimativa</span>}
            </div>
            <p className="text-sm font-medium leading-snug">{a.title}</p>
            <p className="text-xs text-muted">{a.message}</p>
            <Link href={a.action.href} className="link w-fit text-xs">Ação recomendada: {a.action.label} →</Link>
          </li>
        ))}
      </ul>
      {limit && alerts.length > limit && <p className="mt-3 text-xs text-muted">+ {alerts.length - limit} alertas na <Link href="/operacoes" className="link">Central de Operações</Link>.</p>}
      {alerts.some((a) => a.estimated) && <p className="mt-3 text-[11px] text-muted">{ESTIMATE_NOTE}</p>}
    </>
  );
}
