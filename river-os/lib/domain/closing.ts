import type { ClientCompetence, DeliverableLine } from "./contracts";

export interface ClosingLine {
  typeId: string; typeName: string; kind: "content" | "shoot";
  contracted: number; produced: number; approved: number; published: number; delivered: number;
  pending: number; late: number; extras: number; publishedLate: number;
}
export interface ClosingSnapshot {
  clientId: string; competence: string; lines: ClosingLine[];
  contracted: number; delivered: number; pending: number; late: number; extras: number; pct: number | null;
  verdict: "cumprido" | "parcial" | "sem_meta";
}
/** Pendência transferida: guarda a competência ORIGINAL; o mês seguinte só a exibe, nunca a recontabiliza. */
export interface PendingItem { typeId: string; typeName: string; quantity: number; competence: string }

export const VERDICT_LABEL = { cumprido: "Contrato cumprido", parcial: "Contrato parcialmente cumprido", sem_meta: "Sem meta cadastrada" } as const;

const toLine = (l: DeliverableLine): ClosingLine => ({
  typeId: l.typeId, typeName: l.typeName, kind: l.kind, contracted: l.contracted, produced: l.produced, approved: l.approved,
  published: l.published, delivered: l.delivered, pending: l.pending, late: l.late, extras: l.extras, publishedLate: l.publishedLate,
});

/** Congela o cálculo do mês (mesma função das telas) e lista o que fica pendente. Não altera nenhum conteúdo ou tarefa. */
export function buildClosing(c: ClientCompetence): { snapshot: ClosingSnapshot; pending: PendingItem[] } {
  const lines = c.lines.filter((l) => l.contracted > 0 || l.extras > 0 || l.delivered > 0).map(toLine);
  const snapshot: ClosingSnapshot = {
    clientId: c.clientId, competence: c.competence, lines, contracted: c.contracted, delivered: c.delivered, pending: c.pending,
    late: c.late, extras: c.extras, pct: c.pct, verdict: c.contracted === 0 ? "sem_meta" : c.pending === 0 ? "cumprido" : "parcial",
  };
  const pending = c.lines.filter((l) => l.pending > 0).map((l) => ({ typeId: l.typeId, typeName: l.typeName, quantity: l.pending, competence: c.competence }));
  return { snapshot, pending };
}

/** Quanto das pendências de um fechamento já foi regularizado desde então (cálculo ao vivo da competência original). */
export function carryOverStatus(pending: PendingItem[], live: ClientCompetence) {
  return pending.map((p) => {
    const now = live.lines.find((l) => l.typeId === p.typeId)?.pending ?? 0;
    return { ...p, stillPending: Math.min(p.quantity, now), resolved: Math.max(p.quantity - now, 0) };
  });
}
