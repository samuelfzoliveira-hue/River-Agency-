"use client";

import { useRef, useState } from "react";
import type { MediaFile } from "@/lib/aprovacao/types";

export function MediaCarousel({
  media,
  aspectClassName = "aspect-square",
  rounded = "",
  hoverPlay = true,
}: {
  media: MediaFile[];
  aspectClassName?: string;
  rounded?: string;
  hoverPlay?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const multi = media.length > 1;

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setIndex(Math.min(media.length - 1, Math.max(0, idx)));
  }

  function goTo(i: number) {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.min(media.length - 1, Math.max(0, i));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className={`relative group/carousel overflow-hidden bg-black ${rounded}`}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex w-full overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar ${aspectClassName}`}
      >
        {media.map((m, i) => (
          <div key={i} className="relative w-full h-full shrink-0 snap-center">
            {m.kind === "video" ? (
              <video
                src={m.url}
                className="h-full w-full object-cover"
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(e) => hoverPlay && e.currentTarget.play().catch(() => undefined)}
                onMouseLeave={(e) => {
                  if (!hoverPlay) return;
                  e.currentTarget.pause();
                  e.currentTarget.currentTime = 0;
                }}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={m.url} alt="" className="h-full w-full object-cover" draggable={false} />
            )}
          </div>
        ))}
      </div>

      {multi && (
        <>
          <button
            type="button"
            aria-label="Anterior"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index - 1);
            }}
            disabled={index === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-river-ink shadow-md opacity-0 transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 disabled:hidden"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Próximo"
            onClick={(e) => {
              e.stopPropagation();
              goTo(index + 1);
            }}
            disabled={index === media.length - 1}
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-river-ink shadow-md opacity-0 transition-all duration-200 group-hover/carousel:opacity-100 hover:scale-110 disabled:hidden"
          >
            ›
          </button>

          <div className="absolute top-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
            {index + 1}/{media.length}
          </div>

          <div className="absolute bottom-3 inset-x-0 flex justify-center gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                aria-label={`Ir para item ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  goTo(i);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === index ? "w-4 bg-white" : "w-1.5 bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
