import { addDays, eachDay, isBusinessDay, monthEnd, monthStart, todayBR, weekStart } from "./dates";
import type { MemberLite, TaskLite, Unavailability } from "./types";

export type LoadStatus = "disponivel" | "atencao" | "sobrecarregado";
export type Granularity = "dia" | "semana" | "mes";

export const LOAD_LABEL: Record<LoadStatus, string> = { disponivel: "Disponível", atencao: "Atenção", sobrecarregado: "Sobrecarregado" };
/** ocupação ≥ 80% = atenção; > 100% = sobrecarregado */
export const ATTENTION_THRESHOLD = 0.8;

export function periodRange(g: Granularity, ref: string): { from: string; to: string } {
  if (g === "dia") return { from: ref, to: ref };
  if (g === "semana") { const f = weekStart(ref); return { from: f, to: addDays(f, 6) }; }
  return { from: monthStart(ref), to: monthEnd(ref) };
}

/** Horas disponíveis no período: capacidade semanal ÷ 5 por dia útil, descontando férias/folgas. */
export function availableHours(member: Pick<MemberLite, "user_id" | "weekly_capacity_hours">, from: string, to: string, unavailability: Unavailability[]): number {
  const off = unavailability.filter((u) => u.user_id === member.user_id);
  const perDay = member.weekly_capacity_hours / 5;
  let hours = 0;
  for (const d of eachDay(from, to)) {
    if (!isBusinessDay(d)) continue;
    if (off.some((u) => d >= u.starts_on && d <= u.ends_on)) continue;
    hours += perDay;
  }
  return Math.round(hours * 10) / 10;
}

export function loadStatus(planned: number, available: number): LoadStatus {
  if (planned <= 0) return "disponivel";
  if (available <= 0) return "sobrecarregado";
  const ratio = planned / available;
  return ratio > 1 ? "sobrecarregado" : ratio >= ATTENTION_THRESHOLD ? "atencao" : "disponivel";
}

export interface MemberCapacity {
  member: MemberLite;
  available: number;
  /** horas estimadas de tarefas abertas com prazo no período (+ atrasadas, se o período contém hoje) */
  planned: number;
  /** parte de `planned` que vem de tarefas já atrasadas */
  backlogHours: number;
  ratio: number | null;
  status: LoadStatus;
  open: TaskLite[];
  inProgress: number;
  doneInPeriod: number;
  late: number;
  /** tarefas abertas no período sem estimativa — não entram no cálculo e são sinalizadas */
  missingEstimate: number;
  /** abertas sem prazo — ficam fora do cálculo por período */
  undated: number;
  loggedHours: number;
  nextDeadlines: TaskLite[];
  unavailableDays: number;
}

export function computeCapacity(opts: {
  members: MemberLite[];
  tasks: TaskLite[];
  unavailability: Unavailability[];
  granularity: Granularity;
  ref: string;
  today?: string;
}): { from: string; to: string; members: MemberCapacity[] } {
  const today = opts.today ?? todayBR();
  const { from, to } = periodRange(opts.granularity, opts.ref);
  const includesToday = today >= from && today <= to;
  const out: MemberCapacity[] = [];
  for (const m of opts.members.filter((x) => x.active && x.role !== "cliente")) {
    const mine = opts.tasks.filter((t) => t.assignee_id === m.user_id);
    const openAll = mine.filter((t) => t.status === "todo" || t.status === "doing");
    const inPeriod = openAll.filter((t) => t.due_date && t.due_date >= from && t.due_date <= to);
    const backlog = includesToday ? openAll.filter((t) => t.due_date && t.due_date < from) : [];
    const counted = [...inPeriod, ...backlog];
    const planned = counted.reduce((a, t) => a + (t.estimated_hours ?? 0), 0);
    const available = availableHours(m, from, to, opts.unavailability);
    const unavailableDays = eachDay(from, to).filter((d) => isBusinessDay(d) && opts.unavailability.some((u) => u.user_id === m.user_id && d >= u.starts_on && d <= u.ends_on)).length;
    out.push({
      member: m,
      available,
      planned: Math.round(planned * 10) / 10,
      backlogHours: Math.round(backlog.reduce((a, t) => a + (t.estimated_hours ?? 0), 0) * 10) / 10,
      ratio: available > 0 ? planned / available : planned > 0 ? Infinity : null,
      status: loadStatus(planned, available),
      open: openAll,
      inProgress: openAll.filter((t) => t.status === "doing").length,
      doneInPeriod: mine.filter((t) => t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) >= from && t.completed_at.slice(0, 10) <= to).length,
      late: openAll.filter((t) => t.due_date && t.due_date < today).length,
      missingEstimate: counted.filter((t) => t.estimated_hours == null).length,
      undated: openAll.filter((t) => !t.due_date).length,
      loggedHours: mine.reduce((a, t) => a + (t.logged_hours ?? 0), 0),
      nextDeadlines: openAll.filter((t) => t.due_date && t.due_date >= today).sort((a, b) => a.due_date!.localeCompare(b.due_date!)).slice(0, 3),
      unavailableDays,
    });
  }
  return { from, to, members: out };
}

/** Sugere o colaborador com mais folga (horas disponíveis − planejadas) para receber uma tarefa. */
export function suggestAssignee(caps: MemberCapacity[], excludeUserId?: string | null): MemberCapacity | null {
  const pool = caps.filter((c) => c.member.user_id !== excludeUserId && c.status !== "sobrecarregado");
  pool.sort((a, b) => b.available - b.planned - (a.available - a.planned));
  return pool[0] ?? null;
}
