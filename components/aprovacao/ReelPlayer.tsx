"use client";

import type { ContentItem } from "@/lib/aprovacao/types";
import { ApprovalActions } from "./ApprovalActions";
import { Modal } from "./Modal";

export function ReelPlayer({
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
  const media = item.media[0];

  return (
    <Modal
      onClose={onClose}
      contentClassName="w-full max-w-sm sm:max-w-md rounded-2xl bg-black overflow-hidden relative flex flex-col"
    >
      <div className="relative aspect-[9/16] bg-black">
        <video
          src={media.url}
          className="h-full w-full object-contain"
          controls
          autoPlay
          playsInline
        />
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-3 right-3 z-10 h-8 w-8 flex items-center justify-center rounded-full bg-black/50 text-white/90 transition hover:bg-black/70"
        >
          ✕
        </button>
        <div className="pointer-events-none absolute top-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-semibold text-white">
          Reels
        </div>
      </div>

      <div className="bg-river-ink px-4 py-4">
        <div className="mb-2 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-river-accent to-river-accentDeep text-[10px] font-bold text-white">
            RA
          </div>
          <span className="text-[12.5px] font-semibold text-white">River Agency</span>
          <span className="text-[11px] text-white/50">· {item.cliente}</span>
        </div>
        {item.caption && (
          <p className="mb-3 line-clamp-3 text-[12.5px] leading-relaxed text-white/85">{item.caption}</p>
        )}
        <ApprovalActions
          status={item.status}
          clientNote={item.clientNote}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          compact
        />
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-2 text-[11px] font-medium text-white/50 transition hover:text-river-bad"
          >
            Remover reels
          </button>
        )}
      </div>
    </Modal>
  );
}
