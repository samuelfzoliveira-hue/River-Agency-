import type { ActivityRow, Profile } from "@/lib/db";
import { Empty } from "./ui";

const FIELD: Record<string, string> = {
  title: "título", name: "nome", status: "status", status_id: "etapa", assignee_id: "responsável", priority: "prioridade", due_date: "prazo",
  internal_deadline: "prazo interno", publish_date: "publicação prevista", briefing: "briefing", script: "roteiro", objective: "objetivo",
  is_extra: "extra", competence: "competência", cancelled_at: "cancelamento", cancel_reason: "motivo", checklist: "checklist", description: "descrição",
  estimated_hours: "horas estimadas", logged_hours: "horas registradas", starts_at: "data/horário", location: "local", segment: "segmento",
  owner_id: "responsável pelo cliente", strategic_notes: "observações", contacts: "contatos", socials: "redes", completion_criterion: "critério de conclusão",
  start_date: "início", end_date: "encerramento", approved_at: "aprovação", approved_by: "aprovado por", published_at: "publicação", published_late: "publicado fora do prazo",
  contract_id: "contrato", deliverable_type_id: "tipo", notes: "observações", raw_material_url: "material bruto",
};
const ENTITY: Record<string, string> = { content: "Conteúdo", task: "Tarefa", shoot: "Captação", client: "Cliente", contract: "Contrato" };

function show(v: unknown, members: Pick<Profile, "user_id" | "full_name">[]) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "string") {
    const m = members.find((x) => x.user_id === v);
    if (m) return m.full_name;
    return v.length > 60 ? v.slice(0, 57) + "…" : v;
  }
  return "(alterado)";
}

export function describe(a: ActivityRow, members: Pick<Profile, "user_id" | "full_name">[]) {
  if (a.action === "criado") return `criou ${ENTITY[a.entity_type]?.toLowerCase() ?? ""} “${String(a.details?.titulo ?? "")}”`;
  const d = a.details as Record<string, { de: unknown; para: unknown }>;
  if (a.action === "status" && d.status) return `moveu ${ENTITY[a.entity_type]?.toLowerCase() ?? ""} de “${show(d.status.de, members)}” para “${show(d.status.para, members)}”`;
  const parts = Object.entries(d)
    .filter(([k]) => k !== "status")
    .map(([k, v]) => `${FIELD[k] ?? k}: ${show(v.de, members)} → ${show(v.para, members)}`);
  return `alterou ${parts.join("; ")}`;
}

export function ActivityList({ items, members, showEntity = false }: { items: ActivityRow[]; members: Pick<Profile, "user_id" | "full_name">[]; showEntity?: boolean }) {
  if (items.length === 0) return <Empty>Nenhuma atividade registrada.</Empty>;
  return (
    <ol className="space-y-3">
      {items.map((a) => (
        <li key={a.id} className="text-sm">
          <p>
            <span className="font-medium">{members.find((m) => m.user_id === a.actor_id)?.full_name ?? "Sistema"}</span>{" "}
            <span className="text-muted">{showEntity && `[${ENTITY[a.entity_type] ?? a.entity_type}] `}{describe(a, members)}</span>
          </p>
          <p className="text-[11px] text-muted">{new Date(a.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</p>
        </li>
      ))}
    </ol>
  );
}
