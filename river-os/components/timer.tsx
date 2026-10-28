"use client";

import { Square } from "lucide-react";
import { useEffect, useState } from "react";
import { stopTimerAction } from "@/lib/actions/tasks";

const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

/** Cronômetro em andamento: mostra o tempo decorrido e permite parar de qualquer tela. */
export function RunningTimer({ title, startedAt, taskId }: { title: string; startedAt: string; taskId: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return (
    <form action={stopTimerAction} className="flex items-center gap-2 rounded-lg border border-ok/40 bg-ok/10 px-2.5 py-2" aria-live="polite">
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-ok" />
      <a href={`/tarefas?tarefa=${taskId}`} className="min-w-0 flex-1 truncate text-xs"><span className="block font-mono text-sm font-semibold tabular-nums">{fmt(now - new Date(startedAt).getTime())}</span><span className="text-muted">{title}</span></a>
      <button className="btn btn-sm px-2" aria-label="Parar cronômetro"><Square size={12} /></button>
    </form>
  );
}
