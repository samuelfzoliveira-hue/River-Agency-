import { useEffect, useRef, useState } from "react";
import { useSignedUrls } from "../lib/storage";
import { sortedMedia, type Content, type Version } from "../lib/types";
import { Avatar } from "./ui";

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function ZoomImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  return (
    <>
      <img src={src} alt={alt} onClick={() => setOpen(true)} className="block h-auto w-full cursor-zoom-in" />
      {open && (
        <div className="fixed inset-0 z-50 overflow-auto bg-black/95" style={{ touchAction: "pan-x pan-y pinch-zoom" }}>
          <button onClick={() => { setOpen(false); setZoomed(false); }} aria-label="Fechar"
            className="fixed right-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-navy">Fechar ✕</button>
          <div className="flex min-h-full min-w-full items-center justify-center">
            <img src={src} alt={alt} onClick={() => setZoomed((z) => !z)}
              className={zoomed ? "max-w-none cursor-zoom-out" : "max-h-screen max-w-full cursor-zoom-in object-contain"}
              style={zoomed ? { width: "250%" } : undefined} />
          </div>
        </div>
      )}
    </>
  );
}

function Carousel({ urls }: { urls: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const go = (n: number) => ref.current?.scrollTo({ left: n * ref.current.clientWidth, behavior: "smooth" });
  return (
    <div className="relative">
      <div ref={ref} onScroll={(e) => setI(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
        {urls.map((u, n) => (
          <div key={u + n} className="aspect-[4/5] w-full shrink-0 snap-center bg-neutral-100">
            <img src={u} alt={`Slide ${n + 1}`} className="h-full w-full object-contain" draggable={false} />
          </div>
        ))}
      </div>
      <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">{i + 1}/{urls.length}</span>
      {i > 0 && <button onClick={() => go(i - 1)} aria-label="Slide anterior"
        className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow md:flex">‹</button>}
      {i < urls.length - 1 && <button onClick={() => go(i + 1)} aria-label="Próximo slide"
        className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-navy shadow md:flex">›</button>}
      <div className="mt-2 flex justify-center gap-1.5">
        {urls.map((_, n) => <span key={n} className={`h-1.5 w-1.5 rounded-full ${n === i ? "bg-sky" : "bg-navy/20"}`} />)}
      </div>
    </div>
  );
}

function ReelsPlayer({ src, poster }: { src: string; poster?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const toggle = () => { const v = vid.current; if (v) (v.paused ? v.play() : v.pause()); };
  const seek = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = vid.current; if (!v || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * dur;
  };
  const fullscreen = () => {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    const v = vid.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (box.current?.requestFullscreen) box.current.requestFullscreen(); else v?.webkitEnterFullscreen?.();
  };
  return (
    <div ref={box} className="relative mx-auto aspect-[9/16] w-full max-w-[380px] overflow-hidden bg-black sm:rounded-xl">
      <video ref={vid} src={src} poster={poster} playsInline preload="metadata" muted={muted} onClick={toggle}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        className="h-full w-full object-contain" />
      {!playing && (
        <button onClick={toggle} aria-label="Reproduzir" className="absolute inset-0 m-auto flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-3xl text-white">▶</button>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-8 text-white">
        <div onPointerDown={seek} className="group h-5 cursor-pointer touch-none py-2" role="slider" aria-label="Progresso" aria-valuemin={0} aria-valuemax={Math.round(dur)} aria-valuenow={Math.round(cur)}>
          <div className="h-1 rounded-full bg-white/30"><div className="h-1 rounded-full bg-sky" style={{ width: dur ? `${(cur / dur) * 100}%` : 0 }} /></div>
        </div>
        <div className="mt-1 flex items-center gap-3 text-sm">
          <button onClick={toggle} aria-label={playing ? "Pausar" : "Reproduzir"} className="w-6 text-lg">{playing ? "❚❚" : "▶"}</button>
          <span className="tabular-nums text-xs">{fmtTime(cur)} / {fmtTime(dur)}</span>
          <span className="flex-1" />
          <button onClick={() => setMuted((m) => !m)} aria-label={muted ? "Ativar som" : "Silenciar"} className="text-lg">{muted ? "🔇" : "🔊"}</button>
          <button onClick={fullscreen} aria-label="Tela cheia" className="text-lg">⛶</button>
        </div>
      </div>
    </div>
  );
}

function Caption({ handle, text }: { handle: string; text: string }) {
  const parts = text.split(/(#[\p{L}\p{N}_]+)/u);
  return (
    <p className="whitespace-pre-wrap break-words px-4 text-[15px] leading-relaxed">
      <strong className="mr-1.5">{handle}</strong>
      {parts.map((p, i) => (p.startsWith("#") ? <span key={i} className="text-sky">{p}</span> : p))}
    </p>
  );
}

export default function PostViewer({ content, version }: { content: Content; version: Version }) {
  const media = sortedMedia(version);
  const urls = useSignedUrls(media.map((m) => m.url));
  const images = media.filter((m) => m.tipo === "imagem").map((m) => urls[m.url]).filter(Boolean);
  const video = media.find((m) => m.tipo === "video");
  const cover = media.find((m) => m.tipo === "capa");
  const client = content.clients;
  const handle = client ? `@${client.instagram}` : "";
  return (
    <article className="overflow-hidden bg-white shadow-sm ring-1 ring-navy/5 sm:rounded-2xl">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar path={client?.foto_perfil} name={client?.nome_marca ?? "?"} size={36} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold">{client?.instagram}</p>
          <p className="truncate text-xs text-navy/50">{client?.nome_marca}</p>
        </div>
      </header>
      {content.tipo === "flyer" && (images[0] ? <ZoomImage src={images[0]} alt="Flyer" /> : <div className="aspect-[4/5] animate-pulse bg-neutral-100" />)}
      {content.tipo === "carrossel" && (images.length ? <Carousel urls={images} /> : <div className="aspect-[4/5] animate-pulse bg-neutral-100" />)}
      {content.tipo === "reels" && (video && urls[video.url] ? <ReelsPlayer src={urls[video.url]} poster={cover ? urls[cover.url] : undefined} /> : <div className="mx-auto aspect-[9/16] max-w-[380px] animate-pulse bg-neutral-100" />)}
      <div className="flex gap-4 px-4 pb-1 pt-3 text-navy" aria-hidden="true">
        <span className="text-xl">♡</span><span className="text-xl">💬</span><span className="text-xl">➤</span>
      </div>
      <div className="pb-5 pt-1"><Caption handle={handle} text={version.legenda} /></div>
    </article>
  );
}
