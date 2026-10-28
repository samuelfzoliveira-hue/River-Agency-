import type { ReportData } from "./reports-data";
import { formatBR, monthLabel } from "./domain/dates";

export interface Section { key: string; title: string; hint?: string; headers: string[]; rows: (string | number | null)[][] }

const pct = (n: number | null) => (n == null ? "—" : `${n}%`);
const d1 = (n: number | null) => (n == null ? "—" : String(n).replace(".", ","));

/** Uma única definição das tabelas: alimenta a tela, o CSV e o PDF (mesmos números nos três). */
export function reportSections(r: ReportData): Section[] {
  const nm = (id: string | null) => r.members.find((m) => m.user_id === id)?.full_name ?? "—";
  const cn = (id: string | null) => r.clients.find((c) => c.id === id)?.name ?? "—";
  return [
    { key: "clientes", title: "Cumprimento por cliente", hint: "Previsto = metas contratuais do período; realizado = entregas que atingiram o critério de conclusão de cada contrato.",
      headers: ["Cliente", "Previstas", "Realizadas", "Pendentes", "Atrasadas", "Extras", "Cumprimento"],
      rows: r.delivery.byClient.map((c) => [c.client, c.contracted, c.delivered, c.pending, c.late, c.extras, pct(c.pct)]) },
    { key: "entregas", title: "Entregas previstas × realizadas por mês", headers: ["Cliente", "Competência", "Previstas", "Realizadas", "Pendentes", "Atrasadas", "Extras", "Cumprimento"],
      rows: r.delivery.rows.map((x) => [x.client, monthLabel(x.competence), x.contracted, x.delivered, x.pending, x.late, x.extras, pct(x.pct)]) },
    { key: "producao", title: "Produção no período", headers: ["Indicador", "Valor"], rows: [
      ["Conteúdos aprovados", r.production.approved], ["Conteúdos publicados", r.production.published], ["Publicados fora do prazo", r.production.publishedLate],
      ["Tempo médio até aprovação (dias)", d1(r.production.avgDaysToApproval)], ["Tempo médio até publicação (dias)", d1(r.production.avgDaysToPublish)],
      ["Captações realizadas", r.production.shootsDone], ["Revisões (pedidos de ajuste)", r.revisions.total]] },
    { key: "produtividade", title: "Produtividade por colaborador", hint: "Tarefas concluídas no período; pontualidade = concluídas até o prazo.",
      headers: ["Colaborador", "Tarefas concluídas", "No prazo", "Pontualidade", "Atrasadas em aberto", "Horas estimadas", "Horas registradas", "Conteúdos aprovados", "Conteúdos publicados"],
      rows: r.productivity.map((p) => [p.name, p.done, p.onTime, pct(p.onTimePct), p.overdueOpen, d1(p.estimatedHours), d1(p.loggedHours), p.contentsApproved, p.contentsPublished]) },
    { key: "tendencia", title: "Tendência mensal de tarefas concluídas", headers: ["Colaborador", ...r.trend.months.map((m) => monthLabel(m))], rows: r.trend.rows.map((x) => [x.name, ...x.perMonth]) },
    { key: "revisoes", title: "Revisões por cliente", hint: "Cada entrada em “ajustes solicitados” conta uma revisão.", headers: ["Cliente", "Revisões", "Conteúdos com revisão", "Média por conteúdo"],
      rows: r.revisions.rows.map((x) => [x.client, x.revisions, x.contentsWithRevision, d1(x.avgPerContent)]) },
    { key: "etapas", title: "Tempo por etapa e gargalos", hint: "Média e mediana de permanência (dias) das passagens concluídas no período, só com histórico real. “Gargalo” = etapa de produção/aprovação com média ≥ 1,5× a mediana das demais (mín. 3 passagens).",
      headers: ["Etapa", "Passagens", "Média (dias)", "Mediana (dias)", "Em andamento", "Mais antigo (dias)", "Gargalo"],
      rows: r.dwell.map((d) => [d.name, d.n, d1(d.avgDays), d1(d.medianDays), d.wip, d1(d.wipOldestDays), d.bottleneck ? "sim" : ""]) },
    { key: "atrasadas", title: "Tarefas atrasadas em aberto", headers: ["Tarefa", "Cliente", "Responsável", "Prazo", "Dias de atraso"],
      rows: r.overdue.map((t) => [t.title, t.client_id ? cn(t.client_id) : "Interna", nm(t.assignee_id), formatBR(t.due_date), Math.round((new Date(r.today).getTime() - new Date(t.due_date!).getTime()) / 86400000)]) },
  ];
}
