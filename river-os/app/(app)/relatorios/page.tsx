import Link from "next/link";
import { Download } from "lucide-react";
import { FilterForm } from "@/components/form";
import { ReportPdfButton } from "@/components/report-pdf-button";
import { Empty, Field, PageHeader, Section, Stat } from "@/components/ui";
import { formatBR } from "@/lib/domain/dates";
import { reportSections } from "@/lib/report-sections";
import { loadReport, parseFilters } from "@/lib/reports-data";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Relatórios" };

export default async function Reports({ searchParams }: { searchParams: Promise<{ de?: string; ate?: string; cliente?: string; resp?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx(["admin", "gestor"]);
  const f = parseFilters(sp);
  const r = await loadReport(ctx, f);
  const sections = reportSections(r);
  const qs = new URLSearchParams({ de: f.from, ate: f.to, ...(f.clientId ? { cliente: f.clientId } : {}), ...(f.userId ? { resp: f.userId } : {}) }).toString();
  const clientName = f.clientId ? r.clients.find((c) => c.id === f.clientId)?.name : null;
  const userName = f.userId ? r.members.find((m) => m.user_id === f.userId)?.full_name : null;
  const filtersLabel = `Período ${formatBR(f.from)} a ${formatBR(f.to)} · Cliente: ${clientName ?? "todos"} · Colaborador: ${userName ?? "todos"}`;
  const agency = (await ctx.supabase.from("organizations").select("name").single()).data?.name ?? "River Agency";
  const t = r.delivery.totals;

  return (
    <>
      <PageHeader title="Relatórios operacionais" subtitle="Calculados a partir dos mesmos registros do restante da plataforma. Exporte cada tabela em CSV (Excel pt-BR) ou o relatório completo em PDF."
        actions={<ReportPdfButton agency={agency} periodLabel={`${formatBR(f.from)} a ${formatBR(f.to)}`} filtersLabel={filtersLabel} sections={sections} filename={`river-os-relatorio-${f.from}_${f.to}.pdf`} />} />
      <FilterForm className="mb-6 flex flex-wrap items-end gap-3">
        <Field label="De"><input className="input" type="date" name="de" defaultValue={f.from} /></Field>
        <Field label="Até"><input className="input" type="date" name="ate" defaultValue={f.to} /></Field>
        <Field label="Cliente"><select className="input w-48" name="cliente" defaultValue={f.clientId ?? ""}><option value="">Todos</option>{r.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
        <Field label="Equipe"><select className="input w-48" name="resp" defaultValue={f.userId ?? ""}><option value="">Todos</option>{r.members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>
      </FilterForm>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Entregas previstas" value={t.contracted} />
        <Stat label="Entregas realizadas" value={t.delivered} tone="ok" />
        <Stat label="Cumprimento" value={t.pct == null ? "—" : `${t.pct}%`} />
        <Stat label="Aprovados" value={r.production.approved} />
        <Stat label="Publicados" value={r.production.published} sub={r.production.publishedLate ? `${r.production.publishedLate} fora do prazo` : undefined} />
        <Stat label="Captações realizadas" value={r.production.shootsDone} />
      </div>

      <div className="space-y-6">
        {sections.map((s) => (
          <Section key={s.key} title={s.title} hint={s.hint}
            action={<Link href={`/relatorios/csv?secao=${s.key}&${qs}`} className="btn btn-sm" prefetch={false}><Download size={14} /> CSV</Link>}>
            {s.rows.length === 0 ? <Empty>Sem dados no período.</Empty> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted"><tr>{s.headers.map((h) => <th key={h} className="whitespace-nowrap py-2 pr-4 font-medium">{h}</th>)}</tr></thead>
                  <tbody>{s.rows.map((row, i) => (
                    <tr key={i} className={`border-t border-line tabular-nums ${s.key === "etapas" && row[6] === "sim" ? "bg-warn/10" : ""}`}>
                      {row.map((c, j) => <td key={j} className={`py-2 pr-4 ${j === 0 ? "font-medium" : ""} ${j === 6 && c === "sim" ? "font-semibold text-warn" : ""}`}>{c ?? "—"}</td>)}
                    </tr>))}</tbody>
                </table>
              </div>
            )}
          </Section>
        ))}
      </div>
    </>
  );
}
