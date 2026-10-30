import Link from "next/link";
import { Empty, PageHeader, RowLink, Section, Stat } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { buildCalendarItems } from "@/lib/domain/calendar";
import { addDays, brDate, brTime, formatBR, formatShortBR } from "@/lib/domain/dates";
import type { CommentRow } from "@/lib/db";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Meu painel" };

export default async function MyPanel() {
  const ctx = await requireCtx();
  const me = ctx.user.id;
  const s = await loadSnapshot(ctx);
  const cn = (id: string | null) => s.clients.find((c) => c.id === id)?.name;
  const mine = s.tasks.filter((t) => t.assignee_id === me);
  const open = mine.filter((t) => t.status === "todo" || t.status === "doing");
  const today = open.filter((t) => t.due_date === s.today);
  const late = open.filter((t) => t.due_date && t.due_date < s.today);
  const next = open.filter((t) => t.due_date && t.due_date > s.today).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 8);
  const done = mine.filter((t) => t.status === "done").sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? "")).slice(0, 8);
  // conteúdos que dependem de mim: sou responsável e ainda não foram publicados/cancelados
  const myContents = s.contents.filter((c) => c.assignee_id === me && c.delivery_stage < 4 && !c.cancelled_at);
  const waitingMe = myContents.filter((c) => c.approval_state === "ajustes" || c.delivery_stage === 0);
  const myShoots = s.shoots.filter((x) => (x.status === "agendada" || x.status === "reagendada") && x.starts_at >= `${s.today}T00:00:00`).sort((a, b) => a.starts_at.localeCompare(b.starts_at)).slice(0, 6);
  const upcoming = buildCalendarItems({ contents: myContents, shoots: [], events: [] }).filter((i) => i.date >= s.today && i.date <= addDays(s.today, 14)).slice(0, 6);
  const cap = s.weekCapacity.find((c) => c.member.user_id === me);

  const { data: mentions } = await ctx.supabase.from("comments").select("*").contains("mentions", [me]).order("created_at", { ascending: false }).limit(6);
  const mentionList = (mentions ?? []) as CommentRow[];

  return (
    <>
      <PageHeader eyebrow={formatBR(s.today)} title={`Olá, ${ctx.profile.full_name.split(" ")[0] || "equipe"}`} subtitle="Tudo o que depende de você, em um só lugar." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Tarefas de hoje" value={today.length} href="/tarefas?resp=eu&quando=hoje" />
        <Stat label="Atrasadas" value={late.length} tone={late.length ? "bad" : undefined} href="/tarefas?resp=eu&quando=atrasadas" />
        <Stat label="Conteúdos aguardando minha ação" value={waitingMe.length} href={`/pipeline?resp=${me}`} />
        <Stat label="Carga da semana" value={cap ? `${cap.planned}h` : "—"} sub={cap ? `de ${cap.available}h disponíveis` : undefined} href="/equipe" tone={cap?.status === "sobrecarregado" ? "bad" : cap?.status === "atencao" ? "warn" : undefined} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Minhas tarefas de hoje e atrasadas">
          {today.length + late.length === 0 ? <Empty>Nada urgente. Bom trabalho!</Empty> : (
            <div className="space-y-0.5">
              {[...late, ...today].map((t) => <RowLink key={t.id} href={`/tarefas?tarefa=${t.id}`}><span className={`badge ${late.includes(t) ? "badge-bad" : ""}`}>{late.includes(t) ? "atrasada" : "hoje"}</span><span className="flex-1 text-sm">{t.title}<span className="block text-xs text-muted">{cn(t.client_id) ?? "Interna"}{t.estimated_hours != null ? ` · ${t.estimated_hours}h` : ""}</span></span></RowLink>)}
            </div>
          )}
        </Section>
        <Section title="Conteúdos aguardando minha ação" hint="Responsável por mim e ainda em produção ou com ajustes pedidos">
          {waitingMe.length === 0 ? <Empty>Nenhum conteúdo pendente com você.</Empty> : (
            <div className="space-y-0.5">{waitingMe.slice(0, 8).map((c) => <RowLink key={c.id} href={`/conteudos/${c.id}`}><span className={`badge ${c.approval_state === "ajustes" ? "badge-warn" : ""}`}>{c.approval_state === "ajustes" ? "ajustes" : "produzir"}</span><span className="flex-1 text-sm">{c.title}<span className="block text-xs text-muted">{cn(c.client_id)}{c.publish_date ? ` · publicação ${formatShortBR(c.publish_date)}` : ""}</span></span></RowLink>)}</div>
          )}
        </Section>
        <Section title="Próximas entregas">
          {next.length + upcoming.length === 0 ? <Empty>Sem entregas à vista.</Empty> : (
            <div className="space-y-0.5">
              {next.map((t) => <RowLink key={t.id} href={`/tarefas?tarefa=${t.id}`}><span className="badge">{formatShortBR(t.due_date!)}</span><span className="flex-1 text-sm">{t.title}</span></RowLink>)}
              {upcoming.map((i) => <RowLink key={i.id} href={i.href}><span className="badge">{formatShortBR(i.date)}</span><span className="flex-1 text-sm">{i.title}<span className="block text-xs text-muted">{i.kind === "publicacao" ? "Publicação" : "Prazo de produção"}</span></span></RowLink>)}
            </div>
          )}
        </Section>
        <Section title="Agenda de captações" action={<Link href="/captacoes" className="link text-xs">Ver todas</Link>}>
          {myShoots.length === 0 ? <Empty>Nenhuma captação agendada.</Empty> : (
            <div className="space-y-0.5">{myShoots.map((x) => <RowLink key={x.id} href="/captacoes"><span className="badge">{formatShortBR(brDate(x.starts_at))}</span><span className="flex-1 text-sm">{cn(x.client_id)}<span className="block text-xs text-muted">{x.title} · {brTime(x.starts_at)}</span></span></RowLink>)}</div>
          )}
        </Section>
        <Section title="Comentários e menções">
          {mentionList.length === 0 ? <Empty>Ninguém mencionou você ainda.</Empty> : (
            <ul className="space-y-3 text-sm">{mentionList.map((m) => (
              <li key={m.id}><Link href={m.entity_type === "content" ? `/conteudos/${m.entity_id}` : m.entity_type === "client" ? `/clientes/${m.entity_id}` : `/tarefas?tarefa=${m.entity_id}`} className="block hover:underline">
                <span className="text-xs text-muted">{s.members.find((x) => x.user_id === m.author_id)?.full_name} · {new Date(m.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span><span className="block line-clamp-2">{m.body}</span></Link></li>
            ))}</ul>
          )}
        </Section>
        <Section title="Histórico de tarefas concluídas">
          {done.length === 0 ? <Empty>Nenhuma tarefa concluída ainda.</Empty> : (
            <ul className="space-y-2 text-sm">{done.map((t) => <li key={t.id} className="flex justify-between gap-3"><span className="truncate text-muted line-through">{t.title}</span><span className="shrink-0 text-xs text-muted">{t.completed_at ? formatBR(brDate(t.completed_at)).slice(0, 5) : ""}</span></li>)}</ul>
          )}
        </Section>
      </div>
    </>
  );
}
