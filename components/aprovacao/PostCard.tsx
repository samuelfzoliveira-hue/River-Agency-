"use client";

import type { ContentItem } from "@/lib/aprovacao/types";
import { ApprovalActions } from "./ApprovalActions";
import { MediaCarousel } from "./MediaCarousel";

export function PostCard({
  item,
  isAdmin,
  onOpen,
  onApprove,
  onRequestChanges,
  onDelete,
  style,
}: {
  item: ContentItem;
  isAdmin: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onRequestChanges: (note: string) => void;
  onDelete: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <article
      style={style}
      className="animate-fade-in-up group overflow-hidden rounded-2xl border border-river-line bg-white shadow-[0_1px_2px_rgba(18,24,43,.04),0_10px_24px_-14px_rgba(18,24,43,.14)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_4px_10px_rgba(18,24,43,.06),0_22px_44px_-18px_rgba(18,24,43,.22)]"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-river-accent to-river-accentDeep text-[11px] font-bold text-white">
            RA
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-river-ink">River Agency</div>
            <div className="truncate text-[11px] text-river-ink3">{item.cliente}</div>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-river-canvas px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-river-ink3">
          {item.type === "carousel" ? "Carrossel" : "Feed"}
        </span>
      </div>

      <div className="cursor-zoom-in" onClick={onOpen}>
        <MediaCarousel media={item.media} aspectClassName="aspect-square" />
      </div>

      <div className="px-4 pt-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-river-ink3 mb-1">Legenda</p>
        {item.caption ? (
          <p className="text-[13px] leading-relaxed text-river-ink whitespace-pre-wrap">
            <span className="font-semibold">River Agency</span> {item.caption}
          </p>
        ) : (
          <p className="text-[13px] italic text-river-ink3">Sem legenda adicionada.</p>
        )}
      </div>

      <div className="p-4 pt-3">
        <ApprovalActions
          status={item.status}
          clientNote={item.clientNote}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
        />
        {isAdmin && (
          <button
            type="button"
            onClick={onDelete}
            className="mt-3 text-[11px] font-medium text-river-ink3 transition hover:text-river-bad"
          >
            Remover conteúdo
          </button>
        )}
      </div>
    </article>
  );
}
