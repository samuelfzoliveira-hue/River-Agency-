import { ActionForm, SubmitButton } from "./form";
import { MediaPreview } from "./approval-view";
import { Empty, Field, Section } from "./ui";
import { createVersionAction, sendApprovalAction } from "@/lib/actions/approval";
import type { ApprovalEventRow, VersionRow } from "@/lib/db";

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const LABEL = { enviado: "Enviado ao cliente", aprovado: "Aprovado", ajustes: "Ajustes solicitados" } as const;
const VIA = { link: "pelo link", portal: "pelo portal", interno: "interno" } as const;

export function ApprovalPanel({ contentId, versions, events, state }: { contentId: string; versions: VersionRow[]; events: ApprovalEventRow[]; state: string | null }) {
  const latest = versions[0];
  return (
    <Section title="Aprovação do cliente" hint="Prévia e legenda ficam versionadas. O cliente aprova por um link seguro, sem acesso ao restante da agência.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Situação:</span>
          <span className={`badge ${state === "aprovado" ? "badge-ok" : state === "ajustes" ? "badge-warn" : state === "aguardando" ? "badge-info" : ""}`}>
            {state === "aguardando" ? "aguardando cliente" : state === "ajustes" ? "ajustes solicitados" : state === "aprovado" ? "aprovado" : "não enviado"}
          </span>
        </div>

        {latest ? (
          <div>
            <p className="eyebrow mb-2">Versão atual · v{latest.version} · {when(latest.created_at)}</p>
            {latest.caption && <p className="mb-3 whitespace-pre-wrap rounded-lg bg-sunken px-3 py-2 text-sm">{latest.caption}</p>}
            <MediaPreview media={latest.media ?? []} />
            <ActionForm action={sendApprovalAction} className="mt-4 flex flex-wrap items-end gap-3">
              <input type="hidden" name="content_id" value={contentId} />
              <Field label="Validade do link"><select className="input w-36" name="days" defaultValue="14"><option value="3">3 dias</option><option value="7">7 dias</option><option value="14">14 dias</option><option value="30">30 dias</option></select></Field>
              <SubmitButton pendingText="Gerando…">Enviar v{latest.version} para aprovação</SubmitButton>
            </ActionForm>
          </div>
        ) : <Empty>Nenhuma versão ainda. Crie a primeira abaixo.</Empty>}

        <details className="rounded-lg border border-line" open={!latest}>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Nova versão (legenda e prévias)</summary>
          <ActionForm action={createVersionAction} resetOnSuccess className="space-y-3 border-t border-line p-4">
            <input type="hidden" name="content_id" value={contentId} />
            <Field label="Legenda proposta"><textarea className="input min-h-24" name="caption" defaultValue={latest?.caption ?? ""} /></Field>
            {[0, 1, 2].map((i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_8rem]">
                <input className="input" name={`media_name_${i}`} placeholder={`Prévia ${i + 1} — nome`} aria-label={`Nome da prévia ${i + 1}`} />
                <input className="input" type="url" name={`media_url_${i}`} placeholder="https://… (link direto da imagem ou vídeo)" aria-label={`Link da prévia ${i + 1}`} />
                <select className="input" name={`media_kind_${i}`} aria-label={`Tipo da prévia ${i + 1}`}><option value="imagem">Imagem</option><option value="video">Vídeo</option><option value="documento">Documento</option></select>
              </div>
            ))}
            <Field label="Observação para o cliente (opcional)"><input className="input" name="note" /></Field>
            <p className="text-xs text-muted">Para pré-visualizar no link, use endereços diretos de arquivos. Links de pastas do Drive abrem em nova aba. Upload direto: próxima etapa.</p>
            <SubmitButton>Salvar versão</SubmitButton>
          </ActionForm>
        </details>

        {versions.length > 1 && (
          <details><summary className="cursor-pointer text-sm text-muted">Histórico de versões ({versions.length})</summary>
            <ul className="mt-3 space-y-2 text-sm">{versions.slice(1).map((v) => <li key={v.id} className="rounded-lg bg-sunken px-3 py-2"><strong>v{v.version}</strong> · {when(v.created_at)}<p className="mt-1 whitespace-pre-wrap text-muted">{v.caption || "(sem legenda)"}</p></li>)}</ul>
          </details>
        )}

        {events.length > 0 && (
          <div><p className="eyebrow mb-2">Histórico de aprovação</p>
            <ol className="space-y-2 text-sm">{events.map((e) => (
              <li key={e.id} className="rounded-lg bg-sunken px-3 py-2"><span className="font-medium">{LABEL[e.action]}</span>{e.version ? ` (v${e.version})` : ""} · {e.actor_name ?? "—"} · {VIA[e.via as keyof typeof VIA]} · <span className="text-muted">{when(e.created_at)}</span>
                {e.comment && <p className="mt-1 whitespace-pre-wrap">{e.comment}</p>}</li>))}
            </ol></div>
        )}
      </div>
    </Section>
  );
}
