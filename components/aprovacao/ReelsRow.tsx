"use client";

import { useState } from "react";
import type { ContentItem } from "@/lib/aprovacao/types";
import { StatusBadge } from "./StatusBadge";
import { ReelPlayer } from "./ReelPlayer";

export function ReelsRow({
  reels,
  isAdmin,
  onApprove,
  onRequestChanges,
  onDelete,
}: {
  reels: ContentItem[];
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = reels.find((r) => r.id === openId) ?? null;

  if (reels.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-river-ink2">Reels</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-0.5 py-1">
        {reels.map((r) => (
          <button
            key={r.id}
            onClick={() => setOpenId(r.id)}
            className="group relative w-[150px] sm:w-[170px] shrink-0 overflow-hidden rounded-xl bg-black shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
          >
            <div className="relative aspect-[9/16]">
              <video
                src={r.media[0].url}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(e) => e.currentTarget.play().catch(() => undefined)}
                onMouseLeave={(e) => {
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/10" />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-90 transition-opacity duration-200 group-hover:opacity-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
                  <span className="ml-0.5 text-white text-[16px]">▶</span>
                </div>
              </div>
              <div className="absolute top-2 left-2">
                <StatusBadge status={r.status} className="!bg-black/55 !text-white !border-white/20" />
              </div>
              <div className="absolute bottom-2 left-2 right-2 text-left">
                <p className="truncate text-[11.5px] font-semibold text-white">{r.cliente}</p>
                {r.caption && <p className="line-clamp-2 text-[10.5px] text-white/75">{r.caption}</p>}
              </div>
            </div>
          </button>
        ))}
      </div>

      {openItem && (
        <ReelPlayer
          item={openItem}
          isAdmin={isAdmin}
          onClose={() => setOpenId(null)}
          onApprove={() => onApprove(openItem.id)}
          onRequestChanges={(note) => onRequestChanges(openItem.id, note)}
          onDelete={() => {
            onDelete(openItem.id);
            setOpenId(null);
          }}
        />
      )}
    </section>
  );
}
