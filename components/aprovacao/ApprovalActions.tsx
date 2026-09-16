"use client";

import { useState } from "react";
import type { ApprovalStatus } from "@/lib/aprovacao/types";
import { StatusBadge } from "./StatusBadge";

export function ApprovalActions({
  status,
  clientNote,
  onApprove,
  onRequestChanges,
  compact = false,
}: {
  status: ApprovalStatus;
  clientNote?: string;
  onApprove: () => void;
  onRequestChanges: (note: string) => void;
  compact?: boolean;
}) {
  const [showNoteField, setShowNoteField] = useState(false);
  const [note, setNote] = useState("");
  const [justApproved, setJustApproved] = useState(false);

  function handleApprove() {
    setJustApproved(true);
    onApprove();
    window.setTimeout(() => setJustApproved(false), 1200);
  }

  function submitNote() {
    if (!note.trim()) return;
    onRequestChanges(note.trim());
    setShowNoteField(false);
    setNote("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusBadge status={status} />
        {justApproved && (
          <span className="animate-pop-check text-[12px] font-semibold text-river-good">Aprovado ✓</span>
        )}
      </div>

      {!showNoteField ? (
        <div className={`flex gap-2 ${compact ? "" : "flex-wrap"}`}>
          <button
            type="button"
            onClick={handleApprove}
            className="flex-1 rounded-lg bg-river-accent px-3 py-2 text-[12.5px] font-semibold text-white transition-all duration-200 hover:bg-river-accentDeep hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            ✓ Aprovar
          </button>
          <button
            type="button"
            onClick={() => setShowNoteField(true)}
            className="flex-1 rounded-lg border border-river-line bg-white px-3 py-2 text-[12.5px] font-semibold text-river-ink2 transition-all duration-200 hover:border-river-bad hover:text-river-bad hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
          >
            ✎ Pedir ajustes
          </button>
        </div>
      ) : (
        <div className="animate-fade-in flex flex-col gap-2">
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Descreva os ajustes desejados..."
            rows={2}
            className="w-full resize-none rounded-lg border border-river-line bg-river-canvas/60 px-3 py-2 text-[12.5px] text-river-ink outline-none placeholder:text-river-ink3 focus:border-river-accent"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitNote}
              disabled={!note.trim()}
              className="flex-1 rounded-lg bg-river-bad px-3 py-2 text-[12.5px] font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              Enviar
            </button>
            <button
              type="button"
              onClick={() => setShowNoteField(false)}
              className="rounded-lg border border-river-line px-3 py-2 text-[12.5px] font-medium text-river-ink3 transition hover:text-river-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {status === "ajustes" && clientNote && (
        <div className="rounded-lg bg-river-badSoft border border-river-badLine px-3 py-2 text-[12px] leading-relaxed text-river-ink2">
          <span className="font-semibold text-river-bad">Observação do cliente: </span>
          {clientNote}
        </div>
      )}
    </div>
  );
}
