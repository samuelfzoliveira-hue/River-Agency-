import { brDate, monthStart, todayBR } from "./dates";
import { CRITERION_STAGE, type ContentLite, type Criterion, type DeliverableType, type ShootLite, type Target } from "./types";

export interface DeliverableLine {
  typeId: string;
  typeName: string;
  kind: "content" | "shoot";
  criterion: Criterion;
  contracted: number;
  /** estágio ≥ 1 (conteúdos) ou captação agendada/realizada */
  produced: number;
  approved: number;
  published: number;
  /** atingiu o critério de conclusão do contrato; captações: realizadas */
  delivered: number;
  /** contratado − entregue (nunca negativo) */
  pending: number;
  /** pendentes com prazo (interno ou de publicação / captação) vencido */
  late: number;
  /** extras entregues ou em produção, fora da contagem contratada */
  extras: number;
  /** entregues além da meta (não extras) */
  surplus: number;
  /** conteúdos abertos (não entregues, não cancelados, não extras) — trabalho já iniciado para cobrir o pendente */
  inProgress: number;
  /** publicados fora do prazo (permanecem identificados) */
  publishedLate: number;
  pct: number | null;
}

export type CompetenceState = "sem_meta" | "completo" | "em_andamento" | "incompleto";

export interface ClientCompetence {
  clientId: string;
  competence: string;
  lines: DeliverableLine[];
  contracted: number;
  delivered: number; // limitado à meta de cada tipo — evita que excesso de um tipo compense falta de outro
  pending: number;
  late: number;
  extras: number;
  pct: number | null;
  state: CompetenceState;
}

interface Input {
  clientId: string;
  competence: string;
  targets: Target[];
  contents: ContentLite[];
  shoots: ShootLite[];
  types: DeliverableType[];
  today?: string;
}

/**
 * Cálculo único do cumprimento contratual de um cliente em uma competência.
 * Todas as telas (cliente, dashboard, Central de Operações, fechamento) usam esta função.
 *
 * Regras:
 *  - cada conteúdo é uma linha; ids duplicados na entrada são ignorados (nunca conta 2×);
 *  - cancelados não contam; extras ficam separados;
 *  - "entregue" = estágio ≥ critério da meta (aprovado/agendado/publicado);
 *  - captações contam quando realizadas; canceladas não contam.
 */
export function computeClientCompetence({ clientId, competence, targets, contents, shoots, types, today = todayBR() }: Input): ClientCompetence {
  const comp = monthStart(competence);
  const seen = new Set<string>();
  const cs = contents.filter((c) => {
    if (c.client_id !== clientId || monthStart(c.competence) !== comp || c.cancelled_at || seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const seenShoot = new Set<string>();
  const ss = shoots.filter((s) => {
    if (s.client_id !== clientId || monthStart(s.competence) !== comp || s.status === "cancelada" || seenShoot.has(s.id)) return false;
    seenShoot.add(s.id);
    return true;
  });
  const ts = targets.filter((t) => t.client_id === clientId && monthStart(t.competence) === comp);

  // soma metas de vários contratos do mesmo cliente por tipo
  const byType = new Map<string, { quantity: number; criterion: Criterion }>();
  for (const t of ts) {
    const cur = byType.get(t.deliverable_type_id);
    byType.set(t.deliverable_type_id, { quantity: (cur?.quantity ?? 0) + t.quantity, criterion: cur?.criterion ?? t.completion_criterion });
  }
  const typeIds = new Set<string>([...byType.keys(), ...cs.map((c) => c.deliverable_type_id)]);
  if (ss.length) for (const ty of types.filter((x) => x.kind === "shoot")) typeIds.add(ty.id);

  const lines: DeliverableLine[] = [];
  for (const ty of types) {
    if (!typeIds.has(ty.id)) continue;
    const target = byType.get(ty.id);
    const criterion = target?.criterion ?? "published";
    const contracted = target?.quantity ?? 0;
    let produced = 0, approved = 0, published = 0, delivered = 0, late = 0, extras = 0, inProgress = 0, publishedLate = 0;

    if (ty.kind === "shoot") {
      for (const s of ss) {
        if (s.is_extra) { extras++; continue; }
        if (s.status === "realizada") { delivered++; produced++; }
        else if (s.starts_at && brDate(s.starts_at) < today) late++;
        else inProgress++;
      }
    } else {
      const need = CRITERION_STAGE[criterion];
      for (const c of cs.filter((x) => x.deliverable_type_id === ty.id)) {
        if (c.is_extra) { extras++; continue; }
        if (c.delivery_stage >= 1) produced++;
        if (c.delivery_stage >= 2) approved++;
        if (c.delivery_stage >= 4) published++;
        if (c.published_late) publishedLate++;
        if (c.delivery_stage >= need) { delivered++; continue; }
        inProgress++;
        const overdue = (c.internal_deadline && c.internal_deadline < today) || (c.publish_date && c.publish_date < today);
        if (overdue) late++;
      }
    }
    const pending = Math.max(contracted - delivered, 0);
    lines.push({
      typeId: ty.id, typeName: ty.name, kind: ty.kind, criterion, contracted, produced, approved, published, delivered, pending,
      late, extras, surplus: Math.max(delivered - contracted, 0), inProgress, publishedLate,
      pct: contracted > 0 ? Math.round((Math.min(delivered, contracted) / contracted) * 100) : null,
    });
  }

  const contracted = lines.reduce((a, l) => a + l.contracted, 0);
  const delivered = lines.reduce((a, l) => a + Math.min(l.delivered, l.contracted), 0);
  const pending = lines.reduce((a, l) => a + l.pending, 0);
  const late = lines.reduce((a, l) => a + l.late, 0);
  const extras = lines.reduce((a, l) => a + l.extras, 0);
  const pct = contracted > 0 ? Math.round((delivered / contracted) * 100) : null;
  const isPast = comp < monthStart(today);
  const state: CompetenceState = contracted === 0 ? "sem_meta" : pending === 0 ? "completo" : isPast ? "incompleto" : "em_andamento";
  return { clientId, competence: comp, lines, contracted, delivered, pending, late, extras, pct, state };
}

export const STATE_LABEL: Record<CompetenceState, string> = {
  sem_meta: "Sem meta cadastrada",
  completo: "Contrato cumprido",
  em_andamento: "Em andamento",
  incompleto: "Contrato parcialmente cumprido",
};
