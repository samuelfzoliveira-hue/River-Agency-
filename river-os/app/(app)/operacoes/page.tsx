import Link from "next/link";
import { AlertList } from "@/components/alert-list";
import { Empty, PageHeader, Progress, RowLink, Section, pctTone } from "@/components/ui";
import { firstName, loadSnapshot } from "@/lib/data";
import { LOAD_LABEL } from "@/lib/domain/capacity";
import { buildCalendarItems, KIND_LABEL } from "@/lib/domain/calendar";
import { addDays, brDate, brTime, diffDays, formatBR, formatShortBR } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Central de Operações" };

export default async function Operations() {
  const ctx = await requireCtx(["admin", "gestor"]);
  const s = await loadSnapshot(ctx);
  const cName = (id: string | null) => s.clients.find((c) => c.id === id)?.name ?? "—";
  const who = (id: string | null) => firstName(s.members.find((m) => m.user_id === id)?.full_name ?? "Sem responsável");
  const open = s.tasks.filter((t) => t.status === "todo" || t.status === "doing");
  const activeIds = new Set(s.clients.filter((c) => c.status === "ativo").map((c) => c.id));
  const liveContents = s.contents.filter((c) => !c.cancelled_at && activeIds.has(c.client_id));

  // 1. hoje
  const todayTasks = open.filter((t) => t.due_date === s.today);
  const todayContents = liveContents.filter((c) => c.delivery_stage < 4 && (c.internal_deadline === s.today || c.publish_date === s.today));
  const todayShoots = s.shoots.filter((x) => (x.status === "agendada" || x.status === "reagendada") && brDate(x.starts_at) === s.today);
  // 2. atrasado
  const lateTasks = open.filter((t) => t.due_date && t.due_date < s.today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const lateContents = liveContents.filter((c) => c.delivery_stage < 4 && ((c.internal_deadline && c.internal_deadline < s.today && c.delivery_stage < 1) || (c.publish_date && c.publish_date < s.today)));
  // 3. risco
  const risks = s.alerts.filter((a) => a.estimated || a.kind === "risco");
  // 4. sobrecarga
  const loaded = s.weekCapacity.filter((c) => c.status !== "disponivel").sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));
  // 5. contratos incompletos
  const incomplete = s.progress.filter((p) => p.contracted > 0 && p.pending > 0).sort((a, b) => (a.pct ?? 0) - (b.pct ?? 0));
  // 6. aprovação
  const waiting = liveContents.filter((c) => c.approval_state === "aguardando").sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at));
  // 7. captações
  const shootsTodo = s.shoots.filter((x) => (x.status === "agendada" || x.status === "reagendada") && activeIds.has(x.client_id)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  // 8. próximos 7 dias
  const end = addDays(s.today, 7);
  const upcoming = buildCalendarItems({ contents: liveContents, shoots: s.shoots, events: s.events })
    .filter((i) => i.date >= s.today && i.date <= end && !i.done);

  return (
    <>
      <PageHeader eyebrow={formatBR(s.today)} title="Central de Operações" subtitle="As oito perguntas do gestor, respondidas com os dados reais cadastrados. Cada item leva direto ao cliente, conteúdo ou tarefa." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Section title="1 · O que precisa ser feito hoje?" hint={`${todayTasks.length} tarefas · ${todayContents.length} conteúdos · ${todayShoots.length} captações`}>
          {todayTasks.length + todayContents.length + todayShoots.length === 0 ? <Empty>Nada com prazo hoje.</Empty> : (
            <div className="space-y-0.5">
              {todayTasks.map((t) => <RowLink key={t.id} href={`/tarefas?tarefa=${t.id}`}><span className="badge">Tarefa</span><span className="flex-1 text-sm">{t.title}<span className="block text-xs text-muted">{who(t.assignee_id)}{t.client_id ? ` · ${cName(t.client_id)}` : ""}</span></span></RowLink>)}
              {todayContents.map((c) => <RowLink key={c.id} href={`/conteudos/${c.id}`}><span className="badge">{c.publish_date === s.today ? "Publicação" : "Prazo"}</span><span className="flex-1 text-sm">{c.title}<span className="block text-xs text-muted">{cName(c.client_id)} · {who(c.assignee_id)}</span></span></RowLink>)}
              {todayShoots.map((x) => <RowLink key={x.id} href="/captacoes"><span className="badge">Captação</span><span className="flex-1 text-sm">{cName(x.client_id)}<span className="block text-xs text-muted">{brTime(x.starts_at)}</span></span></RowLink>)}
            </div>
          )}
        </Section>

        <Section title="2 · O que está atrasado?" hint={`${lateTasks.length} tarefas · ${lateContents.length} conteúdos`}>
          {lateTasks.length + lateContents.length === 0 ? <Empty>Nenhum atraso. 🎯</Empty> : (
            <div className="space-y-0.5">
              {lateTasks.slice(0, 8).map((t) => <RowLink key={t.id} href={`/tarefas?tarefa=${t.id}`}><span className="badge badge-bad">{diffDays(s.today, t.due_date!)}d</span><span className="flex-1 text-sm">{t.title}<span className="block text-xs text-muted">{who(t.assignee_id)}{t.client_id ? ` · ${cName(t.client_id)}` : ""}</span></span></RowLink>)}
              {lateContents.slice(0, 8).map((c) => <RowLink key={c.id} href={`/conteudos/${c.id}`}><span className="badge badge-bad">Conteúdo</span><span className="flex-1 text-sm">{c.title}<span className="block text-xs text-muted">{cName(c.client_id)} · publicação {formatBR(c.publish_date)}</span></span></RowLink>)}
              {lateTasks.length > 8 && <Link href="/tarefas?quando=atrasadas" className="link text-xs">ver todas as tarefas atrasadas</Link>}
            </div>
          )}
        </Section>

        <Section title="3 · O que corre risco de atrasar?" hint="Projeções por regras operacionais — não são certezas">
          <AlertList alerts={risks} limit={6} />
        </Section>

        <Section title="4 · Quem está sobrecarregado?" hint="Semana corrente · horas estimadas × disponíveis" action={<Link href="/equipe" className="link text-xs">Painel de capacidade</Link>}>
          {loaded.length === 0 ? <Empty>Ninguém acima de 80% da capacidade desta semana.</Empty> : (
            <ul className="space-y-4">
              {loaded.map((c) => (
                <li key={c.member.user_id}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{c.member.full_name}{c.member.job_title ? <span className="text-muted"> · {c.member.job_title}</span> : null}</span>
                    <span className={`badge ${c.status === "sobrecarregado" ? "badge-bad" : "badge-warn"}`}>{LOAD_LABEL[c.status]}</span>
                  </div>
                  <Progress value={Math.min((c.ratio ?? 1) * 100, 100)} tone={c.status === "sobrecarregado" ? "bad" : "warn"} label={`Ocupação de ${c.member.full_name}`} />
                  <p className="mt-1 text-xs text-muted">{c.planned}h planejadas de {c.available}h disponíveis{c.backlogHours ? ` (inclui ${c.backlogHours}h atrasadas)` : ""}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="5 · Quais contratos estão incompletos?" hint="Mês corrente, do menor cumprimento ao maior">
          {incomplete.length === 0 ? <Empty>Nenhum contrato com entregas pendentes.</Empty> : (
            <ul className="space-y-4">
              {incomplete.map((p) => (
                <li key={p.clientId}>
                  <Link href={`/clientes/${p.clientId}`} className="block">
                    <div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{cName(p.clientId)}</span><span className="tabular-nums text-muted">{p.delivered}/{p.contracted} · faltam {p.pending}</span></div>
                    <Progress value={p.pct ?? 0} tone={p.late ? "bad" : pctTone(p.pct)} label={`Cumprimento de ${cName(p.clientId)}`} />
                    <p className="mt-1 text-xs text-muted">{p.lines.filter((l) => l.pending > 0).map((l) => `${l.typeName}: ${l.delivered}/${l.contracted}`).join(" · ")}{p.late ? ` · ${p.late} atrasada(s)` : ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="6 · Quais conteúdos aguardam aprovação?" hint="Mais antigos primeiro">
          {waiting.length === 0 ? <Empty>Nenhum conteúdo aguardando o cliente.</Empty> : (
            <div className="space-y-0.5">
              {waiting.map((c) => {
                const h = Math.round((Date.now() - new Date(c.status_changed_at).getTime()) / 3600000);
                return <RowLink key={c.id} href={`/conteudos/${c.id}`}><span className={`badge ${h > 48 ? "badge-warn" : ""}`}>{h >= 48 ? `${Math.floor(h / 24)}d` : `${h}h`}</span><span className="flex-1 text-sm">{c.title}<span className="block text-xs text-muted">{cName(c.client_id)}</span></span></RowLink>;
              })}
            </div>
          )}
        </Section>

        <Section title="7 · Quais captações precisam ser realizadas?" action={<Link href="/captacoes" className="link text-xs">Todas</Link>}>
          {shootsTodo.length === 0 ? <Empty>Nenhuma captação pendente.</Empty> : (
            <div className="space-y-0.5">
              {shootsTodo.slice(0, 8).map((x) => {
                const day = brDate(x.starts_at);
                return <RowLink key={x.id} href="/captacoes"><span className={`badge ${day < s.today ? "badge-bad" : ""}`}>{day < s.today ? "sem registro" : formatShortBR(day)}</span><span className="flex-1 text-sm">{cName(x.client_id)}<span className="block text-xs text-muted">{x.title} · {brTime(x.starts_at)}</span></span></RowLink>;
              })}
            </div>
          )}
        </Section>

        <Section title="8 · Entregas previstas nos próximos 7 dias" hint={`${formatShortBR(s.today)} a ${formatShortBR(end)}`} action={<Link href="/calendario" className="link text-xs">Calendário</Link>}>
          {upcoming.length === 0 ? <Empty>Nada previsto.</Empty> : (
            <div className="space-y-0.5">
              {upcoming.slice(0, 12).map((i) => (
                <RowLink key={i.id} href={i.href}><span className="badge">{formatShortBR(i.date)}</span><span className="flex-1 text-sm">{i.title}<span className="block text-xs text-muted">{KIND_LABEL[i.kind]}{i.clientId ? ` · ${cName(i.clientId)}` : ""}</span></span></RowLink>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Todos os alertas" hint="Ordenados por criticidade, com ação recomendada" className="mt-6">
        <AlertList alerts={s.alerts} />
      </Section>
    </>
  );
}
