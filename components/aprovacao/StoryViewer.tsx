"use client";

import { useEffect, useState } from "react";
import type { ContentItem } from "@/lib/aprovacao/types";
import { ApprovalActions } from "./ApprovalActions";
import { Modal } from "./Modal";

const IMAGE_DURATION_MS = 5000;

export function StoryViewer({
  stories,
  startIndex,
  isAdmin = false,
  onClose,
  onApprove,
  onRequestChanges,
  onDelete,
}: {
  stories: ContentItem[];
  startIndex: number;
  isAdmin?: boolean;
  onClose: () => void;
  onApprove: (id: string) => void;
  onRequestChanges: (id: string, note: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [paused, setPaused] = useState(false);
  const [videoDurationMs, setVideoDurationMs] = useState<number | null>(null);

  useEffect(() => {
    setVideoDurationMs(null);
  }, [index]);

  if (stories.length === 0 || !stories[index]) return null;
  const current = stories[index];
  const media = current.media[0];
  const durationMs = media.kind === "video" ? videoDurationMs : IMAGE_DURATION_MS;

  function goNext() {
    setIndex((i) => {
      if (i >= stories.length - 1) {
        onClose();
        return i;
      }
      return i + 1;
    });
  }
  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <Modal
      onClose={onClose}
      contentClassName="w-full max-w-sm h-[92vh] sm:h-[88vh] rounded-2xl bg-black overflow-hidden relative flex flex-col"
    >
      <div className="absolute top-3 inset-x-3 z-20 flex gap-1">
        {stories.map((_, i) => (
          <div key={i} className="h-1 flex-1 rounded-full bg-white/30 overflow-hidden">
            {i < index && <div className="h-full w-full bg-white" />}
            {i === index && durationMs && (
              <div
                key={`${index}-${durationMs}`}
                className="h-full bg-white animate-story-progress"
                style={{
                  animationDuration: `${durationMs}ms`,
                  animationPlayState: paused ? "paused" : "running",
                }}
                onAnimationEnd={goNext}
              />
            )}
          </div>
        ))}
      </div>

      <div className="absolute top-7 inset-x-3 z-20 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="ig-ring rounded-full p-[2px] shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-[10px] font-bold text-river-ink">
              RA
            </div>
          </div>
          <div className="min-w-0 flex items-center gap-1.5">
            <span className="text-[12.5px] font-semibold text-white drop-shadow truncate">River Agency</span>
            <span className="text-[11px] text-white/70 truncate">· {current.cliente}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-white/90 transition hover:bg-white/10"
        >
          ✕
        </button>
      </div>

      <div
        className="relative flex-1 select-none"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        {media.kind === "video" ? (
          <video
            key={media.url}
            src={media.url}
            className="h-full w-full object-contain bg-black"
            autoPlay
            playsInline
            onLoadedMetadata={(e) => setVideoDurationMs(e.currentTarget.duration * 1000)}
            onEnded={goNext}
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt="" className="h-full w-full object-contain bg-black" draggable={false} />
        )}

        {index > 0 && (
          <button aria-label="Story anterior" onClick={goPrev} className="absolute left-0 top-0 h-full w-1/3" />
        )}
        <button aria-label="Próximo story" onClick={goNext} className="absolute right-0 top-0 h-full w-1/3" />
      </div>

      <div className="z-20 -mt-24 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-4 pb-4 pt-16">
        {current.caption && (
          <p className="mb-3 line-clamp-3 text-[12.5px] leading-relaxed text-white/90">{current.caption}</p>
        )}
        <ApprovalActions
          status={current.status}
          clientNote={current.clientNote}
          onApprove={() => onApprove(current.id)}
          onRequestChanges={(note) => onRequestChanges(current.id, note)}
          compact
        />
        {isAdmin && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(current.id)}
            className="mt-2 text-[11px] font-medium text-white/60 transition hover:text-river-bad"
          >
            Remover story
          </button>
        )}
      </div>
    </Modal>
  );
}
