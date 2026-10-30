import type { Ctx } from "./session";
import type { ClientRow, Profile, ShootRow, StatusRow, TaskRow } from "./db";
import { brDate, monthStart, todayBR, addMonths } from "./domain/dates";
import {
  deliveryReport, dwellReport, monthsBetween, productionSummary, productivityReport, productivityTrend, revisionReport, type ContentFull, type HistoryRow,
} from "./domain/reports";
import type { DeliverableType, Target } from "./domain/types";

export interface ReportFilters { from: string; to: string; clientId?: string; userId?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Lê filtros da URL; padrão = últimos 3 meses até hoje. Limita o período a 24 meses. */
export function parseFilters(sp: { de?: string; ate?: string; cliente?: string; resp?: string }): ReportFilters {
  const today = todayBR();
  let to = DATE.test(sp.ate ?? "") ? sp.ate! : today;
  let from = DATE.test(sp.de ?? "") ? sp.de! : `${addMonths(monthStart(to), -2)}`;
  if (from > to) [from, to] = [to, from];
  if (monthsBetween(from, to).length > 24) from = addMonths(monthStart(to), -23);
  return { from, to, clientId: sp.cliente || undefined, userId: sp.resp || undefined };
}

async function all<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Carrega os dados reais do período e calcula todas as seções com o motor de regras. */
export async function loadReport(ctx: Ctx, f: ReportFilters) {
  const { supabase } = ctx;
  const today = todayBR();
  const months = monthsBetween(f.from, f.to);
  for (const m of months) await supabase.rpc("ensure_monthly_targets", { p_month: m });
  const fromTs = `${f.from}T00:00:00-03:00`;
  const toTs = `${f.to}T23:59:59-03:00`;

  const [clients, members, types, statuses, targets, contents, shoots, tasks, history] = await Promise.all([
    all<ClientRow>(supabase.from("clients").select("*").order("name")),
    all<Profile>(supabase.from("profiles").select("*").eq("active", true).order("full_name")),
    all<DeliverableType>(supabase.from("deliverable_types").select("*").eq("active", true).order("position")),
    all<StatusRow>(supabase.from("pipeline_statuses").select("*").eq("active", true)),
    all<Target>(supabase.from("monthly_targets").select("*").gte("competence", monthStart(f.from)).lte("competence", f.to)),
    all<ContentFull>(supabase.from("contents").select("*").or(`and(competence.gte.${monthStart(f.from)},competence.lte.${f.to}),and(approved_at.gte.${fromTs},approved_at.lte.${toTs}),and(published_at.gte.${fromTs},published_at.lte.${toTs}),delivery_stage.lt.4`).limit(5000)),
    all<ShootRow>(supabase.from("shoots").select("*").gte("competence", monthStart(f.from)).lte("competence", f.to)),
    all<TaskRow>(supabase.from("tasks").select("*").or(`and(completed_at.gte.${fromTs},completed_at.lte.${toTs}),status.in.(todo,doing)`).limit(5000)),
    all<HistoryRow>(supabase.from("content_status_history").select("content_id,status_id,stage,approval_state,entered_at,left_at,backfilled").gte("entered_at", `${addMonths(monthStart(f.from), -1)}T00:00:00Z`).limit(20000)),
  ]);

  const approval = new Map(statuses.map((s) => [s.id, s.approval_state]));
  let cs = contents.map((c) => ({ ...c, approval_state: approval.get(c.status_id) ?? null }));
  let ts: TaskRow[] = tasks, ss = shoots, cl = clients;
  if (f.clientId) { cs = cs.filter((c) => c.client_id === f.clientId); ts = ts.filter((t) => t.client_id === f.clientId); ss = ss.filter((s) => s.client_id === f.clientId); cl = cl.filter((c) => c.id === f.clientId); }
  const people = members.filter((m) => m.role !== "cliente" && (!f.userId || m.user_id === f.userId));
  const scopedHistory = history.filter((h) => cs.some((c) => c.id === h.content_id));

  const delivery = deliveryReport({ clients: cl, from: f.from, to: f.to, targets, contents: cs, shoots: ss, types, today });
  const productivity = productivityReport({ people, tasks: ts, contents: cs.filter((c) => !f.userId || c.assignee_id === f.userId), from: f.from, to: f.to, today });
  const trend = productivityTrend({ people, tasks: ts, from: f.from, to: f.to });
  const production = productionSummary({ contents: cs.filter((c) => !f.userId || c.assignee_id === f.userId), shoots: ss, from: f.from, to: f.to });
  const revisions = revisionReport({ clients: cl, contents: cs, history: scopedHistory, from: f.from, to: f.to });
  const dwell = dwellReport({ statuses, history: scopedHistory, contents: cs, from: f.from, to: f.to });
  const overdue = ts.filter((t) => (t.status === "todo" || t.status === "doing") && t.due_date && t.due_date < today && (!f.userId || t.assignee_id === f.userId))
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!));

  return { filters: f, today, clients, members, delivery, productivity, trend, production, revisions, dwell, overdue, brDate };
}
export type ReportData = Awaited<ReturnType<typeof loadReport>>;
