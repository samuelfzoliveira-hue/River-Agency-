"use client";

import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";
import { moveContentAction } from "@/lib/actions/contents";

export interface KCol { id: string; name: string; stage: number; approval: string | null }
export interface KCard {
  id: string; title: string; client: string; type: string; statusId: string; assignee: string | null;
  priority: "baixa" | "media" | "alta" | "urgente"; publish: string | null; deadline: string | null;
  late: boolean; check: [number, number]; extra: boolean; late_published: boolean;
}

const PRI: Record<string, string> = { urgente: "bg-bad", alta: "bg-warn", media: "bg-info", baixa: "bg-muted" };
const short = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

function CardBody({ c, dragging }: { c: KCard; dragging?: boolean }) {
  return (
    <div className={`rounded-lg border bg-surface p-3 text-left shadow-sm ${c.late ? "border-bad/50" : "border-line"} ${dragging ? "rotate-1 shadow-lg" : ""}`}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted">
        <span className={`h-2 w-2 rounded-full ${PRI[c.priority]}`} title={`Prioridade ${c.priority}`} />
        <span className="truncate">{c.client}</span>
      </div>
      <p className="text-sm font-medium leading-snug">{c.title}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="badge">{c.type}</span>
        {c.extra && <span className="badge badge-info">extra</span>}
        {c.late && <span className="badge badge-bad">atrasado</span>}
        {c.late_published && <span className="badge badge-warn">publicado fora do prazo</span>}
        {c.publish && <span className="text-muted">📅 {short(c.publish)}</span>}
        {c.check[1] > 0 && <span className="text-muted">☑ {c.check[0]}/{c.check[1]}</span>}
        {c.assignee && <span className="ml-auto text-muted">{c.assignee}</span>}
      </div>
    </div>
  );
}

function Card({ c, cols, onMove }: { c: KCard; cols: KCol[]; onMove: (id: string, to: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: c.id });
  return (
    <div ref={setNodeRef} className={isDragging ? "opacity-30" : ""}>
      <div {...listeners} {...attributes} className="cursor-grab touch-pan-y active:cursor-grabbing" aria-roledescription="cartão arrastável">
        <Link href={`/conteudos/${c.id}`} draggable={false} className="block"><CardBody c={c} /></Link>
      </div>
      {/* alternativa acessível/mobile ao arrastar */}
      <select aria-label={`Mover “${c.title}” para outra etapa`} className="mt-1 w-full rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-muted md:hidden"
        value={c.statusId} onChange={(e) => onMove(c.id, e.target.value)}>
        {cols.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
      </select>
    </div>
  );
}

function Column({ col, cards, cols, onMove }: { col: KCol; cards: KCard[]; cols: KCol[]; onMove: (id: string, to: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <section ref={setNodeRef} aria-label={col.name} className={`flex w-72 shrink-0 flex-col rounded-xl border bg-sunken/60 ${isOver ? "border-brand" : "border-line"}`}>
      <header className="flex items-center justify-between px-3 py-2.5">
        <h3 className="text-xs font-semibold">{col.name}</h3>
        <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] tabular-nums text-muted">{cards.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {cards.map((c) => <Card key={c.id} c={c} cols={cols} onMove={onMove} />)}
      </div>
    </section>
  );
}

export function Kanban({ cols, cards: initial }: { cols: KCol[]; cards: KCard[] }) {
  const [cards, setCards] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<KCard | null>(null);
  const [, start] = useTransition();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  // se o servidor devolver novos dados (após revalidação), sincroniza
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) { setPrev(initial); setCards(initial); }

  function move(id: string, to: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.statusId === to) return;
    const before = cards;
    setCards((cs) => cs.map((c) => (c.id === id ? { ...c, statusId: to } : c)));
    setError(null);
    start(async () => {
      const r = await moveContentAction(id, to);
      if (r.error) { setCards(before); setError(r.error); }
    });
  }
  function onEnd(e: DragEndEvent) {
    setActive(null);
    if (e.over) move(String(e.active.id), String(e.over.id));
  }
  function onStart(e: DragStartEvent) { setActive(cards.find((c) => c.id === e.active.id) ?? null); }

  return (
    <>
      {error && <p role="alert" className="mb-3 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
      <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
        <div className="-mx-4 overflow-x-auto px-4 pb-4 md:-mx-10 md:px-10">
          <div className="flex gap-3">
            {cols.map((col) => <Column key={col.id} col={col} cols={cols} cards={cards.filter((c) => c.statusId === col.id)} onMove={move} />)}
          </div>
        </div>
        <DragOverlay>{active ? <div className="w-72"><CardBody c={active} dragging /></div> : null}</DragOverlay>
      </DndContext>
    </>
  );
}
