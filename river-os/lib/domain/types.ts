// Formatos de linha usados pelo motor de regras. São subconjuntos das tabelas do banco.
export type Stage = 0 | 1 | 2 | 3 | 4; // 0 produção · 1 produzido · 2 aprovado · 3 agendado · 4 publicado
export type Criterion = "approved" | "scheduled" | "published";
export const CRITERION_STAGE: Record<Criterion, Stage> = { approved: 2, scheduled: 3, published: 4 };
export const CRITERION_LABEL: Record<Criterion, string> = {
  approved: "após aprovação",
  scheduled: "após agendamento",
  published: "após publicação",
};

export interface DeliverableType {
  id: string;
  key: string;
  name: string;
  kind: "content" | "shoot";
  default_hours: number;
}
export interface Target {
  contract_id: string;
  client_id: string;
  competence: string;
  deliverable_type_id: string;
  quantity: number;
  completion_criterion: Criterion;
}
export interface ContentLite {
  id: string;
  title: string;
  client_id: string;
  competence: string;
  deliverable_type_id: string;
  status_id: string;
  delivery_stage: number;
  approval_state: "aguardando" | "ajustes" | "aprovado" | null;
  is_extra: boolean;
  cancelled_at: string | null;
  internal_deadline: string | null;
  publish_date: string | null;
  published_late: boolean;
  status_changed_at: string;
  assignee_id: string | null;
}
export interface ShootLite {
  id: string;
  title: string;
  client_id: string;
  competence: string;
  starts_at: string;
  status: "agendada" | "realizada" | "reagendada" | "cancelada";
  is_extra: boolean;
}
export interface TaskLite {
  id: string;
  title: string;
  client_id: string | null;
  content_id: string | null;
  assignee_id: string | null;
  status: "todo" | "doing" | "done" | "cancelled";
  priority: "baixa" | "media" | "alta" | "urgente";
  due_date: string | null;
  estimated_hours: number | null;
  logged_hours: number;
  completed_at: string | null;
}
export interface MemberLite {
  user_id: string;
  full_name: string;
  role: string;
  job_title: string | null;
  weekly_capacity_hours: number;
  active: boolean;
}
export interface Unavailability {
  id?: string;
  user_id: string;
  starts_on: string;
  ends_on: string;
  kind: "ferias" | "folga" | "outro";
}
export interface AlertSettings {
  id?: string;
  client_id: string | null;
  deliverable_type_id: string | null;
  approval_wait_hours: number;
  deadline_warning_days: number;
  contract_end_warning_days: number;
  min_business_days_per_item: number;
}
export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  client_id: null,
  deliverable_type_id: null,
  approval_wait_hours: 48,
  deadline_warning_days: 2,
  contract_end_warning_days: 30,
  min_business_days_per_item: 1,
};
