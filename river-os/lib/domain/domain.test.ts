import { describe, expect, it } from "vitest";
import { buildAlerts, settingsFor } from "./alerts";
import { buildCalendarItems } from "./calendar";
import { availableHours, computeCapacity, loadStatus } from "./capacity";
import { computeClientCompetence } from "./contracts";
import { addDays, businessDaysBetween, brDate, monthEnd, mondaysInMonth, weekStart } from "./dates";
import type { ContentLite, DeliverableType, ShootLite, Target, TaskLite } from "./types";

const types: DeliverableType[] = [
  { id: "reel", key: "reel", name: "Reel", kind: "content", default_hours: 6 },
  { id: "post", key: "post", name: "Post", kind: "content", default_hours: 2 },
  { id: "cap", key: "captacao", name: "Captação", kind: "shoot", default_hours: 3 },
];
const TODAY = "2026-10-20";
const content = (o: Partial<ContentLite> & { id: string }): ContentLite => ({
  title: o.id, client_id: "A", competence: "2026-10-01", deliverable_type_id: "reel", status_id: "s", delivery_stage: 0, approval_state: null,
  is_extra: false, cancelled_at: null, internal_deadline: null, publish_date: null, published_late: false,
  status_changed_at: "2026-10-18T12:00:00Z", assignee_id: null, ...o,
});
const target = (typeId: string, quantity: number, criterion: Target["completion_criterion"] = "published"): Target => ({
  contract_id: "k", client_id: "A", competence: "2026-10-01", deliverable_type_id: typeId, quantity, completion_criterion: criterion,
});
const shoot = (o: Partial<ShootLite> & { id: string }): ShootLite => ({
  title: "Captação", client_id: "A", competence: "2026-10-01", starts_at: "2026-10-10T15:00:00Z", status: "agendada", is_extra: false, ...o,
});

describe("datas", () => {
  it("dias úteis e semanas", () => {
    expect(businessDaysBetween("2026-10-19", "2026-10-25")).toBe(5);
    expect(businessDaysBetween("2026-10-24", "2026-10-25")).toBe(0);
    expect(mondaysInMonth("2026-10-15")).toBe(4);
    expect(mondaysInMonth("2026-11-15")).toBe(5);
    expect(monthEnd("2026-02-10")).toBe("2026-02-28");
    expect(weekStart("2026-10-25")).toBe("2026-10-19");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("converte instante para o fuso da agência", () => {
    expect(brDate("2026-10-21T01:30:00Z")).toBe("2026-10-20"); // 22:30 em Brasília
  });
});

describe("cumprimento contratual", () => {
  it("conta apenas conteúdos que atingiram o critério (publicado)", () => {
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, types, shoots: [],
      targets: [target("reel", 8)],
      contents: [
        ...Array.from({ length: 5 }, (_, i) => content({ id: `p${i}`, delivery_stage: 4 })),
        content({ id: "ap", delivery_stage: 2 }),
        content({ id: "ed", delivery_stage: 0 }),
      ],
    });
    const l = r.lines[0];
    expect(l).toMatchObject({ contracted: 8, delivered: 5, approved: 6, published: 5, produced: 6, pending: 3, inProgress: 2, pct: 63 });
    expect(r.state).toBe("em_andamento");
  });

  it("o critério 'aprovação' conta aprovados, agendados e publicados", () => {
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, types, shoots: [], targets: [target("post", 3, "approved")],
      contents: [2, 3, 4, 1].map((s, i) => content({ id: `c${i}`, deliverable_type_id: "post", delivery_stage: s })),
    });
    expect(r.lines[0].delivered).toBe(3);
    expect(r.lines[0].pending).toBe(0);
    expect(r.state).toBe("completo");
  });

  it("nunca conta o mesmo conteúdo duas vezes, ignora cancelados e separa extras", () => {
    const dup = content({ id: "x", delivery_stage: 4 });
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, types, shoots: [], targets: [target("reel", 4)],
      contents: [dup, { ...dup }, content({ id: "canc", delivery_stage: 4, cancelled_at: "2026-10-02T00:00:00Z" }), content({ id: "ex", delivery_stage: 4, is_extra: true })],
    });
    expect(r.lines[0]).toMatchObject({ delivered: 1, extras: 1, pending: 3 });
    expect(r.delivered).toBe(1);
  });

  it("excesso de um tipo não compensa falta de outro; excedente é informado", () => {
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, shoots: [], types,
      targets: [target("reel", 1), target("post", 2)],
      contents: [content({ id: "a", delivery_stage: 4 }), content({ id: "b", delivery_stage: 4 }), content({ id: "c", delivery_stage: 4 })],
    });
    expect(r.lines.find((l) => l.typeId === "reel")).toMatchObject({ surplus: 2, pct: 100 });
    expect(r.contracted).toBe(3);
    expect(r.delivered).toBe(1);
    expect(r.pct).toBe(33);
  });

  it("marca atrasos e preserva publicações fora do prazo", () => {
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, shoots: [], types, targets: [target("reel", 3)],
      contents: [
        content({ id: "a", internal_deadline: "2026-10-10" }),
        content({ id: "b", publish_date: "2026-10-30" }),
        content({ id: "c", delivery_stage: 4, published_late: true }),
      ],
    });
    expect(r.lines[0]).toMatchObject({ late: 1, publishedLate: 1, delivered: 1 });
  });

  it("captações contam quando realizadas; canceladas e extras não entram na meta", () => {
    const r = computeClientCompetence({
      clientId: "A", competence: "2026-10-01", today: TODAY, contents: [], types, targets: [target("cap", 2)],
      shoots: [shoot({ id: "1", status: "realizada" }), shoot({ id: "2", starts_at: "2026-10-28T15:00:00Z" }), shoot({ id: "3", status: "cancelada" }), shoot({ id: "4", is_extra: true, status: "realizada" })],
    });
    expect(r.lines[0]).toMatchObject({ contracted: 2, delivered: 1, pending: 1, extras: 1, inProgress: 1 });
  });

  it("mês passado com pendência é 'incompleto'; cliente sem meta é 'sem_meta'", () => {
    const past = computeClientCompetence({
      clientId: "A", competence: "2026-09-01", today: TODAY, shoots: [], types, contents: [],
      targets: [{ ...target("reel", 2), competence: "2026-09-01" }],
    });
    expect(past.state).toBe("incompleto");
    expect(computeClientCompetence({ clientId: "A", competence: "2026-10-01", today: TODAY, shoots: [], types, contents: [], targets: [] }).state).toBe("sem_meta");
  });
});

describe("capacidade", () => {
  const m = (id: string, h = 30) => ({ user_id: id, full_name: id, role: "designer", job_title: null, weekly_capacity_hours: h, active: true });
  const task = (o: Partial<TaskLite> & { id: string }): TaskLite => ({
    title: o.id, client_id: null, content_id: null, assignee_id: "e", status: "todo", priority: "media", due_date: "2026-10-22",
    estimated_hours: 1, logged_hours: 0, completed_at: null, ...o,
  });
  it("classifica ocupação como nos exemplos do briefing", () => {
    expect(loadStatus(18, 30)).toBe("disponivel");
    expect(loadStatus(25, 30)).toBe("atencao");
    expect(loadStatus(32, 30)).toBe("sobrecarregado");
    expect(loadStatus(0, 0)).toBe("disponivel");
    expect(loadStatus(2, 0)).toBe("sobrecarregado");
  });
  it("desconta férias e fins de semana das horas disponíveis", () => {
    const off = [{ user_id: "e", starts_on: "2026-10-21", ends_on: "2026-10-22", kind: "ferias" as const }];
    expect(availableHours(m("e"), "2026-10-19", "2026-10-25", [])).toBe(30);
    expect(availableHours(m("e"), "2026-10-19", "2026-10-25", off)).toBe(18);
  });
  it("soma horas estimadas sem presumir complexidade igual e sinaliza tarefas sem estimativa", () => {
    const r = computeCapacity({
      members: [m("e")], unavailability: [], granularity: "semana", ref: TODAY, today: TODAY,
      tasks: [task({ id: "1", estimated_hours: 12 }), task({ id: "2", estimated_hours: 6 }), task({ id: "3", estimated_hours: null }),
        task({ id: "4", due_date: "2026-10-30", estimated_hours: 40 }), task({ id: "5", status: "done", estimated_hours: 9, completed_at: "2026-10-20T10:00:00Z" })],
    }).members[0];
    expect(r.planned).toBe(18);
    expect(r.status).toBe("disponivel");
    expect(r.missingEstimate).toBe(1);
    expect(r.doneInPeriod).toBe(1);
  });
  it("tarefas atrasadas pesam na semana corrente", () => {
    const r = computeCapacity({
      members: [m("e")], unavailability: [], granularity: "semana", ref: TODAY, today: TODAY,
      tasks: [task({ id: "1", due_date: "2026-10-05", estimated_hours: 20 }), task({ id: "2", estimated_hours: 12 })],
    }).members[0];
    expect(r).toMatchObject({ planned: 32, backlogHours: 20, status: "sobrecarregado", late: 1 });
  });
  it("redistribuir muda a carga: a tarefa sai de um e entra no outro", () => {
    const tasks = [task({ id: "1", estimated_hours: 32 })];
    const before = computeCapacity({ members: [m("e"), m("f")], unavailability: [], tasks, granularity: "semana", ref: TODAY, today: TODAY }).members;
    const after = computeCapacity({ members: [m("e"), m("f")], unavailability: [], tasks: tasks.map((t) => ({ ...t, assignee_id: "f" })), granularity: "semana", ref: TODAY, today: TODAY }).members;
    expect(before[0].status).toBe("sobrecarregado");
    expect(after[0].status).toBe("disponivel");
    expect(after[1].status).toBe("sobrecarregado");
  });
});

describe("alertas", () => {
  const base = { today: TODAY, clients: [{ id: "A", name: "Empresa A", status: "ativo" }], contents: [], tasks: [], shoots: [], capacities: [], members: [{ user_id: "j", full_name: "João Silva" }], contracts: [], settings: [] };
  it("avisa quando pendências superam os dias úteis restantes (crítico) e marca como estimativa", () => {
    const progress = computeClientCompetence({ clientId: "A", competence: "2026-10-01", today: "2026-10-27", shoots: [], contents: [], types, targets: [target("reel", 5)] });
    const a = buildAlerts({ ...base, today: "2026-10-27", progress: [progress] });
    expect(a[0]).toMatchObject({ level: "critico", kind: "contrato", estimated: true });
    expect(a[0].title).toContain("Empresa A: faltam 5 entregas de Reel");
    expect(a[0].message).toContain("5 ainda sem conteúdo iniciado");
    expect(a[0].action.href).toBe("/clientes/A");
  });
  it("limite configurável por cliente muda o nível", () => {
    const progress = computeClientCompetence({ clientId: "A", competence: "2026-10-01", today: TODAY, shoots: [], contents: [], types, targets: [target("reel", 6)] });
    const strict = [{ client_id: "A", deliverable_type_id: null, approval_wait_hours: 48, deadline_warning_days: 2, contract_end_warning_days: 30, min_business_days_per_item: 2 }];
    expect(buildAlerts({ ...base, progress: [progress] }).find((x) => x.kind === "contrato")?.level).toBe("atencao");
    expect(buildAlerts({ ...base, progress: [progress], settings: strict }).find((x) => x.kind === "contrato")?.level).toBe("critico");
    expect(settingsFor(strict, "A").min_business_days_per_item).toBe(2);
    expect(settingsFor(strict, "B").min_business_days_per_item).toBe(1);
  });
  it("tarefa atrasada cita o responsável", () => {
    const t: TaskLite = { id: "t", title: "Edição de vídeo", client_id: "A", content_id: null, assignee_id: "j", status: "doing", priority: "alta", due_date: "2026-10-15", estimated_hours: 4, logged_hours: 0, completed_at: null };
    const a = buildAlerts({ ...base, progress: [], tasks: [t] });
    expect(a[0].title).toBe("Entrega atrasada: Edição de vídeo — responsável: João");
    expect(a[0].level).toBe("critico");
  });
  it("aprovação lenta (>48h) vira atenção; recente fica informativo", () => {
    const old = (id: string) => content({ id, approval_state: "aguardando", delivery_stage: 1, status_changed_at: new Date(Date.now() - 72 * 3600000).toISOString() });
    const fresh = content({ id: "n", approval_state: "aguardando", delivery_stage: 1, status_changed_at: new Date().toISOString() });
    const a = buildAlerts({ ...base, progress: [], contents: [old("1"), old("2"), fresh] });
    expect(a.find((x) => x.id === "aprovacao-lenta:A")?.title).toContain("2 conteúdos aguardando aprovação há mais de 48h");
    expect(a.find((x) => x.id === "aprovacao:A")?.level).toBe("informativo");
  });
  it("captação de amanhã, capacidade e encerramento de contrato", () => {
    const s = shoot({ id: "s", starts_at: "2026-10-21T15:00:00Z" });
    const cap = computeCapacity({ members: [{ user_id: "j", full_name: "João Silva", role: "videomaker", job_title: null, weekly_capacity_hours: 10, active: true }], unavailability: [], granularity: "semana", ref: TODAY, today: TODAY,
      tasks: [{ id: "t", title: "x", client_id: null, content_id: null, assignee_id: "j", status: "todo", priority: "media", due_date: "2026-10-22", estimated_hours: 14, logged_hours: 0, completed_at: null }] }).members;
    const a = buildAlerts({ ...base, progress: [], shoots: [s], capacities: cap, contracts: [{ client_id: "A", end_date: "2026-11-05", status: "ativo" }] });
    expect(a.map((x) => x.kind).sort()).toEqual(["capacidade", "captacao", "encerramento"]);
    expect(a.find((x) => x.kind === "capacidade")?.level).toBe("critico");
    expect(a.find((x) => x.kind === "captacao")?.title).toContain("amanhã");
  });
  it("não alerta sobre clientes inativos", () => {
    const progress = computeClientCompetence({ clientId: "A", competence: "2026-10-01", today: "2026-10-27", shoots: [], contents: [], types, targets: [target("reel", 5)] });
    expect(buildAlerts({ ...base, today: "2026-10-27", clients: [{ id: "A", name: "A", status: "pausado" }], progress: [progress] })).toEqual([]);
  });
});

describe("calendário", () => {
  it("diferencia produção, aprovação e publicação e ignora cancelados", () => {
    const items = buildCalendarItems({
      contents: [content({ id: "1", internal_deadline: "2026-10-10", publish_date: "2026-10-15" }), content({ id: "2", publish_date: "2026-10-16", cancelled_at: "2026-10-01T00:00:00Z" })],
      shoots: [shoot({ id: "s", starts_at: "2026-10-12T17:00:00Z" })],
      events: [{ id: "e", client_id: null, kind: "prazo_aprovacao", title: "Prazo", starts_at: "2026-10-13T12:00:00Z" }],
    });
    expect(items.map((i) => i.kind)).toEqual(["producao", "captacao", "aprovacao", "publicacao"]);
    expect(items.find((i) => i.kind === "captacao")?.time).toBe("14:00");
  });
});

import { buildClosing, carryOverStatus } from "./closing";
describe("fechamento mensal", () => {
  const comp = (reels: number, deliverEach: number) => computeClientCompetence({
    clientId: "A", competence: "2026-09-01", today: "2026-10-05", shoots: [], types, targets: [{ ...target("reel", 8), competence: "2026-09-01" }],
    contents: Array.from({ length: reels }, (_, i) => content({ id: `c${i}`, competence: "2026-09-01", delivery_stage: deliverEach })),
  });
  it("congela o mês e lista pendências com a competência original", () => {
    const { snapshot, pending } = buildClosing(comp(6, 4));
    expect(snapshot).toMatchObject({ contracted: 8, delivered: 6, pending: 2, pct: 75, verdict: "parcial" });
    expect(pending).toEqual([{ typeId: "reel", typeName: "Reel", quantity: 2, competence: "2026-09-01" }]);
  });
  it("mês completo é 'cumprido' e sem pendências", () => {
    const { snapshot, pending } = buildClosing(comp(8, 4));
    expect(snapshot.verdict).toBe("cumprido");
    expect(pending).toEqual([]);
  });
  it("acompanha regularização posterior sem alterar o snapshot", () => {
    const { pending } = buildClosing(comp(6, 4));
    const later = carryOverStatus(pending, comp(7, 4));
    expect(later[0]).toMatchObject({ quantity: 2, stillPending: 1, resolved: 1, competence: "2026-09-01" });
  });
});

import { buildClosingPdf } from "../pdf/closing";
describe("PDF de fechamento", () => {
  it("gera um PDF válido com acentos e pendências", () => {
    const { snapshot, pending } = buildClosing(computeClientCompetence({ clientId: "A", competence: "2026-09-01", today: "2026-10-05", shoots: [], types,
      targets: [{ ...target("reel", 8), competence: "2026-09-01" }], contents: [content({ id: "x", competence: "2026-09-01", delivery_stage: 4 })] }));
    const doc = buildClosingPdf({ agency: "River Agency", client: "Empresa Ação", competenceLabel: "setembro de 2026", snapshot, pending, status: "fechado", notes: "Cliente atrasou aprovações. ".repeat(20) });
    const bytes = new Uint8Array(doc.output("arraybuffer"));
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2000);
  });
});

import { buildDwellStats, deliveryReport, dwellReport, monthsBetween, productionSummary, productivityReport, productivityTrend, revisionReport, toCsv, type ContentFull, type HistoryRow, type StatusLite } from "./reports";
import { parseDriveLink, driveThumbnail } from "../integrations/drive";

describe("relatórios", () => {
  const full = (o: Partial<ContentFull> & { id: string }): ContentFull => ({ ...content(o), created_at: "2026-10-01T12:00:00Z", approved_at: null, published_at: null, ...o });
  it("meses do período", () => { expect(monthsBetween("2026-08-15", "2026-10-02")).toEqual(["2026-08-01", "2026-09-01", "2026-10-01"]); });
  it("previstas × realizadas por cliente e mês, com totais", () => {
    const r = deliveryReport({ clients: [{ id: "A", name: "Empresa A" }], from: "2026-09-01", to: "2026-10-31", types, shoots: [], today: "2026-10-28",
      targets: [{ ...target("reel", 4), competence: "2026-09-01" }, target("reel", 4)],
      contents: [content({ id: "s1", competence: "2026-09-01", delivery_stage: 4 }), content({ id: "s2", competence: "2026-09-01", delivery_stage: 4 }), content({ id: "o1", delivery_stage: 4 })] });
    expect(r.rows.map((x) => [x.competence, x.delivered, x.contracted])).toEqual([["2026-09-01", 2, 4], ["2026-10-01", 1, 4]]);
    expect(r.byClient[0]).toMatchObject({ contracted: 8, delivered: 3, pct: 38 });
  });
  it("produtividade: pontualidade, horas e entregas do responsável", () => {
    const t = (id: string, due: string | null, done: string, est: number, logged: number): TaskLite => ({ id, title: id, client_id: null, content_id: null, assignee_id: "j", status: "done", priority: "media", due_date: due, estimated_hours: est, logged_hours: logged, completed_at: done });
    const tasks = [t("a", "2026-10-10", "2026-10-09T15:00:00Z", 2, 3), t("b", "2026-10-10", "2026-10-12T15:00:00Z", 4, 4), t("c", null, "2026-09-02T15:00:00Z", 1, 1)];
    const r = productivityReport({ people: [{ user_id: "j", full_name: "João" }], tasks, from: "2026-10-01", to: "2026-10-31", today: "2026-10-28",
      contents: [full({ id: "x", assignee_id: "j", approved_at: "2026-10-05T12:00:00Z", published_at: "2026-10-06T12:00:00Z" })] })[0];
    expect(r).toMatchObject({ done: 2, onTime: 1, onTimePct: 50, estimatedHours: 6, loggedHours: 7, contentsApproved: 1, contentsPublished: 1 });
    expect(productivityTrend({ people: [{ user_id: "j", full_name: "João" }], tasks, from: "2026-09-01", to: "2026-10-31" }).rows[0].perMonth).toEqual([1, 2]);
  });
  it("tempo médio de produção e publicações fora do prazo", () => {
    const s = productionSummary({ from: "2026-10-01", to: "2026-10-31", shoots: [shoot({ id: "s", status: "realizada", starts_at: "2026-10-10T15:00:00Z" })],
      contents: [full({ id: "a", created_at: "2026-10-01T00:00:00Z", approved_at: "2026-10-04T00:00:00Z", published_at: "2026-10-06T00:00:00Z", published_late: true }), full({ id: "b", created_at: "2026-10-01T00:00:00Z", approved_at: "2026-10-03T00:00:00Z", published_at: "2026-10-04T00:00:00Z" })] });
    expect(s).toMatchObject({ approved: 2, published: 2, publishedLate: 1, avgDaysToApproval: 2.5, avgDaysToPublish: 4, shootsDone: 1 });
  });
  const statuses: StatusLite[] = [
    { id: "ed", name: "Edição", position: 6, stage: 0, deliverable_type_id: null }, { id: "ap", name: "Aguardando aprovação", position: 8, stage: 1, deliverable_type_id: null },
    { id: "ro", name: "Roteiro", position: 3, stage: 0, deliverable_type_id: null }, { id: "pb", name: "Publicado", position: 12, stage: 4, deliverable_type_id: null },
  ];
  const h = (cid: string, sid: string, stage: number, ap: string | null, from: string, days: number | null, backfilled = false): HistoryRow => ({
    content_id: cid, status_id: sid, stage, approval_state: ap, entered_at: from, left_at: days == null ? null : new Date(new Date(from).getTime() + days * 86400000).toISOString(), backfilled });
  const cs = ["1", "2", "3", "4"].map((id) => content({ id, deliverable_type_id: "reel" }));
  const hist = [...cs.flatMap((c) => [h(c.id, "ro", 0, null, "2026-10-01T00:00:00Z", 1), h(c.id, "ed", 0, null, "2026-10-02T00:00:00Z", 5), h(c.id, "ap", 1, "aguardando", "2026-10-07T00:00:00Z", 1.5)]), h("1", "ed", 0, null, "2026-09-01T00:00:00Z", 99, true)];
  it("permanência por etapa, ignora linhas retroalimentadas e aponta gargalo", () => {
    const d = dwellReport({ statuses, history: hist, contents: cs, from: "2026-10-01", to: "2026-10-31" });
    expect(d.find((r) => r.statusId === "ed")).toMatchObject({ n: 4, avgDays: 5, bottleneck: true });
    expect(d.find((r) => r.statusId === "ro")?.bottleneck).toBe(false);
    expect(d.find((r) => r.statusId === "pb")?.n).toBe(0);
  });
  it("revisões por cliente (entradas em 'ajustes')", () => {
    const hh = [h("1", "aj", 1, "ajustes", "2026-10-10T00:00:00Z", 1), h("1", "aj", 1, "ajustes", "2026-10-15T00:00:00Z", 1), h("2", "aj", 1, "ajustes", "2026-10-16T00:00:00Z", null)];
    const r = revisionReport({ clients: [{ id: "A", name: "Empresa A" }], contents: cs, history: hh, from: "2026-10-01", to: "2026-10-31" });
    expect(r.rows[0]).toMatchObject({ revisions: 3, contentsWithRevision: 2, avgPerContent: 1.5 });
  });
  it("estatísticas de permanência alimentam a previsão de prazo", () => {
    const stats = buildDwellStats(hist, cs);
    expect(stats.get("reel:ed")).toMatchObject({ n: 4, avgDays: 5 });
    const open = content({ id: "z", deliverable_type_id: "reel", status_id: "ed", delivery_stage: 0, publish_date: "2026-10-30", title: "Reel Z" });
    const a = buildAlerts({ today: "2026-10-28", clients: [{ id: "A", name: "Empresa A", status: "ativo" }], progress: [], contents: [open], tasks: [], shoots: [], capacities: [], members: [], contracts: [], settings: [], dwell: stats, statuses });
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ kind: "risco", estimated: true, level: "critico" });
    expect(a[0].message).toContain("Base: histórico");
  });
  it("sem histórico suficiente a previsão usa regras e avisa", () => {
    const open = content({ id: "z", deliverable_type_id: "reel", status_id: "ed", delivery_stage: 0, publish_date: "2026-10-29" });
    const a = buildAlerts({ today: "2026-10-28", clients: [{ id: "A", name: "A", status: "ativo" }], progress: [], contents: [open], tasks: [], shoots: [], capacities: [], members: [], contracts: [], settings: [], dwell: new Map(), statuses });
    expect(a[0].message).toContain("regras operacionais");
    expect(buildAlerts({ today: "2026-10-28", clients: [{ id: "A", name: "A", status: "ativo" }], progress: [], contents: [{ ...open, publish_date: "2026-11-20" }], tasks: [], shoots: [], capacities: [], members: [], contracts: [], settings: [], dwell: new Map(), statuses })).toEqual([]);
  });
  it("CSV com separador ;, BOM, aspas e proteção contra fórmulas", () => {
    const csv = toCsv(["Cliente", "Nota"], [["Empresa; A", 'diz "oi"'], ["=HYPERLINK(1)", -5]]);
    expect(csv.startsWith("﻿Cliente;Nota\r\n")).toBe(true);
    expect(csv).toContain('"Empresa; A";"diz ""oi"""');
    expect(csv).toContain("'=HYPERLINK(1);-5");
  });
});

describe("Google Drive", () => {
  it("reconhece arquivos, pastas e docs e ignora outros links", () => {
    expect(parseDriveLink("https://drive.google.com/file/d/1AbCdEfGhIjK_lmn/view?usp=sharing")).toEqual({ kind: "file", id: "1AbCdEfGhIjK_lmn" });
    expect(parseDriveLink("https://drive.google.com/drive/folders/1AbCdEfGhIjK_lmn")).toEqual({ kind: "folder", id: "1AbCdEfGhIjK_lmn" });
    expect(parseDriveLink("https://docs.google.com/document/d/1AbCdEfGhIjK_lmn/edit")).toEqual({ kind: "doc", id: "1AbCdEfGhIjK_lmn" });
    expect(parseDriveLink("https://evil.com/file/d/1AbCdEfGhIjK_lmn")).toBeNull();
    expect(parseDriveLink("javascript:alert(1)")).toBeNull();
    expect(driveThumbnail("https://drive.google.com/open?id=1AbCdEfGhIjK_lmn")).toBe("https://drive.google.com/thumbnail?id=1AbCdEfGhIjK_lmn&sz=w1200");
    expect(driveThumbnail("https://drive.google.com/drive/folders/1AbCdEfGhIjK_lmn")).toBeNull();
  });
});
