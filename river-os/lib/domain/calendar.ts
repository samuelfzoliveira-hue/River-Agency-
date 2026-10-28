import { brDate, brTime } from "./dates";
import type { ContentLite, ShootLite } from "./types";

export type CalendarKind = "producao" | "aprovacao" | "publicacao" | "captacao" | "reuniao" | "campanha" | "interno";

export interface CalendarItem {
  id: string;
  date: string; // YYYY-MM-DD (fuso da agência)
  time?: string;
  kind: CalendarKind;
  title: string;
  clientId: string | null;
  assigneeId: string | null;
  typeId?: string | null;
  statusId?: string | null;
  href: string;
  done?: boolean;
}

/** Produção, aprovação e publicação têm cores distintas — ver KIND_STYLE na interface. */
export const KIND_LABEL: Record<CalendarKind, string> = {
  producao: "Prazo de produção",
  aprovacao: "Prazo de aprovação",
  publicacao: "Publicação",
  captacao: "Captação",
  reuniao: "Reunião",
  campanha: "Campanha",
  interno: "Entrega interna",
};

export interface EventLite {
  id: string;
  client_id: string | null;
  kind: "reuniao" | "campanha" | "prazo_aprovacao" | "interno" | "outro";
  title: string;
  starts_at: string;
}

export function buildCalendarItems(input: { contents: ContentLite[]; shoots: ShootLite[]; events: EventLite[] }): CalendarItem[] {
  const items: CalendarItem[] = [];
  for (const c of input.contents) {
    if (c.cancelled_at) continue;
    const base = { clientId: c.client_id, assigneeId: c.assignee_id, typeId: c.deliverable_type_id, statusId: c.status_id, href: `/conteudos/${c.id}` };
    if (c.internal_deadline) items.push({ ...base, id: `p:${c.id}`, date: c.internal_deadline, kind: "producao", title: c.title, done: c.delivery_stage >= 1 });
    if (c.publish_date) items.push({ ...base, id: `u:${c.id}`, date: c.publish_date, kind: "publicacao", title: c.title, done: c.delivery_stage >= 4 });
  }
  for (const s of input.shoots) {
    if (s.status === "cancelada") continue;
    items.push({
      id: `s:${s.id}`, date: brDate(s.starts_at), time: brTime(s.starts_at), kind: "captacao", title: s.title, clientId: s.client_id,
      assigneeId: null, href: "/captacoes", done: s.status === "realizada",
    });
  }
  for (const e of input.events) {
    const kind: CalendarKind = e.kind === "prazo_aprovacao" ? "aprovacao" : e.kind === "reuniao" ? "reuniao" : e.kind === "campanha" ? "campanha" : "interno";
    items.push({ id: `e:${e.id}`, date: brDate(e.starts_at), time: brTime(e.starts_at), kind, title: e.title, clientId: e.client_id, assigneeId: null, href: "/calendario" });
  }
  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
}
