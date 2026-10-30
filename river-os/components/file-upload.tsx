"use client";

import { Paperclip } from "lucide-react";
import { useRef, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { ALLOWED_MIME, BUCKET, MAX_BYTES, buildPath } from "@/lib/storage";

export interface Uploaded { path: string; name: string; size: number; mime: string }

/** Envia o arquivo direto do navegador ao Storage (privado). O servidor revalida o caminho ao registrar. */
export function FileUpload({ orgId, clientId, onUploaded, label = "Enviar arquivo" }: { orgId: string; clientId: string; onUploaded: (f: Uploaded) => void; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ busy: boolean; error?: string; name?: string }>({ busy: false });

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!clientId) return setState({ busy: false, error: "Selecione o cliente antes." });
    if (!ALLOWED_MIME.includes(file.type)) return setState({ busy: false, error: "Formato não permitido (use JPG, PNG, WebP, GIF, MP4, MOV, WebM ou PDF)." });
    if (file.size > MAX_BYTES) return setState({ busy: false, error: "Arquivo acima de 50 MB." });
    setState({ busy: true, name: file.name });
    const path = buildPath(orgId, clientId, file.name, crypto.randomUUID());
    const { error } = await createBrowserSupabase().storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) return setState({ busy: false, error: "Não foi possível enviar o arquivo. Tente novamente." });
    setState({ busy: false, name: file.name });
    onUploaded({ path, name: file.name, size: file.size, mime: file.type });
    if (ref.current) ref.current.value = "";
  }
  return (
    <div className="text-sm">
      <input ref={ref} type="file" className="sr-only" id={`up-${label}`} aria-label={label} accept={ALLOWED_MIME.join(",")} onChange={(e) => pick(e.target.files?.[0])} />
      <label htmlFor={`up-${label}`} className={`btn btn-sm cursor-pointer ${state.busy ? "pointer-events-none opacity-60" : ""}`}><Paperclip size={14} /> {state.busy ? `Enviando ${state.name}…` : label}</label>
      {!state.busy && state.name && !state.error && <span className="ml-2 text-xs text-ok">✓ {state.name}</span>}
      {state.error && <p role="alert" className="mt-1 text-xs text-bad">{state.error}</p>}
    </div>
  );
}
