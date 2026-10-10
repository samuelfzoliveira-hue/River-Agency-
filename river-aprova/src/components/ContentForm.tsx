import { useEffect, useRef, useState, type FormEvent } from "react";
import { callApi, supabase } from "../lib/supabase";
import { uploadFile } from "../lib/storage";
import { TIPO_LABEL, versionOf, type Content, type ContentType } from "../lib/types";
import { Feedback } from "./AuthShell";

interface Item { key: string; file: File; preview: string }
const MAX_IMG = 30 * 1024 * 1024;
const MAX_VIDEO = 500 * 1024 * 1024;
const IMG_ACCEPT = "image/jpeg,image/png,image/webp";
const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm";
const newItem = (file: File): Item => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file) });

function checkVertical(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => { resolve(v.videoHeight > v.videoWidth); URL.revokeObjectURL(v.src); };
    v.onerror = () => resolve(true);
    v.src = URL.createObjectURL(file);
  });
}

function ImageThumb({ item, onRemove, extra }: { item: Item; onRemove: () => void; extra?: React.ReactNode }) {
  return (
    <div className="relative">
      <img src={item.preview} alt="" className="aspect-[4/5] w-full rounded-lg object-cover" draggable={false} />
      <button type="button" onClick={onRemove} aria-label="Remover" className="absolute right-1 top-1 h-6 w-6 rounded-full bg-white/90 text-sm text-navy">✕</button>
      {extra}
    </div>
  );
}

export default function ContentForm({ clientId, mode, content, onDone }: {
  clientId: string; mode: "new" | "version"; content?: Content; onDone: (contentId: string) => void;
}) {
  const [tipo, setTipo] = useState<ContentType>(content?.tipo ?? "flyer");
  const [legenda, setLegenda] = useState(mode === "version" && content ? versionOf(content)?.legenda ?? "" : "");
  const [data, setData] = useState("");
  const [prazo, setPrazo] = useState("");
  const [jaPublicado, setJaPublicado] = useState(false);
  const [replaceMedia, setReplaceMedia] = useState(mode === "new");
  const [flyer, setFlyer] = useState<Item[]>([]);
  const [slides, setSlides] = useState<Item[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [capa, setCapa] = useState<Item[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const uploaded = useRef<string[]>([]);

  useEffect(() => () => [...flyer, ...slides, ...capa].forEach((i) => URL.revokeObjectURL(i.preview)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pickImages = (files: FileList | null, set: (f: (prev: Item[]) => Item[]) => void, max: number) => {
    if (!files) return;
    const list = Array.from(files);
    const big = list.find((f) => f.size > MAX_IMG);
    if (big) { setError(`"${big.name}" passa de 30 MB.`); return; }
    if (list.some((f) => !f.type.startsWith("image/"))) { setError("Envie apenas imagens (JPG, PNG ou WebP)."); return; }
    setError("");
    set((prev) => [...prev, ...list.map(newItem)].slice(0, max));
  };
  const moveSlide = (from: string, to: string) => {
    if (from === to) return;
    setSlides((prev) => {
      const next = prev.filter((s) => s.key !== from);
      next.splice(next.findIndex((s) => s.key === to), 0, prev.find((s) => s.key === from)!);
      return next;
    });
  };
  const nudge = (key: string, d: number) =>
    setSlides((prev) => {
      const i = prev.findIndex((s) => s.key === key), j = i + d;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const pickVideo = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_VIDEO) { setError("O vídeo passa de 500 MB."); return; }
    if (!(await checkVertical(f))) { setError("O vídeo precisa ser vertical (9:16)."); return; }
    setError("");
    setVideo(f);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (replaceMedia) {
      if (tipo === "flyer" && flyer.length !== 1) return setError("Envie 1 imagem para o flyer.");
      if (tipo === "carrossel" && (slides.length < 2 || slides.length > 20)) return setError("O carrossel precisa de 2 a 20 imagens.");
      if (tipo === "reels" && (!video || capa.length !== 1)) return setError("O reels precisa de 1 vídeo vertical e 1 imagem de capa.");
    }
    if (mode === "new" && !jaPublicado && (!data || !prazo)) return setError("Informe a data de publicação e o prazo de aprovação.");
    setBusy(true);
    uploaded.current = [];
    try {
      let media: { tipo: string; url: string; ordem: number }[] | null = null;
      if (replaceMedia) {
        const jobs: { tipo: string; file: File }[] =
          tipo === "flyer" ? [{ tipo: "imagem", file: flyer[0].file }]
          : tipo === "carrossel" ? slides.map((s) => ({ tipo: "imagem", file: s.file }))
          : [{ tipo: "video", file: video! }, { tipo: "capa", file: capa[0].file }];
        media = [];
        for (let i = 0; i < jobs.length; i++) {
          setProgress(`Enviando arquivo ${i + 1} de ${jobs.length}… 0%`);
          const path = await uploadFile(clientId, jobs[i].file, (p) => setProgress(`Enviando arquivo ${i + 1} de ${jobs.length}… ${p}%`));
          uploaded.current.push(path);
          media.push({ tipo: jobs[i].tipo, url: path, ordem: i });
        }
      }
      setProgress("Salvando…");
      let id = content?.id ?? "";
      if (mode === "new") {
        const { data: newId, error: err } = await supabase.rpc("create_content", {
          p_client: clientId, p_tipo: tipo, p_data: data || null, p_prazo: prazo ? new Date(prazo).toISOString() : null,
          p_ja_publicado: jaPublicado, p_legenda: legenda, p_media: media,
        });
        if (err) throw new Error(err.message);
        id = newId as string;
      } else {
        const { error: err } = await supabase.rpc("create_content_version", { p_content: id, p_legenda: legenda, p_media: media });
        if (err) throw new Error(err.message);
      }
      if (!(mode === "new" && jaPublicado)) void callApi("/api/notify", { kind: "aguardando", content_id: id });
      onDone(id);
    } catch (err) {
      if (uploaded.current.length) await supabase.storage.from("media").remove(uploaded.current);
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {mode === "new" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Tipo</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TIPO_LABEL) as ContentType[]).map((t) => (
              <button key={t} type="button" onClick={() => setTipo(t)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${tipo === t ? "border-navy bg-navy text-white" : "border-navy/15 bg-white"}`}>{TIPO_LABEL[t]}</button>
            ))}
          </div>
        </div>
      )}

      {mode === "version" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={replaceMedia} onChange={(e) => setReplaceMedia(e.target.checked)} />
          Enviar novas mídias (se desmarcado, mantém as mídias da versão atual)
        </label>
      )}

      {replaceMedia && tipo === "flyer" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Imagem do flyer</label>
          {flyer[0] ? <div className="w-40"><ImageThumb item={flyer[0]} onRemove={() => setFlyer([])} /></div>
            : <input type="file" accept={IMG_ACCEPT} onChange={(e) => pickImages(e.target.files, setFlyer, 1)} className="field" />}
        </div>
      )}

      {replaceMedia && tipo === "carrossel" && (
        <div>
          <label className="mb-1.5 block text-sm font-medium">Imagens do carrossel ({slides.length}/20) — arraste para reordenar</label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slides.map((s, i) => (
              <div key={s.key} draggable onDragStart={() => setDragKey(s.key)} onDragEnd={() => setDragKey(null)}
                onDragOver={(e) => e.preventDefault()} onDrop={() => dragKey && moveSlide(dragKey, s.key)}
                className={`cursor-grab ${dragKey === s.key ? "opacity-40" : ""}`}>
                <ImageThumb item={s} onRemove={() => setSlides((p) => p.filter((x) => x.key !== s.key))} extra={
                  <>
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-xs text-white">{i + 1}</span>
                    <span className="absolute bottom-1 right-1 flex gap-1">
                      <button type="button" onClick={() => nudge(s.key, -1)} aria-label="Mover para antes" className="h-6 w-6 rounded-full bg-white/90 text-navy">‹</button>
                      <button type="button" onClick={() => nudge(s.key, 1)} aria-label="Mover para depois" className="h-6 w-6 rounded-full bg-white/90 text-navy">›</button>
                    </span>
                  </>} />
              </div>
            ))}
          </div>
          {slides.length < 20 && (
            <input type="file" accept={IMG_ACCEPT} multiple onChange={(e) => { pickImages(e.target.files, setSlides, 20); e.target.value = ""; }} className="field mt-3" />
          )}
        </div>
      )}

      {replaceMedia && tipo === "reels" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Vídeo vertical (até 500 MB)</label>
            <input type="file" accept={VIDEO_ACCEPT} onChange={(e) => pickVideo(e.target.files?.[0])} className="field" />
            {video && <p className="mt-1.5 text-sm text-navy/60">{video.name} · {(video.size / 1048576).toFixed(1)} MB</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Imagem de capa</label>
            {capa[0] ? <div className="w-32"><ImageThumb item={capa[0]} onRemove={() => setCapa([])} /></div>
              : <input type="file" accept={IMG_ACCEPT} onChange={(e) => pickImages(e.target.files, setCapa, 1)} className="field" />}
          </div>
        </div>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium">Legenda</label>
        <textarea value={legenda} onChange={(e) => setLegenda(e.target.value)} rows={8} placeholder="Escreva a legenda completa, com emojis e #hashtags"
          className="field whitespace-pre-wrap" />
      </div>

      {mode === "new" && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={jaPublicado} onChange={(e) => setJaPublicado(e.target.checked)} />
            Post já publicado (entra só no histórico do feed, sem aprovação)
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">{jaPublicado ? "Data em que foi publicado" : "Data prevista de publicação"}</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className="field" />
            </div>
            {!jaPublicado && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Prazo de aprovação</label>
                <input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} className="field" />
              </div>
            )}
          </div>
        </>
      )}

      {error && <Feedback kind="error">{error}</Feedback>}
      {busy && progress && <Feedback kind="ok">{progress}</Feedback>}
      <button className="btn" disabled={busy}>{busy ? "Aguarde…" : mode === "new" ? "Criar conteúdo" : "Enviar nova versão"}</button>
    </form>
  );
}
