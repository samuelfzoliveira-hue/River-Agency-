// Formatos das linhas do banco usadas pela interface (ver supabase/migrations).
import type { ContentLite, Criterion, ShootLite, TaskLite } from "./domain/types";

export type Role = "admin" | "gestor" | "social" | "designer" | "videomaker" | "cliente";
export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  gestor: "Gestor de projetos",
  social: "Social media",
  designer: "Designer",
  videomaker: "Videomaker",
  cliente: "Cliente",
};

export interface Profile {
  user_id: string;
  org_id: string;
  role: Role;
  full_name: string;
  email: string | null;
  job_title: string | null;
  specialty: string | null;
  weekly_capacity_hours: number;
  active: boolean;
}
export interface StatusRow {
  id: string;
  name: string;
  position: number;
  stage: number;
  approval_state: "aguardando" | "ajustes" | "aprovado" | null;
  deliverable_type_id: string | null;
  active: boolean;
}
export interface ClientRow {
  id: string;
  name: string;
  segment: string | null;
  owner_id: string | null;
  status: "ativo" | "pausado" | "encerrado";
  contract_start: string | null;
  contacts: { name: string; role?: string; email?: string; phone?: string }[];
  socials: Record<string, string>;
  strategic_notes: string | null;
  created_at: string;
}
export interface ContractRow {
  id: string;
  client_id: string;
  name: string;
  start_date: string;
  end_date: string | null;
  status: "ativo" | "pausado" | "encerrado";
  completion_criterion: Criterion;
  notes: string | null;
}
export interface ContractItemRow {
  id: string;
  contract_id: string;
  deliverable_type_id: string;
  quantity: number;
  periodicity: "weekly" | "biweekly" | "monthly";
}
export interface ContentRow extends ContentLite {
  org_id: string;
  contract_id: string | null;
  objective: string | null;
  briefing: string | null;
  script: string | null;
  priority: "baixa" | "media" | "alta" | "urgente";
  cancel_reason: string | null;
  checklist: { id: string; text: string; done: boolean }[];
  attachments: { name: string; url: string }[];
  approved_at: string | null;
  approved_by: string | null;
  published_at: string | null;
  created_at: string;
}
export interface TaskRow extends TaskLite {
  org_id: string;
  description: string | null;
  shoot_id: string | null;
  created_by: string | null;
  created_at: string;
}
export interface ShootRow extends ShootLite {
  org_id: string;
  duration_minutes: number;
  location: string | null;
  notes: string | null;
  raw_material_url: string | null;
  equipment_checklist: { id: string; text: string; done: boolean }[];
  scene_checklist: { id: string; text: string; done: boolean }[];
}
export interface EventRow {
  id: string;
  client_id: string | null;
  kind: "reuniao" | "campanha" | "prazo_aprovacao" | "interno" | "outro";
  title: string;
  starts_at: string;
  ends_at: string | null;
  notes: string | null;
}
export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}
export interface CommentRow {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  body: string;
  mentions: string[];
  created_at: string;
}
export interface ActivityRow {
  id: string;
  entity_type: string;
  entity_id: string;
  client_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, { de: unknown; para: unknown } | string | null>;
  created_at: string;
}

export const PRIORITY_LABEL = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" } as const;
export const TASK_STATUS_LABEL = { todo: "A fazer", doing: "Em andamento", done: "Concluída", cancelled: "Cancelada" } as const;
export const PERIODICITY_LABEL = { weekly: "Semanal", biweekly: "Quinzenal", monthly: "Mensal" } as const;

export interface ApprovalPayload {
  content_id: string;
  title: string;
  client_name: string;
  type_name: string;
  state: "aguardando" | "ajustes" | "aprovado" | "indisponivel";
  version: number | null;
  caption: string | null;
  media: { name: string; url: string; kind: string }[] | null;
  note: string | null;
  sent_at: string | null;
  events: { action: "enviado" | "aprovado" | "ajustes"; comment: string | null; actor_name: string | null; version: number | null; created_at: string }[];
  expired?: boolean;
  superseded?: boolean;
  expires_at?: string;
}
export interface VersionRow { id: string; version: number; caption: string; media: { name: string; url: string; kind: string }[]; note: string | null; created_at: string }
export interface ApprovalEventRow { id: string; action: "enviado" | "aprovado" | "ajustes"; comment: string | null; actor_name: string | null; version: number | null; via: string; created_at: string }
export interface MediaRow { id: string; client_id: string; name: string; url: string | null; storage_path: string | null; size_bytes: number | null; kind: string; campaign: string | null; captured_on: string | null; created_by: string | null; created_at: string }
export interface ClosingRow {
  id: string; client_id: string; competence: string; status: "fechado" | "reaberto"; snapshot: import("./domain/closing").ClosingSnapshot;
  pending: import("./domain/closing").PendingItem[]; notes: string | null; closed_by: string | null; closed_at: string;
  reopen_log: { at: string; by: string; reason: string }[];
}
