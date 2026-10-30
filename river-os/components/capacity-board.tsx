"use client";

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";
import { reassignTaskDragAction } from "@/lib/actions/tasks";
import { LOAD_LABEL, loadStatus } from "@/lib/domain/capacity";
import { Avatar } from "./ui";

export interface BoardMember { id: string; name: string; sub: string; available: number }
export interface BoardTask { id: string; title: string; assignee: string; hours: number | null; client: string | null; due: string | null; overdue: boolean }

const TONE = { disponivel: "badge-ok", atencao: "badge-warn", sobrecarregado: "badge-bad" } as const;
const BAR = { disponivel: "bg-ok", atencao: "bg-warn", sobrecarregado: "bg-bad" } as const;

function Chip({ t, dragging }: { t: BoardTask; dragging?: boolean }) {
  return (
    <div className={`rounded-lg border bg-surface px-2.5 py-2 text-left text-xs shadow-sm ${t.overdue ? "border-bad/50" : "border-line"} ${dragging ? "rotate-1 shadow-lg" : ""}`}>
      <p className="font-medium leading-snug">{t.title}</p>
      <p className="mt-0.5 text-muted">{t.client ?? "Interna"} · {t.hours != null ? `${t.hours}h` : "sem estimativa"}{t.due ? ` · ${t.due}` : ""}{t.overdue ? " · atrasada" : ""}</p>
    </div>
  );
}
function DragChip({ t }: { t: BoardTask }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={`cursor-grab touch-pan-y active:cursor-grabbing ${isDragging ? "opacity-30" : ""}`} aria-roledescription="tarefa arrastável">
      <Chip t={t} />
    </div>
  );
}
function Col({ m, tasks }: { m: BoardMember; tasks: BoardTask[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: m.id });
  const planned = Math.round(tasks.reduce((a, t) => a + (t.hours ?? 0), 0) * 10) / 10;
  const st = loadStatus(planned, m.available);
  const pct = m.available > 0 ? Math.min((planned / m.available) * 100, 100) : planned > 0 ? 100 : 0;
  return (
    <section ref={setNodeRef} aria-label={`Tarefas de ${m.name}`} className={`flex w-64 shrink-0 flex-col rounded-xl border bg-sunken/60 ${isOver ? "border-brand" : "border-line"}`}>
      <header className="space-y-2 px-3 py-3">
        <div className="flex items-center gap-2"><Avatar name={m.name} size={24} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{m.name}</p><p className="truncate text-[11px] text-muted">{m.sub}</p></div><span className={`badge ${TONE[st]}`} data-testid={`status-${m.id}`}>{LOAD_LABEL[st]}</span></div>
        <div role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${m.name}`} className="h-1.5 overflow-hidden rounded-full bg-surface"><div className={`h-full rounded-full ${BAR[st]}`} style={{ width: `${pct}%` }} /></div>
        <p className="text-[11px] tabular-nums text-muted" data-testid={`hours-${m.id}`}>{planned}h de {m.available}h</p>
      </header>
      <div className="flex min-h-20 flex-1 flex-col gap-2 px-2 pb-2">
        {tasks.map((t) => <DragChip key={t.id} t={t} />)}
        {tasks.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-muted">Solte tarefas aqui</p>}
      </div>
    </section>
  );
}

/** Redistribuição visual: arraste uma tarefa para outra pessoa; as horas e a ocupação são recalculadas na hora. */
export function CapacityBoard({ members, tasks: initial }: { members: BoardMember[]; tasks: BoardTask[] }) {
  const [tasks, setTasks] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) { setPrev(initial); setTasks(initial); }
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<BoardTask | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }));

  function onEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const id = String(e.active.id), to = String(e.over.id), t = tasks.find((x) => x.id === id);
    if (!t || t.assignee === to) return;
    const before = tasks;
    setTasks((ts) => ts.map((x) => (x.id === id ? { ...x, assignee: to } : x)));
    setError(null);
    start(async () => { const r = await reassignTaskDragAction(id, to); if (r.error) { setTasks(before); setError(r.error); } });
  }
  return (
    <>
      {error && <p role="alert" className="mb-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <DndContext sensors={sensors} onDragStart={(e) => setActive(tasks.find((t) => t.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
        <div className="-mx-4 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0"><div className="flex gap-3">{members.map((m) => <Col key={m.id} m={m} tasks={tasks.filter((t) => t.assignee === m.id)} />)}</div></div>
        <DragOverlay>{active ? <div className="w-60"><Chip t={active} dragging /></div> : null}</DragOverlay>
      </DndContext>
      <p className="mt-2 text-xs text-muted">Em telas sem mouse, use o seletor “Redistribuir” em cada cartão abaixo. <Link href="/tarefas" className="link">Ver todas as tarefas</Link></p>
    </>
  );
}
