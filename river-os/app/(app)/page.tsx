import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertList } from "@/components/alert-list";
import { Avatar, Empty, PageHeader, Progress, Section, Stat, pctTone } from "@/components/ui";
import { firstName, loadSnapshot } from "@/lib/data";
import { addDays, formatBR, monthLabel, monthStart } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Visão geral" };

export default async function Dashboard() {
  const ctx = await requireCtx();
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "gestor") redirect("/meu-painel");
  const s = await loadSnapshot(ctx);
  const comp = monthStart(s.today);
  const active = s.clients.filter((c) => c.status === "ativo");

  const contracted = s.progress.reduce((a, p) => a + p.contracted, 0);
  const delivered = s.progress.reduce((a, p) => a + p.delivered, 0);
  const pending = s.progress.reduce((a, p) => a + p.pending, 0);
  const late = s.progress.reduce((a, p) => a + p.late, 0);
  const pct = contracted ? Math.round((delivered / contracted) * 100) : null;
  const inApproval = s.contents.filter((c) => c.approval_state === "aguardando" && !c.cancelled_at).length;
  const scheduled = s.contents.filter((c) => c.delivery_stage === 3 && !c.cancelled_at).length;
  const shootsScheduled = s.shoots.filter((x) => (x.status === "agendada" || x.status === "reagendada") && x.starts_at.slice(0, 10) >= s.today).length;

  const open = s.tasks.filter((t) => t.status === "todo" || t.status === "doing");
  const todayTasks = open.filter((t) => t.due_date === s.today);
  const nextTasks = open.filter((t) => t.due_date && t.due_date > s.today && t.due_date <= addDays(s.today, 7)).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const overdueTasks = open.filter((t) => t.due_date && t.due_date < s.today).length;
  const monthStartIso = `${comp}T00:00:00Z`;

  const productivity = s.members.filter((m) => m.role !== "cliente").map((m) => {
    const done = s.tasks.filter((t) => t.assignee_id === m.user_id && t.status === "done" && t.completed_at && t.completed_at >= monthStartIso).length;
    const openN = open.filter((t) => t.assignee_id === m.user_id).length;
    return { m, done, openN, total: done + openN };
  }).sort((a, b) => b.done - a.done);

  const cName = (id: string | null) => s.clients.find((c) => c.id === id)?.name;
  const who = (id: string | null) => s.members.find((m) => m.user_id === id)?.full_name;

  return (
    <>
      <PageHeader eyebrow={monthLabel(comp)} title="Visão geral da agência" subtitle="Números calculados a partir dos contratos, conteúdos, captações e tarefas cadastrados. Clique em um indicador para ver os itens." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        <Stat label="Clientes ativos" value={active.length} href="/clientes" />
        <Stat label="Entregas previstas no mês" value={contracted} sub="soma das metas contratuais" href="/clientes" />
        <Stat label="Entregas concluídas" value={delivered} tone="ok" sub="conforme o critério de cada contrato" href="/clientes" />
        <Stat label="Entregas pendentes" value={pending} href="/pipeline?aberto=1" />
        <Stat label="Entregas atrasadas" value={late} tone={late ? "bad" : undefined} sub="prazo interno ou de publicação vencido" href="/pipeline?atraso=1" />
        <Stat label="Aguardando aprovação" value={inApproval} tone={inApproval ? "warn" : undefined} href="/pipeline?aprovacao=aguardando" />
        <Stat label="Programados para publicação" value={scheduled} href="/pipeline?estagio=3" />
        <Stat label="Captações agendadas" value={shootsScheduled} href="/captacoes" />
        <Stat label="Cumprimento dos contratos" value={pct == null ? "—" : `${pct}%`} sub={pct == null ? "nenhuma meta cadastrada" : `${delivered} de ${contracted} entregas`} href="/operacoes" tone={pct != null && pct < 40 ? "warn" : undefined} />
        <Stat label="Tarefas de hoje" value={todayTasks.length} href="/tarefas?quando=hoje" />
        <Stat label="Próximos 7 dias" value={nextTasks.length} href="/tarefas?quando=semana" />
        <Stat label="Tarefas atrasadas" value={overdueTasks} tone={overdueTasks ? "bad" : undefined} href="/tarefas?quando=atrasadas" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Section title="Painel de alertas" hint="Calculados agora. Projeções são estimativas por regras operacionais." className="lg:col-span-3"
          action={<Link href="/operacoes" className="link text-xs">Central de Operações</Link>}>
          <AlertList alerts={s.alerts} limit={8} />
        </Section>

        <Section title="Contratos do mês" hint="Cumprimento por cliente" className="lg:col-span-2">
          {s.progress.filter((p) => p.contracted > 0).length === 0 ? (
            <Empty>Nenhum contrato com metas neste mês. <Link href="/clientes/novo" className="link">Cadastre um cliente</Link>.</Empty>
          ) : (
            <ul className="space-y-4">
              {s.progress.filter((p) => p.contracted > 0).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0)).map((p) => (
                <li key={p.clientId}>
                  <Link href={`/clientes/${p.clientId}`} className="block">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{cName(p.clientId)}</span>
                      <span className="shrink-0 tabular-nums text-muted">{p.delivered}/{p.contracted} · {p.pct}%</span>
                    </div>
                    <Progress value={p.pct ?? 0} tone={p.late ? "bad" : pctTone(p.pct)} label={`Cumprimento de ${cName(p.clientId)}`} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Section title="Tarefas de hoje" hint={formatBR(s.today)}>
          {todayTasks.length === 0 ? <Empty>Nada com prazo hoje.</Empty> : (
            <ul className="space-y-2.5 text-sm">
              {todayTasks.map((t) => (
                <li key={t.id}><Link href={`/tarefas?tarefa=${t.id}`} className="flex justify-between gap-3 hover:underline"><span className="truncate">{t.title}</span><span className="shrink-0 text-xs text-muted">{firstName(who(t.assignee_id) ?? "—")}</span></Link></li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Próximos 7 dias">
          {nextTasks.length === 0 ? <Empty>Sem tarefas nos próximos dias.</Empty> : (
            <ul className="space-y-2.5 text-sm">
              {nextTasks.slice(0, 8).map((t) => (
                <li key={t.id}><Link href={`/tarefas?tarefa=${t.id}`} className="flex justify-between gap-3 hover:underline"><span className="truncate">{t.title}</span><span className="shrink-0 text-xs text-muted">{formatBR(t.due_date).slice(0, 5)} · {firstName(who(t.assignee_id) ?? "—")}</span></Link></li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="Produtividade por colaborador" hint="Tarefas concluídas no mês × em aberto">
          {productivity.length === 0 ? <Empty>Sem colaboradores.</Empty> : (
            <ul className="space-y-3">
              {productivity.map(({ m, done, openN, total }) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.full_name} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between text-sm"><span className="truncate">{firstName(m.full_name)}</span><span className="tabular-nums text-muted">{done} concl. · {openN} abertas</span></div>
                    <Progress thin value={total ? (done / total) * 100 : 0} tone="ok" label={`Produtividade de ${m.full_name}`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}
