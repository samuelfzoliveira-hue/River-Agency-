import { addDays, brDate, businessDaysBetween, diffDays, formatBR, monthEnd, todayBR } from "./dates";
import type { ClientCompetence } from "./contracts";
import type { MemberCapacity } from "./capacity";
import type { DwellStats, StatusLite } from "./reports";
import { DEFAULT_ALERT_SETTINGS, type AlertSettings, type ContentLite, type ShootLite, type TaskLite } from "./types";

export type AlertLevel = "informativo" | "atencao" | "critico";
export const LEVEL_RANK: Record<AlertLevel, number> = { informativo: 0, atencao: 1, critico: 2 };
export const LEVEL_LABEL: Record<AlertLevel, string> = { informativo: "Informativo", atencao: "Atenção", critico: "Crítico" };

export interface OpsAlert {
  id: string;
  level: AlertLevel;
  kind: "contrato" | "atraso" | "risco" | "aprovacao" | "captacao" | "capacidade" | "encerramento";
  title: string;
  message: string;
  /** ação recomendada para o gestor */
  action: { label: string; href: string };
  clientId?: string | null;
  /** true quando é uma projeção baseada em regras operacionais, não um fato */
  estimated: boolean;
}

export const ESTIMATE_NOTE = "Estimativa baseada em regras operacionais (dias úteis × entregas pendentes × capacidade); não é uma previsão exata.";

export function settingsFor(all: AlertSettings[], clientId: string | null, typeId: string | null = null): AlertSettings {
  const pick = (c: string | null, t: string | null) => all.find((s) => s.client_id === c && s.deliverable_type_id === t);
  return pick(clientId, typeId) ?? pick(clientId, null) ?? pick(null, typeId) ?? pick(null, null) ?? DEFAULT_ALERT_SETTINGS;
}

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`;

export interface AlertInput {
  today?: string;
  clients: { id: string; name: string; status: string }[];
  progress: ClientCompetence[]; // competência corrente
  contents: ContentLite[];
  tasks: TaskLite[];
  shoots: ShootLite[];
  capacities: MemberCapacity[]; // semana corrente
  members: { user_id: string; full_name: string }[];
  contracts: { client_id: string; end_date: string | null; status: string }[];
  settings: AlertSettings[];
  /** histórico de permanência por etapa (opcional): habilita a previsão de prazo por conteúdo */
  dwell?: DwellStats;
  statuses?: StatusLite[];
}

export function buildAlerts(i: AlertInput): OpsAlert[] {
  const today = i.today ?? todayBR();
  const out: OpsAlert[] = [];
  const cname = (id: string | null | undefined) => i.clients.find((c) => c.id === id)?.name ?? "Cliente";
  const uname = (id: string | null | undefined) => i.members.find((m) => m.user_id === id)?.full_name?.split(" ")[0] ?? "Sem responsável";
  const activeClients = new Set(i.clients.filter((c) => c.status === "ativo").map((c) => c.id));

  // 1) Contrato: entregas pendentes × dias úteis restantes no mês
  const daysLeft = businessDaysBetween(today, monthEnd(today));
  for (const p of i.progress) {
    if (!activeClients.has(p.clientId)) continue;
    for (const l of p.lines) {
      if (l.pending <= 0) continue;
      const cfg = settingsFor(i.settings, p.clientId, l.typeId);
      const need = l.pending * cfg.min_business_days_per_item;
      const notStarted = Math.max(l.pending - l.inProgress, 0);
      const ratio = daysLeft > 0 ? need / daysLeft : Infinity;
      const level: AlertLevel | null = ratio > 1 ? "critico" : ratio > 0.6 ? "atencao" : daysLeft <= 7 ? "informativo" : null;
      if (!level) continue;
      const diasTxt = daysLeft === 0 ? "nenhum dia útil restante" : `apenas ${plural(daysLeft, "dia útil", "dias úteis")}`;
      out.push({
        id: `contrato:${p.clientId}:${l.typeId}`, level, kind: "contrato", clientId: p.clientId, estimated: true,
        title: `${cname(p.clientId)}: faltam ${plural(l.pending, "entrega", "entregas")} de ${l.typeName} para concluir o contrato`,
        message: `${plural(l.pending, "pendente", "pendentes")} (${l.delivered} de ${l.contracted} entregues) e ${diasTxt} no mês.` +
          (notStarted > 0 ? ` ${plural(notStarted, "ainda sem conteúdo iniciado", "ainda sem conteúdo iniciado")}.` : ""),
        action: { label: notStarted > 0 ? "Planejar conteúdos pendentes" : "Revisar cronograma", href: `/clientes/${p.clientId}` },
      });
    }
  }

  // 2) Tarefas atrasadas
  for (const t of i.tasks) {
    if (!(t.status === "todo" || t.status === "doing") || !t.due_date || t.due_date >= today) continue;
    const d = diffDays(today, t.due_date);
    out.push({
      id: `tarefa-atrasada:${t.id}`, level: "critico", kind: "atraso", clientId: t.client_id, estimated: false,
      title: `Entrega atrasada: ${t.title} — responsável: ${uname(t.assignee_id)}`,
      message: `Venceu em ${formatBR(t.due_date)} (${plural(d, "dia", "dias")} de atraso)${t.client_id ? ` · ${cname(t.client_id)}` : ""}.`,
      action: { label: "Abrir tarefa / redistribuir", href: `/tarefas?tarefa=${t.id}` },
    });
  }

  // 3) Conteúdos com prazo vencido e ainda não produzidos/publicados
  for (const c of i.contents) {
    if (c.cancelled_at || c.delivery_stage >= 4 || !activeClients.has(c.client_id)) continue;
    const overdueInternal = c.internal_deadline && c.internal_deadline < today && c.delivery_stage < 1;
    const overduePublish = c.publish_date && c.publish_date < today;
    if (!overdueInternal && !overduePublish) continue;
    out.push({
      id: `conteudo-atrasado:${c.id}`, level: "critico", kind: "atraso", clientId: c.client_id, estimated: false,
      title: `Conteúdo atrasado: ${c.title} — ${cname(c.client_id)}`,
      message: overduePublish ? `Publicação prevista para ${formatBR(c.publish_date)}.` : `Prazo interno em ${formatBR(c.internal_deadline)}.`,
      action: { label: "Abrir conteúdo", href: `/conteudos/${c.id}` },
    });
  }

  // 4) Risco de atraso: tarefas que vencem em breve e ainda não começaram; concentração de entregas no mesmo dia
  const tomorrow = addDays(today, 1);
  const byAssigneeTomorrow = new Map<string, TaskLite[]>();
  for (const t of i.tasks) {
    if (!(t.status === "todo" || t.status === "doing") || !t.due_date || !t.assignee_id) continue;
    if (t.due_date === tomorrow) byAssigneeTomorrow.set(t.assignee_id, [...(byAssigneeTomorrow.get(t.assignee_id) ?? []), t]);
  }
  for (const [uid, ts] of byAssigneeTomorrow) {
    if (ts.length < 3) continue;
    out.push({
      id: `risco-amanha:${uid}`, level: "atencao", kind: "risco", estimated: true,
      title: `Risco de atraso: ${uname(uid)} possui ${plural(ts.length, "tarefa", "tarefas")} com entrega prevista para amanhã`,
      message: `${ts.filter((t) => t.status === "todo").length} ainda não iniciadas. Considere redistribuir parte delas.`,
      action: { label: "Redistribuir tarefas", href: "/equipe" },
    });
  }
  for (const t of i.tasks) {
    if (t.status !== "todo" || !t.due_date || t.due_date < today) continue;
    const cfg = settingsFor(i.settings, t.client_id);
    if (diffDays(t.due_date, today) > cfg.deadline_warning_days) continue;
    if (t.due_date === tomorrow && (byAssigneeTomorrow.get(t.assignee_id ?? "")?.length ?? 0) >= 3) continue; // coberta pelo alerta agregado
    out.push({
      id: `risco-prazo:${t.id}`, level: "informativo", kind: "risco", clientId: t.client_id, estimated: true,
      title: `Prazo próximo: ${t.title}`,
      message: `Vence em ${formatBR(t.due_date)} e ainda não foi iniciada · ${uname(t.assignee_id)}.`,
      action: { label: "Abrir tarefa", href: `/tarefas?tarefa=${t.id}` },
    });
  }

  // 5) Aprovação pendente do cliente
  const waiting = new Map<string, ContentLite[]>();
  for (const c of i.contents) if (!c.cancelled_at && c.approval_state === "aguardando") waiting.set(c.client_id, [...(waiting.get(c.client_id) ?? []), c]);
  for (const [cid, cs] of waiting) {
    const cfg = settingsFor(i.settings, cid);
    const hours = (c: ContentLite) => (Date.now() - new Date(c.status_changed_at).getTime()) / 3600000;
    const slow = cs.filter((c) => hours(c) > cfg.approval_wait_hours);
    if (slow.length) {
      out.push({
        id: `aprovacao-lenta:${cid}`, level: "atencao", kind: "aprovacao", clientId: cid, estimated: false,
        title: `Atenção: ${cname(cid)} está com ${plural(slow.length, "conteúdo aguardando", "conteúdos aguardando")} aprovação há mais de ${cfg.approval_wait_hours}h`,
        message: `Mais antigo: “${slow.sort((a, b) => a.status_changed_at.localeCompare(b.status_changed_at))[0].title}”.`,
        action: { label: "Solicitar aprovação ao cliente", href: `/pipeline?cliente=${cid}&aprovacao=aguardando` },
      });
    }
    const fresh = cs.length - slow.length;
    if (fresh > 0) out.push({
      id: `aprovacao:${cid}`, level: "informativo", kind: "aprovacao", clientId: cid, estimated: false,
      title: `${cname(cid)}: ${plural(fresh, "conteúdo aguarda", "conteúdos aguardam")} aprovação`,
      message: "Dentro do prazo esperado de resposta.",
      action: { label: "Ver conteúdos", href: `/pipeline?cliente=${cid}&aprovacao=aguardando` },
    });
  }

  // 6) Captações
  for (const s of i.shoots) {
    if (s.status !== "agendada" && s.status !== "reagendada") continue;
    const day = brDate(s.starts_at);
    const cn = cname(s.client_id);
    if (day < today) {
      out.push({
        id: `captacao-pendente:${s.id}`, level: "atencao", kind: "captacao", clientId: s.client_id, estimated: false,
        title: `${cn}: captação de ${formatBR(day)} sem registro de conclusão`,
        message: "Marque como realizada ou reagende para manter o contrato e a carga da equipe corretos.",
        action: { label: "Atualizar captação", href: "/captacoes" },
      });
    } else if (day <= addDays(today, 1)) {
      out.push({
        id: `captacao:${s.id}`, level: day === today ? "atencao" : "informativo", kind: "captacao", clientId: s.client_id, estimated: false,
        title: `${cn}: captação agendada para ${day === today ? "hoje" : "amanhã"}`,
        message: "Confirme equipe, equipamentos e roteiros.",
        action: { label: "Ver captação", href: "/captacoes" },
      });
    }
  }

  // 7) Capacidade
  for (const c of i.capacities) {
    if (c.status === "disponivel") continue;
    const nm = c.member.full_name.split(" ")[0];
    out.push({
      id: `capacidade:${c.member.user_id}`, level: c.status === "sobrecarregado" ? "critico" : "atencao", kind: "capacidade", estimated: true,
      title: c.status === "sobrecarregado" ? `Capacidade insuficiente: ${nm} tem mais horas planejadas do que disponíveis nesta semana` : `${nm} está próximo do limite de capacidade`,
      message: `${c.planned}h planejadas de ${c.available}h disponíveis.` + (c.missingEstimate ? ` ${plural(c.missingEstimate, "tarefa sem estimativa não entrou", "tarefas sem estimativa não entraram")} no cálculo.` : ""),
      action: { label: "Redistribuir tarefas", href: "/equipe" },
    });
  }

  // 8) Contratos próximos do encerramento
  for (const k of i.contracts) {
    if (k.status !== "ativo" || !k.end_date || !activeClients.has(k.client_id)) continue;
    const d = diffDays(k.end_date, today);
    const cfg = settingsFor(i.settings, k.client_id);
    if (d < 0 || d > cfg.contract_end_warning_days) continue;
    out.push({
      id: `encerramento:${k.client_id}:${k.end_date}`, level: d <= 7 ? "atencao" : "informativo", kind: "encerramento", clientId: k.client_id, estimated: false,
      title: `Contrato de ${cname(k.client_id)} encerra em ${formatBR(k.end_date)}`,
      message: `Faltam ${plural(d, "dia", "dias")}. Planeje a renovação ou o fechamento.`,
      action: { label: "Abrir cliente", href: `/clientes/${k.client_id}` },
    });
  }

  // 9) Previsão por conteúdo: etapas que faltam até “agendado” × dias até a publicação
  if (i.dwell && i.statuses) out.push(...leadTimeAlerts(i, today, cname));

  return out.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || a.title.localeCompare(b.title));
}

const MIN_SAMPLES = 3;
const FALLBACK_DAYS_PER_STAGE = 1;

/**
 * Estima quantos dias faltam para o conteúdo chegar a “agendado” somando a permanência média histórica das etapas restantes
 * (por tipo de conteúdo). Etapas sem amostra suficiente usam uma regra fixa e o alerta informa que a base é operacional.
 */
export function leadTimeAlerts(i: AlertInput, today: string, cname: (id: string | null | undefined) => string): OpsAlert[] {
  const out: OpsAlert[] = [];
  const active = new Set(i.clients.filter((c) => c.status === "ativo").map((c) => c.id));
  const path = (typeId: string) => {
    const own = i.statuses!.filter((s) => s.deliverable_type_id === typeId);
    return (own.length ? own : i.statuses!.filter((s) => s.deliverable_type_id === null)).sort((a, b) => a.position - b.position);
  };
  for (const c of i.contents) {
    if (c.cancelled_at || c.delivery_stage >= 3 || !c.publish_date || c.publish_date < today || !active.has(c.client_id)) continue;
    const steps = path(c.deliverable_type_id);
    const idx = steps.findIndex((s) => s.id === c.status_id);
    if (idx < 0) continue;
    const remaining = steps.slice(idx).filter((s) => s.stage < 3); // etapa atual + as seguintes até aprovação
    let days = 0, withData = 0, samples = 0;
    for (const s of remaining) {
      const st = i.dwell!.get(`${c.deliverable_type_id}:${s.id}`);
      if (st && st.n >= MIN_SAMPLES) { days += st.avgDays; withData++; samples += st.n; } else days += FALLBACK_DAYS_PER_STAGE;
    }
    const left = diffDays(c.publish_date, today);
    if (days <= left) continue;
    const ratio = left > 0 ? days / left : Infinity;
    const basis = withData === remaining.length && remaining.length > 0
      ? `Base: histórico de ${Math.round(samples / withData)} conteúdos por etapa.`
      : withData > 0 ? "Base: histórico parcial + regras operacionais (poucos dados em algumas etapas)." : "Base: regras operacionais (ainda não há histórico suficiente).";
    out.push({
      id: `prazo-previsto:${c.id}`, level: ratio >= 1.5 ? "critico" : "atencao", kind: "risco", clientId: c.client_id, estimated: true,
      title: `Risco de atraso: “${c.title}” (${cname(c.client_id)}) pode não ficar pronto para ${formatBR(c.publish_date)}`,
      message: `Estimativa de ~${Math.round(days * 10) / 10} dia(s) até ficar pronto; faltam ${left} dia(s) para a publicação. ${basis}`,
      action: { label: "Antecipar etapas ou revisar o cronograma", href: `/conteudos/${c.id}` },
    });
  }
  return out;
}
