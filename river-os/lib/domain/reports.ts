import { computeClientCompetence } from "./contracts";
import { addMonths, brDate, diffDays, eachDay, monthStart, todayBR } from "./dates";
import type { ContentLite, DeliverableType, ShootLite, Target, TaskLite } from "./types";

export interface HistoryRow {
  content_id: string; status_id: string; stage: number; approval_state: string | null;
  entered_at: string; left_at: string | null; backfilled: boolean;
}
export interface StatusLite { id: string; name: string; position: number; stage: number; deliverable_type_id: string | null }
export interface ContentFull extends ContentLite { created_at: string; approved_at: string | null; published_at: string | null }
export interface PersonLite { user_id: string; full_name: string }
export interface ClientLite { id: string; name: string }

export const monthsBetween = (from: string, to: string): string[] => {
  const out: string[] = [];
  for (let m = monthStart(from); m <= monthStart(to); m = addMonths(m, 1)) out.push(m);
  return out;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const inPeriod = (iso: string | null | undefined, from: string, to: string) => !!iso && brDate(iso) >= from && brDate(iso) <= to;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// ───────── 1. Entregas previstas × realizadas, por cliente e mês ─────────
export interface DeliveryRow { clientId: string; client: string; competence: string; contracted: number; delivered: number; pending: number; late: number; extras: number; pct: number | null }
export function deliveryReport(i: { clients: ClientLite[]; from: string; to: string; targets: Target[]; contents: ContentLite[]; shoots: ShootLite[]; types: DeliverableType[]; today?: string }) {
  const today = i.today ?? todayBR();
  const rows: DeliveryRow[] = [];
  for (const m of monthsBetween(i.from, i.to)) for (const c of i.clients) {
    const r = computeClientCompetence({ clientId: c.id, competence: m, targets: i.targets, contents: i.contents, shoots: i.shoots, types: i.types, today });
    if (r.contracted === 0 && r.extras === 0) continue;
    rows.push({ clientId: c.id, client: c.name, competence: m, contracted: r.contracted, delivered: r.delivered, pending: r.pending, late: r.late, extras: r.extras, pct: r.pct });
  }
  const byClient = i.clients.map((c) => {
    const rs = rows.filter((r) => r.clientId === c.id);
    const contracted = rs.reduce((a, r) => a + r.contracted, 0), delivered = rs.reduce((a, r) => a + r.delivered, 0);
    return { clientId: c.id, client: c.name, contracted, delivered, pending: rs.reduce((a, r) => a + r.pending, 0), late: rs.reduce((a, r) => a + r.late, 0), extras: rs.reduce((a, r) => a + r.extras, 0), pct: contracted ? Math.round((delivered / contracted) * 100) : null };
  }).filter((r) => r.contracted > 0 || r.extras > 0);
  const contracted = byClient.reduce((a, r) => a + r.contracted, 0), delivered = byClient.reduce((a, r) => a + r.delivered, 0);
  return { rows, byClient, totals: { contracted, delivered, pct: contracted ? Math.round((delivered / contracted) * 100) : null } };
}

// ───────── 2. Produtividade por colaborador ─────────
export interface ProductivityRow {
  userId: string; name: string; done: number; onTime: number; onTimePct: number | null; overdueOpen: number; estimatedHours: number; loggedHours: number;
  contentsApproved: number; contentsPublished: number;
}
export function productivityReport(i: { people: PersonLite[]; tasks: TaskLite[]; contents: ContentFull[]; from: string; to: string; today?: string }): ProductivityRow[] {
  const today = i.today ?? todayBR();
  return i.people.map((p) => {
    const done = i.tasks.filter((t) => t.assignee_id === p.user_id && t.status === "done" && inPeriod(t.completed_at, i.from, i.to));
    const onTime = done.filter((t) => !t.due_date || brDate(t.completed_at!) <= t.due_date).length;
    const mine = i.contents.filter((c) => c.assignee_id === p.user_id && !c.cancelled_at);
    return {
      userId: p.user_id, name: p.full_name, done: done.length, onTime, onTimePct: done.length ? Math.round((onTime / done.length) * 100) : null,
      overdueOpen: i.tasks.filter((t) => t.assignee_id === p.user_id && (t.status === "todo" || t.status === "doing") && t.due_date && t.due_date < today).length,
      estimatedHours: round1(done.reduce((a, t) => a + (t.estimated_hours ?? 0), 0)), loggedHours: round1(done.reduce((a, t) => a + (t.logged_hours ?? 0), 0)),
      contentsApproved: mine.filter((c) => inPeriod(c.approved_at, i.from, i.to)).length, contentsPublished: mine.filter((c) => inPeriod(c.published_at, i.from, i.to)).length,
    };
  });
}

/** Tendência mensal (análise histórica): tarefas concluídas por colaborador em cada mês do período. */
export function productivityTrend(i: { people: PersonLite[]; tasks: TaskLite[]; from: string; to: string }) {
  const months = monthsBetween(i.from, i.to);
  return { months, rows: i.people.map((p) => ({ name: p.full_name, userId: p.user_id, perMonth: months.map((m) => i.tasks.filter((t) => t.assignee_id === p.user_id && t.status === "done" && t.completed_at && monthStart(brDate(t.completed_at)) === m).length) })) };
}

// ───────── 3. Tempo de produção e totais do período ─────────
export function productionSummary(i: { contents: ContentFull[]; shoots: ShootLite[]; from: string; to: string }) {
  const live = i.contents.filter((c) => !c.cancelled_at);
  const approved = live.filter((c) => inPeriod(c.approved_at, i.from, i.to));
  const published = live.filter((c) => inPeriod(c.published_at, i.from, i.to));
  const days = (c: ContentFull, end: string) => (new Date(end).getTime() - new Date(c.created_at).getTime()) / 86400000;
  return {
    approved: approved.length, published: published.length, publishedLate: published.filter((c) => c.published_late).length,
    avgDaysToApproval: avg(approved.map((c) => days(c, c.approved_at!))) == null ? null : round1(avg(approved.map((c) => days(c, c.approved_at!)))!),
    avgDaysToPublish: avg(published.map((c) => days(c, c.published_at!))) == null ? null : round1(avg(published.map((c) => days(c, c.published_at!)))!),
    shootsDone: i.shoots.filter((s) => s.status === "realizada" && inPeriod(s.starts_at, i.from, i.to)).length,
  };
}

// ───────── 4. Revisões ─────────
export function revisionReport(i: { clients: ClientLite[]; contents: ContentLite[]; history: HistoryRow[]; from: string; to: string }) {
  const byContent = new Map(i.contents.map((c) => [c.id, c]));
  const entries = i.history.filter((h) => h.approval_state === "ajustes" && inPeriod(h.entered_at, i.from, i.to) && byContent.has(h.content_id));
  const rows = i.clients.map((cl) => {
    const mine = entries.filter((h) => byContent.get(h.content_id)!.client_id === cl.id);
    const contents = new Set(mine.map((h) => h.content_id));
    return { clientId: cl.id, client: cl.name, revisions: mine.length, contentsWithRevision: contents.size, avgPerContent: contents.size ? round1(mine.length / contents.size) : 0 };
  }).filter((r) => r.revisions > 0);
  return { rows, total: entries.length };
}

// ───────── 5. Permanência por etapa e gargalos ─────────
export interface DwellRow { statusId: string; name: string; position: number; stage: number; n: number; avgDays: number; medianDays: number; totalDays: number; wip: number; wipOldestDays: number | null; bottleneck: boolean }
const MIN_SAMPLES = 3;

export function dwellReport(i: { statuses: StatusLite[]; history: HistoryRow[]; contents: ContentLite[]; from: string; to: string; now?: Date }): DwellRow[] {
  const now = i.now ?? new Date();
  const live = new Set(i.contents.filter((c) => !c.cancelled_at).map((c) => c.id));
  const base = i.statuses.filter((s) => s.deliverable_type_id === null);
  const rows: DwellRow[] = base.map((s) => {
    const closed = i.history.filter((h) => h.status_id === s.id && h.left_at && !h.backfilled && live.has(h.content_id) && inPeriod(h.left_at, i.from, i.to))
      .map((h) => (new Date(h.left_at!).getTime() - new Date(h.entered_at).getTime()) / 86400000);
    const open = i.history.filter((h) => h.status_id === s.id && !h.left_at && live.has(h.content_id));
    const ages = open.map((h) => (now.getTime() - new Date(h.entered_at).getTime()) / 86400000);
    return {
      statusId: s.id, name: s.name, position: s.position, stage: s.stage, n: closed.length, avgDays: round1(avg(closed) ?? 0), medianDays: round1(median(closed) ?? 0),
      totalDays: round1(closed.reduce((a, b) => a + b, 0)), wip: open.length, wipOldestDays: ages.length ? round1(Math.max(...ages)) : null, bottleneck: false,
    };
  }).sort((a, b) => a.position - b.position);
  // gargalo: etapas de produção/aprovação (estágio < 3) com amostra suficiente e permanência bem acima da mediana das demais
  const eligible = rows.filter((r) => r.stage < 3 && r.n >= MIN_SAMPLES);
  const ref = median(eligible.map((r) => r.avgDays));
  if (ref != null && eligible.length >= 2) for (const r of eligible) r.bottleneck = r.avgDays >= Math.max(ref * 1.5, 0.5);
  return rows;
}

/** Permanência média por (tipo de conteúdo, etapa), só com histórico real — base das previsões. */
export type DwellStats = Map<string, { avgDays: number; n: number }>;
export function buildDwellStats(history: HistoryRow[], contents: Pick<ContentLite, "id" | "deliverable_type_id">[]): DwellStats {
  const type = new Map(contents.map((c) => [c.id, c.deliverable_type_id]));
  const acc = new Map<string, number[]>();
  for (const h of history) {
    if (!h.left_at || h.backfilled || !type.has(h.content_id)) continue;
    const k = `${type.get(h.content_id)}:${h.status_id}`;
    acc.set(k, [...(acc.get(k) ?? []), (new Date(h.left_at).getTime() - new Date(h.entered_at).getTime()) / 86400000]);
  }
  return new Map([...acc].map(([k, v]) => [k, { avgDays: avg(v)!, n: v.length }]));
}

// ───────── CSV (separador “;” e BOM para abrir direto no Excel em pt-BR) ─────────
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s) && Number.isNaN(Number(s))) s = "'" + s; // evita injeção de fórmula no Excel
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
export { eachDay, diffDays };
