"use client";

import type { ContentItem } from "@/lib/aprovacao/types";
import { ApprovalActions } from "./ApprovalActions";
import { MediaCarousel } from "./MediaCarousel";
import { Modal } from "./Modal";

export function PostModal({
  item,
  isAdmin = false,
  onClose,
  onApprove,
  onRequestChanges,
  onDelete,
}: {
  item: ContentItem;
  isAdmin?: boolean;
  onClose: () => void;
  onApprove: () => void;
  onRequestChanges: (note: string) => void;
  onDelete?: () => void;
}) {
  return (
    <Modal onClose={onClose} contentClassName="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden md:flex">
      <div className="md:w-[58%] bg-black">
        <MediaCarousel media={item.media} aspectClassName="aspect-square md:h-full" hoverPlay={false} />
      </div>

      <div className="md:w-[42%] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-river-line">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-river-accent to-river-accentDeep text-[12px] font-bold text-white">
              RA
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-river-ink">River Agency</div>
              <div className="truncate text-[11.5px] text-river-ink3">{item.cliente}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-full text-river-ink3 transition hover:bg-river-canvas hover:text-river-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 px-5 py-4 overflow-y-auto">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-river-ink3 mb-1.5">Legenda</p>
          {item.caption ? (
            <p className="text-[13.5px] leading-relaxed text-river-ink whitespace-pre-wrap">
              <span className="font-semibold">River Agency</span> {item.caption}
            </p>
          ) : (
            <p className="text-[13.5px] italic text-river-ink3">Sem legenda adicionada.</p>
          )}
        </div>

        <div className="p-5 border-t border-river-line">
          <ApprovalActions
            status={item.status}
            clientNote={item.clientNote}
            onApprove={onApprove}
            onRequestChanges={onRequestChanges}
          />
          {isAdmin && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="mt-3 text-[11px] font-medium text-river-ink3 transition hover:text-river-bad"
            >
              Remover conteúdo
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
