import { ExternalLink } from "lucide-react";
import { MediaUploadForm } from "@/components/media-upload-form";
import { signPaths } from "@/lib/storage";
import { ActionForm, ConfirmButton, FilterForm, SubmitButton } from "@/components/form";
import { Empty, Field, PageHeader, Section } from "@/components/ui";
import { addMediaAction, deleteMediaAction } from "@/lib/actions/media";
import type { ClientRow, MediaRow } from "@/lib/db";
import { isDrive } from "@/lib/integrations/drive";
import { formatBR, monthLabel, monthStart } from "@/lib/domain/dates";
import { requireCtx } from "@/lib/session";

export const metadata = { title: "Banco de mídia" };
type SP = { cliente?: string; campanha?: string; tipo?: string; de?: string; ate?: string };
const KIND = { imagem: "Imagem", video: "Vídeo", documento: "Documento", outro: "Outro" } as const;

export default async function MediaPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { supabase, user, profile } = await requireCtx();
  const [clients, media] = await Promise.all([
    supabase.from("clients").select("id,name").order("name").then((r) => (r.data ?? []) as Pick<ClientRow, "id" | "name">[]),
    supabase.from("media_assets").select("*").order("captured_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(500).then((r) => (r.data ?? []) as MediaRow[]),
  ]);
  const signed = await signPaths(supabase, media.map((m) => m.storage_path).filter(Boolean) as string[], 3600);
  const hrefOf = (m: MediaRow) => (m.storage_path ? signed.get(m.storage_path) ?? "#" : m.url ?? "#");
  const cn = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";
  const campaigns = [...new Set(media.map((m) => m.campaign).filter(Boolean))] as string[];
  const list = media.filter((m) => (!sp.cliente || m.client_id === sp.cliente) && (!sp.campanha || m.campaign === sp.campanha) && (!sp.tipo || m.kind === sp.tipo)
    && (!sp.de || (m.captured_on ?? m.created_at.slice(0, 10)) >= sp.de) && (!sp.ate || (m.captured_on ?? m.created_at.slice(0, 10)) <= sp.ate));
  const groups = new Map<string, MediaRow[]>();
  list.forEach((m) => { const k = monthStart(m.captured_on ?? m.created_at.slice(0, 10)); groups.set(k, [...(groups.get(k) ?? []), m]); });

  return (
    <>
      <PageHeader title="Banco de mídia" subtitle="Material bruto e finalizado organizado por cliente, data, campanha e tipo. Hoje guarda links (pastas do Google Drive, Dropbox…); a integração direta com o Drive entra depois." />
      <Section title="Enviar arquivo" hint="Imagens, vídeos (MP4/MOV/WebM) e PDF de até 50 MB. Ficam em armazenamento privado da agência." className="mb-6">
        <MediaUploadForm orgId={profile.org_id} clients={clients} defaultClient={sp.cliente} />
      </Section>
      <Section title="Adicionar link" className="mb-6">
        <ActionForm action={addMediaAction} resetOnSuccess className="grid gap-3 md:grid-cols-6">
          <Field label="Cliente *" className="md:col-span-2"><select className="input" name="client_id" required defaultValue={sp.cliente ?? ""}><option value="" disabled>Selecione</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Nome *" className="md:col-span-2"><input className="input" name="name" required minLength={2} placeholder="Ex.: Bruto captação 12/10" /></Field>
          <Field label="Tipo"><select className="input" name="kind" defaultValue="video">{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Data"><input className="input" type="date" name="captured_on" /></Field>
          <Field label="Link *" className="md:col-span-3"><input className="input" type="url" name="url" required placeholder="https://drive.google.com/…" /></Field>
          <Field label="Campanha" className="md:col-span-2"><input className="input" name="campaign" list="campanhas" placeholder="Ex.: Outubro Rosa" /></Field>
          <datalist id="campanhas">{campaigns.map((c) => <option key={c} value={c} />)}</datalist>
          <div className="self-end"><SubmitButton>Adicionar</SubmitButton></div>
        </ActionForm>
      </Section>
      <FilterForm className="mb-6 flex flex-wrap items-end gap-3">
        <select className="input w-44" name="cliente" defaultValue={sp.cliente ?? ""} aria-label="Cliente"><option value="">Todos os clientes</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input w-44" name="campanha" defaultValue={sp.campanha ?? ""} aria-label="Campanha"><option value="">Todas as campanhas</option>{campaigns.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select className="input w-36" name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo"><option value="">Todos os tipos</option>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Field label="De"><input className="input" type="date" name="de" defaultValue={sp.de} /></Field>
        <Field label="Até"><input className="input" type="date" name="ate" defaultValue={sp.ate} /></Field>
      </FilterForm>
      {list.length === 0 ? <Empty>Nenhum material encontrado.</Empty> : [...groups.entries()].map(([month, items]) => (
        <section key={month} className="mb-8">
          <h2 className="eyebrow mb-2">{monthLabel(month)} · {items.length}</h2>
          <ul className="card divide-y divide-line">
            {items.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="badge">{KIND[m.kind as keyof typeof KIND]}</span>{m.storage_path && <span className="badge">arquivo</span>}{m.url && isDrive(m.url) && <span className="badge badge-info">Drive</span>}
                <span className="min-w-0 flex-1"><a href={hrefOf(m)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-medium hover:underline">{m.name} <ExternalLink size={12} /></a>
                  <span className="block text-xs text-muted">{cn(m.client_id)}{m.campaign ? ` · ${m.campaign}` : ""}{m.captured_on ? ` · ${formatBR(m.captured_on)}` : ""}</span></span>
                {m.created_by === user.id && <ConfirmButton action={deleteMediaAction} fields={{ id: m.id }} label="Remover" message="Remover este material do banco de mídia? O arquivo original não é apagado." />}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
