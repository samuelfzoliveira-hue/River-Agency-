import type { Ctx } from "./session";
import type { ClientRow, ContentRow, ContractItemRow, ContractRow, EventRow, Profile, ShootRow, StatusRow, TaskRow } from "./db";
import { buildAlerts, type OpsAlert } from "./domain/alerts";
import { computeCapacity, type MemberCapacity } from "./domain/capacity";
import { computeClientCompetence, type ClientCompetence } from "./domain/contracts";
import { addMonths, monthStart, todayBR } from "./domain/dates";
import type { AlertSettings, DeliverableType, Target, Unavailability } from "./domain/types";

type Res<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
async function rows<T>(q: Res<T>): Promise<T[]> {
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface Snapshot {
  today: string;
  competence: string;
  types: DeliverableType[];
  statuses: StatusRow[];
  members: Profile[];
  clients: ClientRow[];
  contracts: ContractRow[];
  items: ContractItemRow[];
  targets: Target[];
  contents: ContentRow[];
  shoots: ShootRow[];
  tasks: TaskRow[];
  events: EventRow[];
  unavailability: Unavailability[];
  settings: AlertSettings[];
  progress: ClientCompetence[];
  weekCapacity: MemberCapacity[];
  alerts: OpsAlert[];
}

/**
 * Carrega os dados reais da agência e calcula tudo com o mesmo motor (lib/domain).
 * Dashboard, Central de Operações, clientes e equipe partem deste snapshot — não há números "soltos".
 */
export async function loadSnapshot(ctx: Ctx, competenceArg?: string): Promise<Snapshot> {
  const { supabase } = ctx;
  const today = todayBR();
  const competence = monthStart(competenceArg ?? today);
  // gera metas do mês a partir do pacote de cada contrato (idempotente; não sobrescreve metas existentes)
  await supabase.rpc("ensure_monthly_targets", { p_month: competence });
  if (competence !== monthStart(today)) await supabase.rpc("ensure_monthly_targets", { p_month: monthStart(today) });

  const prev = addMonths(competence, -1);
  const [types, statuses, members, clients, contracts, items, targets, contents, shoots, tasks, events, unavailability, settings] = await Promise.all([
    rows<DeliverableType & { active: boolean }>(supabase.from("deliverable_types").select("*").eq("active", true).order("position")),
    rows<StatusRow>(supabase.from("pipeline_statuses").select("*").eq("active", true).order("position")),
    rows<Profile>(supabase.from("profiles").select("*").eq("active", true).order("full_name")),
    rows<ClientRow>(supabase.from("clients").select("*").order("name")),
    rows<ContractRow>(supabase.from("contracts").select("*")),
    rows<ContractItemRow>(supabase.from("contract_items").select("*")),
    rows<Target>(supabase.from("monthly_targets").select("*").eq("competence", competence)),
    rows<Omit<ContentRow, "approval_state">>(supabase.from("contents").select("*").or(`competence.gte.${prev},delivery_stage.lt.4`).is("cancelled_at", null)),
    rows<ShootRow>(supabase.from("shoots").select("*").or(`competence.gte.${prev},status.eq.agendada`)),
    rows<TaskRow>(supabase.from("tasks").select("*").or(`status.in.(todo,doing),completed_at.gte.${prev}T00:00:00Z`)),
    rows<EventRow>(supabase.from("events").select("*").gte("starts_at", `${prev}T00:00:00Z`)),
    rows<Unavailability>(supabase.from("member_unavailability").select("id,user_id,starts_on,ends_on,kind")),
    rows<AlertSettings>(supabase.from("alert_settings").select("*")),
  ]);

  const approval = new Map(statuses.map((s) => [s.id, s.approval_state]));
  const fullContents: ContentRow[] = contents.map((c) => ({ ...c, approval_state: approval.get(c.status_id) ?? null }));

  // clientes ativos entram no cálculo; metas de clientes pausados/encerrados são ignoradas
  const activeClients = clients.filter((c) => c.status === "ativo");
  const progress = activeClients.map((c) =>
    computeClientCompetence({ clientId: c.id, competence, targets, contents: fullContents, shoots, types, today }),
  );
  const staff = members.filter((m) => m.role !== "cliente");
  const weekCapacity = computeCapacity({ members: staff, tasks, unavailability, granularity: "semana", ref: today, today }).members;
  const currentProgress = competence === monthStart(today) ? progress : activeClients.map((c) =>
    computeClientCompetence({ clientId: c.id, competence: monthStart(today), targets, contents: fullContents, shoots, types, today }));
  const alerts = buildAlerts({
    today, clients, progress: currentProgress, contents: fullContents, tasks, shoots, capacities: weekCapacity,
    members: staff, contracts, settings,
  });

  return { today, competence, types, statuses, members, clients, contracts, items, targets, contents: fullContents, shoots, tasks, events, unavailability, settings, progress, weekCapacity, alerts };
}

export const nameOf = (members: Pick<Profile, "user_id" | "full_name">[], id: string | null | undefined) =>
  members.find((m) => m.user_id === id)?.full_name ?? "—";
export const firstName = (n: string) => n.split(" ")[0];
export const initials = (n: string) => n.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
