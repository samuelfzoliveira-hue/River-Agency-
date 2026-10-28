import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { ActivityList } from "@/components/activity";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { CriterionField, PackageFields } from "@/components/contract-fields";
import { Empty, Field, PageHeader, Progress, Section, pctTone } from "@/components/ui";
import { inviteClientUserAction } from "@/lib/actions/team";
import { addMonthTargetAction, deleteClientAction, saveContractAction, saveMonthTargetsAction, updateClientAction } from "@/lib/actions/clients";
import type { ActivityRow, ClientRow, ContentRow, ContractItemRow, ContractRow, Profile, ShootRow, StatusRow } from "@/lib/db";
import { computeClientCompetence, STATE_LABEL } from "@/lib/domain/contracts";
import { addMonths, brDate, brTime, formatBR, monthLabel, monthStart, todayBR } from "@/lib/domain/dates";
import { CRITERION_LABEL, type DeliverableType, type Target } from "@/lib/domain/types";
import { isManager, requireCtx } from "@/lib/session";

export default async function ClientPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ mes?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  const { supabase } = ctx;
  const manager = isManager(ctx.profile.role);
  const today = todayBR();
  const comp = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? `${sp.mes}-01` : monthStart(today);

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle<ClientRow>();
  if (!client) notFound();
  await supabase.rpc("ensure_monthly_targets", { p_month: comp });

  const [types, statuses, members, contracts, targets, contents, shoots, activity, fin, portalUsers, pendingInvites] = await Promise.all([
    supabase.from("deliverable_types").select("*").eq("active", true).order("position").then((r) => (r.data ?? []) as DeliverableType[]),
    supabase.from("pipeline_statuses").select("*").then((r) => (r.data ?? []) as StatusRow[]),
    supabase.from("profiles").select("*").eq("active", true).then((r) => (r.data ?? []) as Profile[]),
    supabase.from("contracts").select("*, contract_items(*)").eq("client_id", id).order("start_date", { ascending: false }).then((r) => (r.data ?? []) as (ContractRow & { contract_items: ContractItemRow[] })[]),
    supabase.from("monthly_targets").select("*").eq("client_id", id).order("competence").then((r) => (r.data ?? []) as (Target & { id: string })[]),
    supabase.from("contents").select("*").eq("client_id", id).then((r) => (r.data ?? []) as Omit<ContentRow, "approval_state">[]),
    supabase.from("shoots").select("*").eq("client_id", id).then((r) => (r.data ?? []) as ShootRow[]),
    supabase.from("activity_log").select("*").eq("client_id", id).order("created_at", { ascending: false }).limit(25).then((r) => (r.data ?? []) as ActivityRow[]),
    manager ? supabase.from("client_financials").select("monthly_value").eq("client_id", id).maybeSingle().then((r) => r.data?.monthly_value as number | undefined) : Promise.resolve(undefined),
    manager ? supabase.from("client_users").select("user_id").eq("client_id", id).then(async (r) => {
      const ids = (r.data ?? []).map((x) => x.user_id as string);
      if (!ids.length) return [] as Pick<Profile, "user_id" | "full_name" | "email">[];
      const p = await supabase.from("profiles").select("user_id,full_name,email").in("user_id", ids);
      return (p.data ?? []) as Pick<Profile, "user_id" | "full_name" | "email">[];
    }) : Promise.resolve([] as Pick<Profile, "user_id" | "full_name" | "email">[]),
    manager ? supabase.from("invites").select("email").eq("client_id", id).is("accepted_at", null).then((r) => (r.data ?? []) as { email: string }[]) : Promise.resolve([] as { email: string }[]),
  ]);
  const apr = new Map(statuses.map((s) => [s.id, s.approval_state]));
  const stName = new Map(statuses.map((s) => [s.id, s.name]));
  const all: ContentRow[] = contents.map((c) => ({ ...c, approval_state: apr.get(c.status_id) ?? null }));
  const typeName = (tid: string) => types.find((t) => t.id === tid)?.name ?? "—";
  const owner = members.find((m) => m.user_id === client.owner_id);
  const calc = (c: string) => computeClientCompetence({ clientId: id, competence: c, targets, contents: all, shoots, types, today });
  const cur = calc(comp);
  const monthTargets = targets.filter((t) => t.competence === comp);
  const monthContents = all.filter((c) => c.competence === comp);
  const monthShoots = shoots.filter((s) => s.competence === comp);
  const activeContract = contracts.find((c) => c.status === "ativo") ?? contracts[0];
  const months = [...new Set(targets.map((t) => t.competence))].sort().reverse();
  const hist = months.map((m) => ({ m, p: calc(m) }));
  const missingTypes = types.filter((t) => activeContract && !monthTargets.some((x) => x.deliverable_type_id === t.id));

  return (
    <>
      <PageHeader eyebrow={client.segment || "Cliente"} title={client.name}
        subtitle={<>{client.status !== "ativo" && <span className="badge mr-2">{client.status}</span>}Responsável: {owner?.full_name ?? "—"}{client.contract_start ? ` · cliente desde ${formatBR(client.contract_start)}` : ""}{fin !== undefined && <> · valor mensal <strong className="text-fg">{Number(fin).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</strong></>}</>}
        actions={<>
          <Link href={`/conteudos/novo?cliente=${id}&mes=${comp.slice(0, 7)}`} className="btn btn-primary"><Plus size={16} /> Novo conteúdo</Link>
          <Link href={`/captacoes?cliente=${id}`} className="btn">Captações</Link>
          <Link href={`/midia?cliente=${id}`} className="btn">Mídia</Link>
          {manager && <Link href={`/fechamento/${id}?mes=${comp.slice(0, 7)}`} className="btn">Fechamento</Link>}
        </>} />

      <div className="mb-6 flex items-center gap-2">
        <Link className="btn btn-sm" href={`?mes=${addMonths(comp, -1).slice(0, 7)}`} aria-label="Mês anterior"><ChevronLeft size={14} /></Link>
        <span className="min-w-40 text-center text-sm font-medium">{monthLabel(comp)}</span>
        <Link className="btn btn-sm" href={`?mes=${addMonths(comp, 1).slice(0, 7)}`} aria-label="Próximo mês"><ChevronRight size={14} /></Link>
        {comp !== monthStart(today) && <Link className="btn btn-sm" href="?">Mês atual</Link>}
      </div>

      <Section title="Cumprimento do contrato" hint={`${STATE_LABEL[cur.state]} · conclusão ${activeContract ? CRITERION_LABEL[monthTargets[0]?.completion_criterion ?? activeContract.completion_criterion] : "—"}`}
        action={cur.pct != null && <span className="text-2xl font-semibold tabular-nums">{cur.pct}%</span>}>
        {cur.lines.filter((l) => l.contracted > 0 || l.extras > 0 || l.delivered > 0).length === 0 ? (
          <Empty>Sem metas em {monthLabel(comp)}. {manager ? "Cadastre o contrato abaixo." : ""}</Empty>
        ) : (
          <>
            {cur.pct != null && <div className="mb-6"><Progress value={cur.pct} tone={cur.late ? "bad" : pctTone(cur.pct)} label="Cumprimento geral" /></div>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cur.lines.filter((l) => l.contracted > 0 || l.extras > 0 || l.delivered > 0).map((l) => (
                <div key={l.typeId} className="rounded-lg border border-line p-4">
                  <div className="mb-2 flex items-baseline justify-between"><span className="text-sm font-medium">{l.typeName}</span><span className="tabular-nums text-sm">{l.delivered} de {l.contracted}{l.kind === "shoot" ? " realizadas" : " concluídos"}</span></div>
                  <Progress value={l.pct ?? 0} tone={l.late ? "bad" : pctTone(l.pct)} label={`${l.typeName}: ${l.delivered} de ${l.contracted}`} />
                  <dl className="mt-3 grid grid-cols-3 gap-y-1 text-xs text-muted">
                    {l.kind === "content" && <><dt>Produzidos</dt><dd className="col-span-2 tabular-nums text-fg">{l.produced}</dd><dt>Aprovados</dt><dd className="col-span-2 tabular-nums text-fg">{l.approved}</dd><dt>Publicados</dt><dd className="col-span-2 tabular-nums text-fg">{l.published}{l.publishedLate ? ` (${l.publishedLate} fora do prazo)` : ""}</dd></>}
                    <dt>Pendentes</dt><dd className="col-span-2 tabular-nums text-fg">{l.pending}{l.inProgress ? ` · ${l.inProgress} em andamento` : ""}</dd>
                    {l.late > 0 && <><dt className="text-bad">Atrasados</dt><dd className="col-span-2 tabular-nums text-bad">{l.late}</dd></>}
                    {l.extras > 0 && <><dt>Extras</dt><dd className="col-span-2 tabular-nums text-fg">{l.extras} (fora da meta)</dd></>}
                    {l.surplus > 0 && <><dt>Excedente</dt><dd className="col-span-2 tabular-nums text-fg">{l.surplus}</dd></>}
                  </dl>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title={`Conteúdos de ${monthLabel(comp)}`} hint={`${monthContents.filter((c) => !c.cancelled_at).length} no mês`}>
          {monthContents.length === 0 ? <Empty>Nenhum conteúdo neste mês.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {monthContents.sort((a, b) => (a.publish_date ?? "9").localeCompare(b.publish_date ?? "9")).map((c) => (
                <li key={c.id}>
                  <Link href={`/conteudos/${c.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-sunken -mx-2 px-2 rounded-lg">
                    <span className="min-w-0"><span className={`block truncate ${c.cancelled_at ? "text-muted line-through" : ""}`}>{c.title}</span><span className="text-xs text-muted">{typeName(c.deliverable_type_id)}{c.is_extra ? " · extra" : ""}{c.publish_date ? ` · publ. ${formatBR(c.publish_date).slice(0, 5)}` : ""}</span></span>
                    <span className={`badge shrink-0 ${c.delivery_stage >= 4 ? "badge-ok" : ""}`}>{c.cancelled_at ? "cancelado" : stName.get(c.status_id)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title={`Captações de ${monthLabel(comp)}`}>
          {monthShoots.length === 0 ? <Empty>Nenhuma captação neste mês.</Empty> : (
            <ul className="divide-y divide-line text-sm">
              {monthShoots.map((x) => (
                <li key={x.id} className="flex items-center justify-between py-2.5"><span>{x.title}<span className="block text-xs text-muted">{formatBR(brDate(x.starts_at))} às {brTime(x.starts_at)}{x.is_extra ? " · extra" : ""}</span></span><span className={`badge ${x.status === "realizada" ? "badge-ok" : ""}`}>{x.status}</span></li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {hist.length > 0 && (
        <Section title="Histórico por competência" hint="Meses anteriores permanecem intactos, mesmo quando o contrato muda." className="mt-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="text-left text-xs text-muted"><tr><th className="py-2 font-medium">Mês</th><th className="font-medium">Entregues</th><th className="font-medium">Cumprimento</th><th className="font-medium">Situação</th></tr></thead>
              <tbody>
                {hist.map(({ m, p }) => (
                  <tr key={m} className="border-t border-line">
                    <td className="py-2"><Link className="link" href={`?mes=${m.slice(0, 7)}`}>{monthLabel(m)}</Link></td>
                    <td className="tabular-nums">{p.delivered}/{p.contracted}</td>
                    <td className="w-48 pr-4">{p.pct != null && <Progress thin value={p.pct} tone={pctTone(p.pct)} label={`Cumprimento ${m}`} />}</td>
                    <td>{STATE_LABEL[p.state]}{p.extras ? ` · ${p.extras} extra(s)` : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {manager && (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Section title="Pacote contratado" hint="Define as metas dos meses ainda sem meta gerada. Meses anteriores não são alterados.">
            <ActionForm action={saveContractAction} className="space-y-4">
              <input type="hidden" name="client_id" value={id} />
              {activeContract && <input type="hidden" name="contract_id" value={activeContract.id} />}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Início"><input className="input" type="date" name="start_date" required defaultValue={activeContract?.start_date ?? today} /></Field>
                <Field label="Encerramento"><input className="input" type="date" name="end_date" defaultValue={activeContract?.end_date ?? ""} /></Field>
                <CriterionField defaultValue={activeContract?.completion_criterion} />
                <Field label="Status do contrato">
                  <select className="input" name="status" defaultValue={activeContract?.status ?? "ativo"}><option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option></select>
                </Field>
              </div>
              <PackageFields types={types} items={activeContract?.contract_items} />
              <SubmitButton>{activeContract ? "Salvar contrato" : "Criar contrato"}</SubmitButton>
            </ActionForm>
          </Section>

          <Section title={`Metas de ${monthLabel(comp)}`} hint="Quantidades podem variar a cada mês; só este mês é alterado.">
            {monthTargets.length === 0 ? <Empty>Sem metas neste mês (contrato fora da vigência ou sem pacote).</Empty> : (
              <ActionForm action={saveMonthTargetsAction} className="space-y-3">
                <input type="hidden" name="competence" value={comp} />
                {monthTargets.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <label htmlFor={`t_${t.id}`}>{typeName(t.deliverable_type_id)} <span className="text-xs text-muted">· {CRITERION_LABEL[t.completion_criterion]}</span></label>
                    <input id={`t_${t.id}`} className="input w-24" type="number" min={0} step={1} name={`target_${t.id}`} defaultValue={t.quantity} />
                  </div>
                ))}
                <SubmitButton>Salvar metas do mês</SubmitButton>
              </ActionForm>
            )}
            {activeContract && missingTypes.length > 0 && (
              <ActionForm action={addMonthTargetAction} className="mt-5 flex flex-wrap items-end gap-3 border-t border-line pt-4">
                <input type="hidden" name="competence" value={comp} /><input type="hidden" name="contract_id" value={activeContract.id} />
                <Field label="Adicionar tipo só neste mês"><select className="input" name="deliverable_type_id">{missingTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                <Field label="Qtd."><input className="input w-20" type="number" min={0} name="quantity" defaultValue={1} /></Field>
                <SubmitButton className="btn">Adicionar</SubmitButton>
              </ActionForm>
            )}
          </Section>
        </div>
      )}

      {manager && (
        <Section title="Portal do cliente" hint="Pessoas do cliente que podem ver e aprovar apenas os conteúdos dele. Também é possível aprovar por link, sem conta." className="mt-6">
          {portalUsers.length > 0 && <ul className="mb-4 text-sm">{portalUsers.map((u) => <li key={u.user_id}>{u.full_name} <span className="text-muted">· {u.email}</span></li>)}</ul>}
          {pendingInvites.length > 0 && <ul className="mb-4 text-sm text-muted">{pendingInvites.map((i) => <li key={i.email}>{i.email} · convite pendente</li>)}</ul>}
          <ActionForm action={inviteClientUserAction} resetOnSuccess className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="client_id" value={id} />
            <Field label="E-mail da pessoa do cliente"><input className="input w-72" type="email" name="email" required /></Field>
            <SubmitButton className="btn">Liberar acesso</SubmitButton>
          </ActionForm>
        </Section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section title="Cadastro e estratégia">
          {manager ? (
            <ActionForm action={updateClientAction} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nome da empresa"><input className="input" name="name" defaultValue={client.name} required /></Field>
                <Field label="Segmento"><input className="input" name="segment" defaultValue={client.segment ?? ""} /></Field>
                <Field label="Status"><select className="input" name="status" defaultValue={client.status}><option value="ativo">Ativo</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option></select></Field>
                <Field label="Responsável"><select className="input" name="owner_id" defaultValue={client.owner_id ?? ""}><option value="">—</option>{members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select></Field>
                <Field label="Valor mensal"><input className="input" name="monthly_value" inputMode="decimal" defaultValue={fin ?? ""} /></Field>
                <Field label="Contato principal"><input className="input" name="contact_name" defaultValue={client.contacts?.[0]?.name ?? ""} /></Field>
                <Field label="Cargo do contato"><input className="input" name="contact_role" defaultValue={client.contacts?.[0]?.role ?? ""} /></Field>
                <Field label="E-mail"><input className="input" name="contact_email" defaultValue={client.contacts?.[0]?.email ?? ""} /></Field>
                <Field label="Telefone"><input className="input" name="contact_phone" defaultValue={client.contacts?.[0]?.phone ?? ""} /></Field>
                {(["instagram", "tiktok", "youtube", "site"] as const).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><input className="input" name={`social_${k}`} defaultValue={client.socials?.[k] ?? ""} /></Field>)}
              </div>
              <Field label="Observações estratégicas"><textarea className="input min-h-28" name="strategic_notes" defaultValue={client.strategic_notes ?? ""} /></Field>
              <SubmitButton>Salvar cadastro</SubmitButton>
            </ActionForm>
          ) : (
            <dl className="space-y-3 text-sm">
              <div><dt className="label">Contato</dt><dd>{client.contacts?.map((c) => `${c.name}${c.role ? ` (${c.role})` : ""}`).join(", ") || "—"}</dd></div>
              <div><dt className="label">Redes</dt><dd>{Object.entries(client.socials ?? {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</dd></div>
              <div><dt className="label">Observações estratégicas</dt><dd className="whitespace-pre-wrap">{client.strategic_notes || "—"}</dd></div>
            </dl>
          )}
          <p className="mt-4 text-xs text-muted">Arquivos e material bruto: veja o <Link href={`/midia?cliente=${id}`} className="link">banco de mídia</Link>.</p>
          {ctx.profile.role === "admin" && (
            <div className="mt-6 border-t border-line pt-4"><ConfirmButton action={deleteClientAction} fields={{ id }} label="Excluir cliente" message={`Excluir ${client.name} apaga contratos, conteúdos, tarefas e histórico. Isto não pode ser desfeito. Continuar?`} /></div>
          )}
        </Section>

        <Section title="Histórico de atividades" hint="Quem alterou o quê, e quando">
          <ActivityList items={activity} members={members} showEntity />
        </Section>
      </div>
    </>
  );
}
