import { useState } from "react";
import { callApi, supabase } from "../lib/supabase";
import { sortedMedia, type Content } from "../lib/types";
import { Feedback } from "./AuthShell";
import { Modal } from "./ui";

export default function ApprovalPanel({ content, onDone }: { content: Content; onDone: () => void }) {
  const [modal, setModal] = useState<"aprovar" | "ajuste" | null>(null);
  const [comentario, setComentario] = useState("");
  const [slide, setSlide] = useState("");
  const [tempo, setTempo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const version = content.content_versions.find((v) => v.numero_versao === content.versao_atual);
  const slideCount = sortedMedia(version).filter((m) => m.tipo === "imagem").length;

  const close = () => { setModal(null); setError(""); setBusy(false); };
  const send = async (acao: "aprovado" | "ajuste_solicitado") => {
    setError("");
    if (acao === "ajuste_solicitado" && !comentario.trim()) return setError("Descreva o ajuste que você precisa.");
    if (acao === "ajuste_solicitado" && tempo.trim() && !/^\d{1,3}:[0-5]\d$/.test(tempo.trim())) return setError("Use o formato minuto:segundo, por exemplo 0:42.");
    setBusy(true);
    const { error: err } = await supabase.rpc("decide_content", {
      p_content: content.id, p_acao: acao,
      p_comentario: acao === "ajuste_solicitado" ? comentario.trim() : null,
      p_slide: acao === "ajuste_solicitado" && content.tipo === "carrossel" && slide ? Number(slide) : null,
      p_tempo: acao === "ajuste_solicitado" && content.tipo === "reels" && tempo.trim() ? tempo.trim() : null,
    });
    if (err) { setError(err.message); setBusy(false); return; }
    void callApi("/api/notify", { kind: "decisao", content_id: content.id });
    close();
    onDone();
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <button className="btn" onClick={() => setModal("aprovar")}>Aprovar</button>
      <button className="inline-flex w-full items-center justify-center rounded-xl border border-navy/20 bg-white px-5 py-3 text-base font-semibold text-navy hover:bg-paper"
        onClick={() => setModal("ajuste")}>Solicitar ajuste</button>

      {modal === "aprovar" && (
        <Modal title="Aprovar este conteúdo?" onClose={close}>
          <p className="text-sm text-navy/70">Depois de aprovado, o conteúdo fica bloqueado: só a River Agency pode reabri-lo.</p>
          {error && <div className="mt-3"><Feedback kind="error">{error}</Feedback></div>}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button className="rounded-xl border border-navy/20 px-4 py-3 font-semibold" onClick={close}>Cancelar</button>
            <button className="btn" disabled={busy} onClick={() => send("aprovado")}>{busy ? "Enviando…" : "Confirmar"}</button>
          </div>
        </Modal>
      )}

      {modal === "ajuste" && (
        <Modal title="Solicitar ajuste" onClose={close}>
          <div className="space-y-4">
            {content.tipo === "carrossel" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Qual slide?</label>
                <select value={slide} onChange={(e) => setSlide(e.target.value)} className="field">
                  <option value="">Geral</option>
                  {Array.from({ length: slideCount }, (_, i) => <option key={i} value={i + 1}>Slide {i + 1}</option>)}
                </select>
              </div>
            )}
            {content.tipo === "reels" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium">Trecho do vídeo (opcional)</label>
                <input value={tempo} onChange={(e) => setTempo(e.target.value)} placeholder="minuto:segundo, ex.: 0:42" inputMode="numeric" className="field" />
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium">O que precisa mudar? <span className="text-red-600">*</span></label>
              <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={5} maxLength={2000} className="field" placeholder="Descreva o ajuste com o máximo de detalhes" />
            </div>
            {error && <Feedback kind="error">{error}</Feedback>}
            <div className="grid grid-cols-2 gap-3">
              <button className="rounded-xl border border-navy/20 px-4 py-3 font-semibold" onClick={close}>Cancelar</button>
              <button className="btn" disabled={busy || !comentario.trim()} onClick={() => send("ajuste_solicitado")}>{busy ? "Enviando…" : "Enviar ajuste"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
