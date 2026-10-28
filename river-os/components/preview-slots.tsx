"use client";

import { useState } from "react";
import { FileUpload } from "./file-upload";
import { kindFromMime } from "@/lib/storage";

/** Até 3 prévias por versão: link externo OU arquivo enviado ao Storage. */
export function PreviewSlots({ orgId, clientId }: { orgId: string; clientId: string }) {
  const [files, setFiles] = useState<Record<number, { path: string; name: string; kind: string }>>({});
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => {
        const f = files[i];
        return (
          <div key={i} className="grid items-start gap-2 sm:grid-cols-[1fr_2fr_8rem]">
            <input className="input" name={`media_name_${i}`} placeholder={`Prévia ${i + 1} — nome`} aria-label={`Nome da prévia ${i + 1}`} />
            {f ? (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-sunken px-3 py-2 text-sm">
                <span className="truncate">📎 {f.name}</span>
                <button type="button" className="text-xs text-muted hover:text-bad" onClick={() => setFiles((x) => { const n = { ...x }; delete n[i]; return n; })}>trocar</button>
                <input type="hidden" name={`media_path_${i}`} value={f.path} />
              </div>
            ) : (
              <div className="space-y-1.5">
                <input className="input" type="url" name={`media_url_${i}`} placeholder="https://… (link direto) ou envie um arquivo →" aria-label={`Link da prévia ${i + 1}`} />
                <FileUpload orgId={orgId} clientId={clientId} label={`Enviar arquivo da prévia ${i + 1}`} onUploaded={(u) => setFiles((x) => ({ ...x, [i]: { path: u.path, name: u.name, kind: kindFromMime(u.mime) } }))} />
              </div>
            )}
            <select className="input" name={`media_kind_${i}`} aria-label={`Tipo da prévia ${i + 1}`} key={f?.kind ?? "link"} defaultValue={f?.kind ?? "imagem"}><option value="imagem">Imagem</option><option value="video">Vídeo</option><option value="documento">Documento</option></select>
          </div>
        );
      })}
    </div>
  );
}
