"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";

type Item = { id: string; text: string; done: boolean };

/** Checklist reutilizável (conteúdo): salva pela action recebida. */
export function ChecklistEditor({ initial, save }: { initial: Item[]; save: (items: Item[]) => Promise<{ error?: string }> }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const persist = (next: Item[]) => {
    setItems(next);
    setMsg(null);
    start(async () => {
      const r = await save(next);
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Salvo" });
    });
  };
  const add = () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    persist([...items, { id: crypto.randomUUID(), text: t, done: false }]);
  };
  const done = items.filter((i) => i.done).length;

  return (
    <div>
      {items.length > 0 && <p className="mb-2 text-xs text-muted">{done} de {items.length} concluídos</p>}
      <ul className="space-y-1.5">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={i.done} onChange={() => persist(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))} aria-label={i.text} />
            <span className={`flex-1 ${i.done ? "text-muted line-through" : ""}`}>{i.text}</span>
            <button type="button" className="text-muted hover:text-bad" aria-label={`Remover ${i.text}`} onClick={() => persist(items.filter((x) => x.id !== i.id))}><X size={14} /></button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Novo item" aria-label="Novo item do checklist"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <button type="button" className="btn" onClick={add} disabled={pending}><Plus size={14} /> Adicionar</button>
      </div>
      {msg && <p role="status" className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
    </div>
  );
}
