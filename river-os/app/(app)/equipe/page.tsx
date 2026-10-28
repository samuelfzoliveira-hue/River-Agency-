import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Avatar, Empty, Field, PageHeader, Progress, Section } from "@/components/ui";
import { reassignTaskAction } from "@/lib/actions/tasks";
import { addUnavailabilityAction, inviteMemberAction, removeUnavailabilityAction, revokeInviteAction, updateMemberAction } from "@/lib/actions/team";
import { loadSnapshot } from "@/lib/data";
import { ROLE_LABEL, type Role } from "@/lib/db";
import { computeCapacity, LOAD_LABEL, suggestAssignee, type Granularity } from "@/lib/domain/capacity";
import { addDays, addMonths, formatBR, formatShortBR } from "@/lib/domain/dates";
import { isManager, requireCtx } from "@/lib/session";

export const metadata = { title: "Equipe e capacidade" };

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ vista?: string; data?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const manager = isManager(ctx.profile.role);
  const s = await loadSnapshot(ctx);
  const g: Granularity = sp.vista === "dia" || sp.vista === "mes" ? sp.vista : "semana";
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(sp.data ?? "") ? sp.data! : s.today;
  const staff = s.members.filter((m) => m.role !== "cliente");
  const cap = computeCapacity({ members: staff, tasks: s.tasks, unavailability: s.unavailability, granularity: g, ref, today: s.today });
  const step = g === "dia" ? 1 : g === "semana" ? 7 : 0;
  const prev = g === "mes" ? addMonths(ref, -1) : addDays(ref, -step);
  const next = g === "mes" ? addMonths(ref, 1) : addDays(ref, step);
  const cn = (id: string | null) => s.clients.find((c) => c.id === id)?.name;

  let invites: { id: string; email: string; role: Role; created_at: string }[] = [];
  if (manager) {
    const { data } = await ctx.supabase.from("invites").select("id,email,role,created_at").is("accepted_at", null).order("created_at", { ascending: false });
    invites = (data ?? []) as typeof invites;
  }
  const label = g === "dia" ? formatBR(cap.from) : `${formatShortBR(cap.from)} – ${formatShortBR(cap.to)}`;
  const tone = { disponivel: "badge-ok", atencao: "badge-warn", sobrecarregado: "badge-bad" } as const;

  return (
    <>
      <PageHeader title="Equipe e capacidade" subtitle="Ocupação = horas estimadas das tarefas abertas ÷ horas disponíveis (jornada semanal, menos férias e folgas). Cada tarefa tem a sua própria estimativa." />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link className="btn btn-sm" href={`?vista=${g}&data=${prev}`} aria-label="Anterior"><ChevronLeft size={14} /></Link>
          <span className="min-w-40 text-center text-sm font-medium">{label}</span>
          <Link className="btn btn-sm" href={`?vista=${g}&data=${next}`} aria-label="Próximo"><ChevronRight size={14} /></Link>
          <Link className="btn btn-sm" href={`?vista=${g}`}>Hoje</Link>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
          {(["dia", "semana", "mes"] as const).map((v) => <Link key={v} href={`?vista=${v}&data=${ref}`} className={`px-3 py-1.5 ${g === v ? "bg-brand text-brand-fg" : "bg-surface hover:bg-sunken"}`}>{v === "mes" ? "Mês" : v[0].toUpperCase() + v.slice(1)}</Link>)}
        </div>
      </div>

      {cap.members.length === 0 ? <Empty>Sem colaboradores ativos.</Empty> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cap.members.map((c) => {
            const periodTasks = c.open.filter((t) => (t.due_date && t.due_date >= cap.from && t.due_date <= cap.to) || (t.due_date && t.due_date < cap.from && s.today >= cap.from && s.today <= cap.to));
            const suggestion = suggestAssignee(cap.members, c.member.user_id);
            return (
              <article key={c.member.user_id} className="card card-pad">
                <div className="mb-3 flex items-start gap-3">
                  <Avatar name={c.member.full_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{c.member.full_name}</h2>
                    <p className="truncate text-xs text-muted">{[c.member.job_title, ROLE_LABEL[c.member.role as Role]].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className={`badge ${tone[c.status]}`}>{LOAD_LABEL[c.status]}</span>
                </div>
                <div className="mb-1 flex justify-between text-sm"><span className="tabular-nums">{c.planned}h planejadas de {c.available}h</span><span className="tabular-nums text-muted">{c.ratio == null ? "—" : Number.isFinite(c.ratio) ? `${Math.round(c.ratio * 100)}%` : "sem horas"}</span></div>
                <Progress value={Number.isFinite(c.ratio ?? 0) ? Math.min((c.ratio ?? 0) * 100, 100) : 100} tone={c.status === "sobrecarregado" ? "bad" : c.status === "atencao" ? "warn" : "ok"} label={`Ocupação de ${c.member.full_name}`} />
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
                  <div><dd className="text-lg font-semibold tabular-nums">{c.open.length}</dd><dt className="text-muted">abertas</dt></div>
                  <div><dd className="text-lg font-semibold tabular-nums">{c.inProgress}</dd><dt className="text-muted">em andamento</dt></div>
                  <div><dd className="text-lg font-semibold tabular-nums">{c.doneInPeriod}</dd><dt className="text-muted">concluídas</dt></div>
                  <div><dd className={`text-lg font-semibold tabular-nums ${c.late ? "text-bad" : ""}`}>{c.late}</dd><dt className="text-muted">atrasadas</dt></div>
                </dl>
                <ul className="mt-3 space-y-0.5 text-xs text-muted">
                  {c.backlogHours > 0 && <li>Inclui {c.backlogHours}h de tarefas já atrasadas.</li>}
                  {c.missingEstimate > 0 && <li className="text-warn">{c.missingEstimate} tarefa(s) sem estimativa não entram no cálculo.</li>}
                  {c.undated > 0 && <li>{c.undated} tarefa(s) sem prazo fora do cálculo por período.</li>}
                  {c.unavailableDays > 0 && <li>{c.unavailableDays} dia(s) útil(eis) indisponível(is) no período.</li>}
                  {c.loggedHours > 0 && <li>{c.loggedHours}h registradas em tarefas.</li>}
                  {c.nextDeadlines.length > 0 && <li>Próximos prazos: {c.nextDeadlines.map((t) => `${formatShortBR(t.due_date!)} ${t.title}`).join(" · ")}</li>}
                </ul>
                <details className="mt-4 border-t border-line pt-3">
                  <summary className="cursor-pointer text-sm font-medium">Tarefas do período ({periodTasks.length})</summary>
                  {periodTasks.length === 0 ? <p className="mt-2 text-xs text-muted">Nenhuma.</p> : (
                    <ul className="mt-3 space-y-3">
                      {periodTasks.map((t) => (
                        <li key={t.id} className="text-sm">
                          <Link href={`/tarefas?tarefa=${t.id}`} className="hover:underline">{t.title}</Link>
                          <span className="block text-xs text-muted">{cn(t.client_id) ?? "Interna"} · {t.due_date ? formatShortBR(t.due_date) : "sem prazo"} · {t.estimated_hours != null ? `${t.estimated_hours}h` : "sem estimativa"}</span>
                          {manager && (
                            <form action={reassignTaskAction} className="mt-1.5 flex gap-2">
                              <input type="hidden" name="id" value={t.id} />
                              <select name="assignee_id" className="input py-1 text-xs" defaultValue={suggestion && c.status === "sobrecarregado" ? suggestion.member.user_id : c.member.user_id} aria-label={`Redistribuir ${t.title}`}>
                                {staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}{m.user_id === c.member.user_id ? " (atual)" : ""}</option>)}
                              </select>
                              <SubmitButton className="btn btn-sm" pendingText="…">Redistribuir</SubmitButton>
                            </form>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {manager && c.status === "sobrecarregado" && suggestion && <p className="mt-3 text-xs text-muted">Sugestão: {suggestion.member.full_name.split(" ")[0]} tem mais folga ({Math.round((suggestion.available - suggestion.planned) * 10) / 10}h livres).</p>}
                </details>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <Section title="Indisponibilidade (férias, folgas)" hint="Reduz as horas disponíveis e recalcula a capacidade e os alertas.">
          <ActionForm action={addUnavailabilityAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
            {manager && <Field label="Colaborador" className="sm:col-span-2"><select className="input" name="user_id" defaultValue={ctx.user.id}>{staff.map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>}
            <Field label="Início"><input className="input" type="date" name="starts_on" required /></Field>
            <Field label="Fim"><input className="input" type="date" name="ends_on" required /></Field>
            <Field label="Tipo"><select className="input" name="kind"><option value="ferias">Férias</option><option value="folga">Folga</option><option value="outro">Outro</option></select></Field>
            <Field label="Observação"><input className="input" name="note" /></Field>
            <div className="sm:col-span-2"><SubmitButton>Registrar</SubmitButton></div>
          </ActionForm>
          {s.unavailability.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
              {s.unavailability.filter((u) => u.ends_on >= s.today).sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map((u, i) => {
                const row = u as typeof u & { id?: string };
                return <li key={i} className="flex items-center justify-between py-2"><span>{staff.find((m) => m.user_id === u.user_id)?.full_name} · {u.kind}<span className="block text-xs text-muted">{formatBR(u.starts_on)} a {formatBR(u.ends_on)}</span></span>
                  {row.id && <ConfirmButton action={removeUnavailabilityAction} fields={{ id: row.id }} label="Remover" message="Remover este período?" />}</li>;
              })}
            </ul>
          )}
        </Section>

        {manager && (
          <Section title="Convidar colaborador" hint="A pessoa cria a conta com este mesmo e-mail e entra automaticamente na agência com o papel escolhido.">
            <ActionForm action={inviteMemberAction} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
              <Field label="E-mail *"><input className="input" type="email" name="email" required /></Field>
              <Field label="Papel"><select className="input" name="role" defaultValue="social">{(Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== "admin" || ctx.profile.role === "admin").map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
              <div className="sm:col-span-2"><SubmitButton>Convidar</SubmitButton></div>
            </ActionForm>
            {invites.length > 0 && (
              <ul className="mt-5 divide-y divide-line border-t border-line text-sm">
                {invites.map((i) => <li key={i.id} className="flex items-center justify-between py-2"><span>{i.email}<span className="block text-xs text-muted">{ROLE_LABEL[i.role]} · pendente</span></span><ConfirmButton action={revokeInviteAction} fields={{ id: i.id }} label="Revogar" message={`Revogar o convite de ${i.email}?`} /></li>)}
              </ul>
            )}
          </Section>
        )}
      </div>

      {manager && (
        <Section title="Cargos, especialidade e jornada" hint="A jornada semanal define a capacidade (horas ÷ 5 por dia útil)." className="mt-6">
          <div className="space-y-3">
            {s.members.map((m) => (
              <details key={m.user_id} className="rounded-lg border border-line">
                <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm"><Avatar name={m.full_name} size={24} /><span className="flex-1">{m.full_name}</span><span className="text-xs text-muted">{ROLE_LABEL[m.role]} · {m.weekly_capacity_hours}h/sem</span></summary>
                <ActionForm action={updateMemberAction} className="grid gap-3 border-t border-line p-4 md:grid-cols-4">
                  <input type="hidden" name="user_id" value={m.user_id} />
                  <Field label="Nome"><input className="input" name="full_name" defaultValue={m.full_name} /></Field>
                  <Field label="Cargo"><input className="input" name="job_title" defaultValue={m.job_title ?? ""} /></Field>
                  <Field label="Especialidade"><input className="input" name="specialty" defaultValue={m.specialty ?? ""} /></Field>
                  <Field label="Horas por semana"><input className="input" name="weekly_capacity_hours" type="number" min={0} max={80} step={0.5} defaultValue={m.weekly_capacity_hours} /></Field>
                  {ctx.profile.role === "admin" && <>
                    <Field label="Papel"><select className="input" name="role" defaultValue={m.role}>{(Object.keys(ROLE_LABEL) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
                    <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={m.active} /> Ativo</label>
                  </>}
                  <div className="self-end md:col-span-2"><SubmitButton>Salvar</SubmitButton></div>
                </ActionForm>
              </details>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
