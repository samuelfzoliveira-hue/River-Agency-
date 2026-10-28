import Link from "next/link";
import { notFound } from "next/navigation";
import { ClosingPdfButton } from "@/components/closing-pdf-button";
import { ActionForm, SubmitButton } from "@/components/form";
import { Empty, Field, PageHeader, Progress, Section, pctTone } from "@/components/ui";
import { closeMonthAction, reopenMonthAction } from "@/lib/actions/closing";
import { loadClientMonth } from "@/lib/data";
import type { ClientRow, ClosingRow, Profile } from "@/lib/db";
import { buildClosing, carryOverStatus, VERDICT_LABEL } from "@/lib/domain/closing";
import { monthLabel, monthStart, todayBR } from "@/lib/domain/dates";
import { CRITERION_LABEL } from "@/lib/domain/types";
import { requireCtx } from "@/lib/session";

export default async function ClosingDetail({ params, searchParams }: { params: Promise<{ clientId: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { clientId } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx(["admin", "gestor"]);
  const { supabase } = ctx;
  const today = todayBR();
  const comp = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : monthStart(today);
  const { data: client } = await supabase.from("clients").select("id,name").eq("id", clientId).maybeSingle<Pick<ClientRow, "id" | "name">>();
  if (!client) notFound();

  const [{ calc }, { data: cl }, { data: allClosings }, { data: org }, { data: members }] = await Promise.all([
    loadClientMonth(supabase, clientId, comp),
    supabase.from("month_closings").select("*").eq("client_id", clientId).eq("competence", comp).maybeSingle(),
    supabase.from("month_closings").select("*").eq("client_id", clientId).lt("competence", comp).order("competence", { ascending: false }).limit(6),
    supabase.from("organizations").select("name").single(),
    supabase.from("profiles").select("user_id,full_name"),
  ]);
  const closing = cl as ClosingRow | null;
  const nm = (id: string | null) => (members as Pick<Profile, "user_id" | "full_name">[] | null)?.find((m) => m.user_id === id)?.full_name ?? "—";
  const live = buildClosing(calc);
  const official = closing?.status === "fechado" ? closing : null;
  const shown = official ? { snapshot: official.snapshot, pending: official.pending } : live;
  const changedAfter = official && (official.snapshot.delivered !== live.snapshot.delivered || official.snapshot.contracted !== live.snapshot.contracted);
  const isFuture = comp > monthStart(today);

  // pendências de fechamentos anteriores: mantêm a competência original; mostramos se já foram regularizadas
  const carried = await Promise.all(((allClosings ?? []) as ClosingRow[]).filter((c) => c.pending?.length).map(async (c) => {
    const { calc: l } = await loadClientMonth(supabase, clientId, c.competence);
    return { closing: c, items: carryOverStatus(c.pending, l) };
  }));

  const report = {
    agency: (org as { name: string } | null)?.name ?? "River Agency", client: client.name, competenceLabel: monthLabel(comp), snapshot: shown.snapshot, pending: shown.pending,
    status: official ? "fechado" as const : closing?.status === "reaberto" ? "reaberto" as const : "previa" as const,
    closedAt: official?.closed_at ?? null, closedBy: official ? nm(official.closed_by) : null, notes: closing?.notes ?? null,
    reopenLog: (closing?.reopen_log ?? []).map((e) => ({ at: e.at, by: nm(e.by), reason: e.reason })),
  };

  return (
    <>
      <PageHeader eyebrow={`Fechamento · ${monthLabel(comp)}`} title={client.name}
        subtitle={<>{official ? <span className="badge badge-ok mr-2">fechado em {official.closed_at.slice(0, 10).split("-").reverse().join("/")} por {nm(official.closed_by)}</span> : <span className="badge badge-warn mr-2">{closing?.status === "reaberto" ? "reaberto" : "prévia — ainda não fechado"}</span>}{VERDICT_LABEL[shown.snapshot.verdict]}</>}
        actions={<><Link href={`/fechamento?mes=${comp.slice(0, 7)}`} className="btn">Todos os clientes</Link><ClosingPdfButton report={report} filename={`fechamento-${client.name.replace(/\W+/g, "-").toLowerCase()}-${comp.slice(0, 7)}.pdf`} /></>} />

      {changedAfter && <p className="mb-6 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">Há alterações após o fechamento: hoje são {live.snapshot.delivered} de {live.snapshot.contracted} entregues, contra {official!.snapshot.delivered} de {official!.snapshot.contracted} no fechamento oficial. O relatório oficial não muda; reabra o fechamento (administrador) para atualizá-lo.</p>}

      <Section title={official ? "Resultado oficial" : "Resultado atual (prévia)"} hint={`Critério: ${calc.lines.length ? CRITERION_LABEL[calc.lines.find((l) => l.contracted > 0)?.criterion ?? "published"] : "—"} · cada conteúdo conta uma única vez; extras e cancelados ficam fora da meta`}
        action={shown.snapshot.pct != null && <span className="text-2xl font-semibold tabular-nums">{shown.snapshot.pct}%</span>}>
        {shown.snapshot.lines.length === 0 ? <Empty>Sem metas neste mês.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-medium">Entrega</th><th className="font-medium">Contratado</th><th className="font-medium">Produzido</th><th className="font-medium">Aprovado</th><th className="font-medium">Publicado</th><th className="font-medium">Entregue</th><th className="font-medium">Pendente</th><th className="font-medium">Atrasado</th><th className="font-medium">Extras</th></tr></thead>
              <tbody>{shown.snapshot.lines.map((l) => (
                <tr key={l.typeId} className="border-t border-line tabular-nums">
                  <td className="py-2.5 font-medium">{l.typeName}</td><td>{l.contracted}</td>
                  <td>{l.kind === "shoot" ? "—" : l.produced}</td><td>{l.kind === "shoot" ? "—" : l.approved}</td><td>{l.kind === "shoot" ? "—" : l.published}</td>
                  <td className="font-medium">{l.delivered}</td><td>{l.pending}</td><td className={l.late ? "text-bad" : ""}>{l.late}</td><td>{l.extras}</td>
                </tr>))}</tbody>
            </table>
            <div className="mt-4"><Progress value={shown.snapshot.pct ?? 0} tone={pctTone(shown.snapshot.pct)} label="Cumprimento geral" /></div>
            <p className="mt-2 text-xs text-muted">{shown.snapshot.delivered} de {shown.snapshot.contracted} entregues · {shown.snapshot.pending} pendentes · {shown.snapshot.extras} extras (fora da meta)</p>
          </div>
        )}
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Pendências transferidas" hint="Mantêm a competência original; não são recontadas no mês seguinte.">
          {shown.pending.length === 0 ? <Empty>Nenhuma pendência.</Empty> : (
            <ul className="space-y-2 text-sm">{shown.pending.map((p) => <li key={p.typeId} className="flex justify-between"><span>{p.quantity} × {p.typeName}</span><span className="text-muted">competência {p.competence.slice(5, 7)}/{p.competence.slice(0, 4)}</span></li>)}</ul>
          )}
          {carried.length > 0 && (
            <div className="mt-5 border-t border-line pt-4"><p className="eyebrow mb-2">De meses anteriores</p>
              <ul className="space-y-2 text-sm">{carried.flatMap(({ closing: c, items }) => items.map((i) => (
                <li key={`${c.id}${i.typeId}`} className="flex justify-between gap-3"><span>{i.quantity} × {i.typeName} <span className="text-muted">({monthLabel(c.competence)})</span></span>
                  <span className={`badge ${i.stillPending ? "badge-warn" : "badge-ok"}`}>{i.stillPending ? `${i.stillPending} ainda pendente(s)` : "regularizado"}</span></li>)))}</ul></div>
          )}
        </Section>

        <Section title={official ? "Fechamento oficial" : "Fechar o mês"}>
          {official ? (
            <>
              {official.notes && <p className="mb-4 whitespace-pre-wrap text-sm">{official.notes}</p>}
              {ctx.profile.role === "admin" ? (
                <ActionForm action={reopenMonthAction} className="space-y-3">
                  <input type="hidden" name="closing_id" value={official.id} />
                  <Field label="Justificativa para reabrir (fica registrada) *"><textarea className="input min-h-20" name="reason" required minLength={5} /></Field>
                  <SubmitButton className="btn btn-danger" pendingText="Reabrindo…">Reabrir fechamento</SubmitButton>
                </ActionForm>
              ) : <p className="text-sm text-muted">Somente administradores podem reabrir um fechamento, com justificativa.</p>}
            </>
          ) : isFuture ? <p className="text-sm text-muted">Meses futuros não podem ser fechados.</p> : calc.contracted === 0 ? <Empty>Sem metas: nada a fechar.</Empty> : (
            <ActionForm action={closeMonthAction} className="space-y-3">
              <input type="hidden" name="client_id" value={clientId} /><input type="hidden" name="competence" value={comp} />
              <Field label="Observações do fechamento (opcional)"><textarea className="input min-h-24" name="notes" placeholder="Motivos de pendências, acordos com o cliente…" /></Field>
              <p className="text-xs text-muted">Ao fechar, o resultado e as pendências são gravados. Conteúdos e tarefas continuam intactos e as metas do mês ficam travadas.</p>
              <SubmitButton pendingText="Fechando…">Fechar {monthLabel(comp)}</SubmitButton>
            </ActionForm>
          )}
          {(closing?.reopen_log?.length ?? 0) > 0 && (
            <div className="mt-5 border-t border-line pt-4"><p className="eyebrow mb-2">Reaberturas</p>
              <ul className="space-y-2 text-sm">{closing!.reopen_log.map((e, i) => <li key={i}><span className="text-muted">{e.at.slice(0, 10).split("-").reverse().join("/")} · {nm(e.by)}</span><p>{e.reason}</p></li>)}</ul></div>
          )}
        </Section>
      </div>
    </>
  );
}
