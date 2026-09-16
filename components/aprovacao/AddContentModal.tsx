"use client";

import { useMemo, useState } from "react";
import type { ContentItem, ContentType } from "@/lib/aprovacao/types";
import { Modal } from "./Modal";

const TYPE_OPTIONS: { value: ContentType; label: string; hint: string }[] = [
  { value: "feed", label: "Post de Feed", hint: "1 imagem ou vídeo" },
  { value: "carousel", label: "Carrossel", hint: "2 a 10 imagens/vídeos" },
  { value: "story", label: "Story", hint: "1 imagem ou vídeo, 9:16" },
  { value: "reels", label: "Reels", hint: "1 vídeo, 9:16" },
];

export function AddContentModal({
  password,
  defaultCliente,
  knownClientes,
  onClose,
  onCreated,
}: {
  password: string;
  defaultCliente?: string;
  knownClientes: string[];
  onClose: () => void;
  onCreated: (item: ContentItem) => void;
}) {
  const [type, setType] = useState<ContentType>("feed");
  const [cliente, setCliente] = useState(defaultCliente ?? "");
  const [caption, setCaption] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const multiple = type === "carousel";
  const accept = type === "reels" ? "video/*" : "image/*,video/*";

  const previews = useMemo(
    () => files.map((f) => ({ url: URL.createObjectURL(f), isVideo: f.type.startsWith("video/") })),
    [files]
  );

  function handleFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!cliente.trim()) {
      setError("Informe o nome do cliente.");
      return;
    }
    if (files.length === 0) {
      setError("Selecione ao menos um arquivo.");
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("cliente", cliente.trim());
      form.set("caption", caption);
      files.forEach((f) => form.append("files", f));

      const res = await fetch("/api/aprovacao", {
        method: "POST",
        headers: { "x-admin-password": password },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Falha ao publicar o conteúdo.");
        setSubmitting(false);
        return;
      }
      onCreated(data.item as ContentItem);
    } catch {
      setError("Erro de conexão. Tente novamente.");
      setSubmitting(false);
    }
  }

  return (
    <Modal onClose={onClose} contentClassName="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden">
      <form onSubmit={handleSubmit} className="flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-river-line px-6 py-4">
          <h2 className="text-[15px] font-bold text-river-ink">Novo conteúdo para aprovação</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="h-8 w-8 flex items-center justify-center rounded-full text-river-ink3 transition hover:bg-river-canvas hover:text-river-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          <div>
            <label className="mb-2 block text-[11.5px] font-semibold uppercase tracking-wide text-river-ink3">
              Formato
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setType(opt.value);
                    setFiles([]);
                  }}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-all duration-200 ${
                    type === opt.value
                      ? "border-river-accent bg-river-accentSoft"
                      : "border-river-line hover:border-river-ink3"
                  }`}
                >
                  <div className="text-[13px] font-semibold text-river-ink">{opt.label}</div>
                  <div className="text-[11px] text-river-ink3">{opt.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-river-ink3">
              Cliente
            </label>
            <input
              value={cliente}
              onChange={(e) => setCliente(e.target.value)}
              placeholder="Nome do cliente"
              list="clientes-conhecidos"
              className="w-full rounded-lg border border-river-line px-3 py-2.5 text-[13.5px] text-river-ink outline-none placeholder:text-river-ink3 focus:border-river-accent"
            />
            <datalist id="clientes-conhecidos">
              {knownClientes.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-river-ink3">
              Legenda
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              placeholder="Escreva a legenda do post..."
              className="w-full resize-none rounded-lg border border-river-line px-3 py-2.5 text-[13.5px] text-river-ink outline-none placeholder:text-river-ink3 focus:border-river-accent"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wide text-river-ink3">
              Arquivo{multiple ? "s" : ""}
            </label>
            <input
              type="file"
              accept={accept}
              multiple={multiple}
              onChange={(e) => handleFiles(e.target.files)}
              className="w-full text-[12.5px] text-river-ink2 file:mr-3 file:rounded-lg file:border-0 file:bg-river-accentSoft file:px-3 file:py-2 file:text-[12.5px] file:font-semibold file:text-river-accent hover:file:bg-river-accent hover:file:text-white file:transition-colors file:cursor-pointer cursor-pointer"
            />
            {previews.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
                {previews.map((p, i) => (
                  <div key={i} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-river-line bg-black">
                    {p.isVideo ? (
                      <video src={p.url} className="h-full w-full object-cover" muted />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.url} className="h-full w-full object-cover" alt="" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="text-[12.5px] text-river-bad">{error}</p>}
        </div>

        <div className="border-t border-river-line px-6 py-4">
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-river-accent px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all duration-200 hover:bg-river-accentDeep hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            {submitting ? "Publicando..." : "Publicar para aprovação"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
