"use client";

import { useState, useTransition } from "react";
import { FileUpload, type Uploaded } from "./file-upload";
import { registerMediaFileAction } from "@/lib/actions/media";

/** Banco de mídia: escolhe cliente/campanha, envia o arquivo e registra. */
export function MediaUploadForm({ orgId, clients, defaultClient }: { orgId: string; clients: { id: string; name: string }[]; defaultClient?: string }) {
  const [client, setClient] = useState(defaultClient ?? "");
  const [campaign, setCampaign] = useState("");
  const [day, setDay] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function onUploaded(f: Uploaded) {
    const fd = new FormData();
    fd.set("client_id", client); fd.set("path", f.path); fd.set("name", f.name); fd.set("size", String(f.size)); fd.set("mime", f.mime); fd.set("campaign", campaign); fd.set("captured_on", day);
    start(async () => { const r = await registerMediaFileAction(fd); setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: `${f.name} adicionado ao banco de mídia.` }); });
  }
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <label className="block"><span className="label">Cliente *</span><select className="input" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Cliente do arquivo"><option value="">Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="block"><span className="label">Campanha</span><input className="input" value={campaign} onChange={(e) => setCampaign(e.target.value)} /></label>
      <label className="block"><span className="label">Data</span><input className="input" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
      <div className="self-end"><FileUpload orgId={orgId} clientId={client} onUploaded={onUploaded} label="Enviar arquivo" /></div>
      {pending && <p className="text-xs text-muted md:col-span-4">Registrando…</p>}
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm md:col-span-4 ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
    </div>
  );
}
