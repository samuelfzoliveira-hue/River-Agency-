"use client";

import { useState } from "react";
import type { ContentItem } from "@/lib/aprovacao/types";
import { StoryViewer } from "./StoryViewer";

export function StoryTray({
  stories,
  isAdmin,
  onApprove,
  onRequestChanges,
  onDelete,
}: {
  stories: ContentItem[];
  isAdmin: boolean;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
  onDelete: (id: string) => void;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (stories.length === 0) return null;

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-river-ink2">Stories</h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar px-0.5 py-1">
        {stories.map((s, i) => {
          const seenRing = s.status === "aprovado" ? "opacity-60" : "";
          return (
            <button
              key={s.id}
              onClick={() => setOpenIndex(i)}
              className="group flex shrink-0 flex-col items-center gap-1.5"
            >
              <div
                className={`ig-ring h-16 w-16 rounded-full p-[2.5px] transition-transform duration-200 group-hover:scale-105 ${seenRing}`}
              >
                <div className="h-full w-full rounded-full bg-white p-[2px]">
                  <div className="h-full w-full overflow-hidden rounded-full bg-black">
                    {s.media[0].kind === "video" ? (
                      <video src={s.media[0].url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.media[0].url} className="h-full w-full object-cover" alt="" />
                    )}
                  </div>
                </div>
              </div>
              <span className="max-w-[68px] truncate text-[10.5px] text-river-ink2">{s.cliente}</span>
            </button>
          );
        })}
      </div>

      {openIndex !== null && (
        <StoryViewer
          stories={stories}
          startIndex={openIndex}
          isAdmin={isAdmin}
          onClose={() => setOpenIndex(null)}
          onApprove={onApprove}
          onRequestChanges={onRequestChanges}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}
