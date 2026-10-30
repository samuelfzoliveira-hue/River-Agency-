import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Empty, PageHeader, Progress, pctTone } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import type { ClosingRow } from "@/lib/db";
import { STATE_LABEL } from "@/lib/domain/contracts";
import { addMonths, monthLabel, monthStart, todayBR } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Fechamento mensal" };

export default async function ClosingList({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx(["admin", "gestor"]);
  const today = todayBR();
  const comp = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : addMonths(monthStart(today), -1);
  const s = await loadSnapshot(ctx, comp);
  const { data } = await ctx.supabase.from("month_closings").select("*").eq("competence", comp);
  const closings = (data ?? []) as ClosingRow[];
  const rows = s.clients.filter((c) => c.status === "ativo").map((c) => ({ c, p: s.progress.find((x) => x.clientId === c.id)!, cl: closings.find((x) => x.client_id === c.id) }));
  const withGoals = rows.filter((r) => r.p && r.p.contracted > 0);
  const done = withGoals.filter((r) => r.p.pending === 0).length;
  const incomplete = withGoals.length - done;
  const closed = withGoals.filter((r) => r.cl?.status === "fechado").length;
  const isFuture = comp > monthStart(today);

  return (
    <>
      <PageHeader title="Fechamento mensal" subtitle="Cumprimento de cada contrato na competência. Fechar registra o resultado oficial e as pendências; nada é apagado." />
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link className="btn btn-sm" href={`?mes=${addMonths(comp, -1).slice(0, 7)}`} aria-label="Mês anterior"><ChevronLeft size={14} /></Link>
          <span className="min-w-40 text-center text-sm font-medium">{monthLabel(comp)}</span>
          <Link className="btn btn-sm" href={`?mes=${addMonths(comp, 1).slice(0, 7)}`} aria-label="Próximo mês"><ChevronRight size={14} /></Link>
        </div>
        <p className="text-sm text-muted">{done} cumpridos · {incomplete} incompletos · {closed} fechados de {withGoals.length}</p>
      </div>
      {withGoals.length === 0 ? <Empty>Nenhum contrato com metas em {monthLabel(comp)}.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="px-4 py-3 font-medium">Cliente</th><th className="font-medium">Entregues</th><th className="w-44 font-medium">Cumprimento</th><th className="font-medium">Situação</th><th className="font-medium">Fechamento</th><th /></tr></thead>
            <tbody>
              {withGoals.sort((a, b) => (a.p.pct ?? 0) - (b.p.pct ?? 0)).map(({ c, p, cl }) => (
                <tr key={c.id} className="border-t border-line">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="tabular-nums">{p.delivered}/{p.contracted}{p.extras ? <span className="text-xs text-muted"> +{p.extras} extra(s)</span> : null}</td>
                  <td className="pr-4"><Progress thin value={p.pct ?? 0} tone={p.late ? "bad" : pctTone(p.pct)} label={`Cumprimento de ${c.name}`} /></td>
                  <td>{p.pending === 0 ? <span className="badge badge-ok">Completo</span> : <span className={`badge ${p.late ? "badge-bad" : "badge-warn"}`}>{p.late ? "Com atrasos" : STATE_LABEL[p.state] === STATE_LABEL.incompleto ? "Incompleto" : "Pendências"} · faltam {p.pending}</span>}</td>
                  <td>{cl ? <span className={`badge ${cl.status === "fechado" ? "badge-ok" : "badge-warn"}`}>{cl.status}</span> : <span className="badge">{isFuture ? "—" : "aberto"}</span>}</td>
                  <td className="pr-4 text-right"><Link className="link" href={`/fechamento/${c.id}?mes=${comp.slice(0, 7)}`}>{cl?.status === "fechado" ? "Ver relatório" : "Revisar e fechar"}</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
