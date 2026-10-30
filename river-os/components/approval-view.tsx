import type { ReactNode } from "react";
import { ActionForm, SubmitButton } from "./form";
import type { ActionState } from "@/lib/actions/types";
import type { ApprovalPayload } from "@/lib/db";
import { driveThumbnail, parseDriveLink } from "@/lib/integrations/drive";

const when = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const ACTION_LABEL = { enviado: "Enviado para aprovação", aprovado: "Aprovado", ajustes: "Ajustes solicitados" } as const;

function MediaBody({ m }: { m: { name: string; url: string; kind: string } }) {
  const drive = parseDriveLink(m.url);
  if (m.kind === "imagem") {
    const src = driveThumbnail(m.url) ?? m.url;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={m.name} className="max-h-[28rem] w-full object-contain" referrerPolicy="no-referrer" loading="lazy" />;
  }
  // vídeos e documentos do Drive: player embutido do próprio Drive (o arquivo precisa estar compartilhado por link)
  if (drive && drive.kind === "file") return <iframe src={`https://drive.google.com/file/d/${drive.id}/preview`} title={m.name} className="h-80 w-full" allow="autoplay" referrerPolicy="no-referrer" />;
  if (m.kind === "video") return <video src={m.url} controls preload="metadata" className="max-h-[28rem] w-full" />;
  return <a href={m.url} target="_blank" rel="noopener noreferrer" className="block p-6 text-center text-sm underline">Abrir {m.name}</a>;
}

export function MediaPreview({ media }: { media: NonNullable<ApprovalPayload["media"]> }) {
  if (!media.length) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {media.map((m, i) => (
        <figure key={i} className="overflow-hidden rounded-xl border border-line bg-sunken">
          <MediaBody m={m} />
          <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted"><span className="truncate">{m.name}</span><a href={m.url} target="_blank" rel="noopener noreferrer" className="underline">abrir</a></figcaption>
        </figure>
      ))}
    </div>
  );
}

/** Tela de aprovação usada pelo link seguro e pelo portal do cliente. */
export function ApprovalView({ p, decide, askName, footer }: { p: ApprovalPayload; decide: (prev: ActionState, fd: FormData) => Promise<ActionState>; askName: boolean; footer?: ReactNode }) {
  const waiting = p.state === "aguardando";
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{p.client_name} · {p.type_name}</p>
        <h1 className="mt-1 text-2xl font-semibold">{p.title}</h1>
        {p.version != null && <p className="mt-1 text-sm text-muted">Versão {p.version}{p.sent_at ? ` · ${when(p.sent_at)}` : ""}</p>}
      </header>
      <MediaPreview media={p.media ?? []} />
      {p.caption && (
        <section className="card card-pad"><h2 className="eyebrow mb-2">Legenda proposta</h2><p className="whitespace-pre-wrap text-sm">{p.caption}</p></section>
      )}
      {p.note && <p className="text-sm text-muted">Observação da agência: {p.note}</p>}

      {p.events.length > 0 && (
        <section><h2 className="eyebrow mb-2">Histórico</h2>
          <ol className="space-y-2 text-sm">{p.events.map((e, i) => (
            <li key={i} className="rounded-lg bg-sunken px-3 py-2">
              <span className="font-medium">{ACTION_LABEL[e.action]}</span>{e.version ? ` (v${e.version})` : ""} · {e.actor_name ?? "Agência"} · <span className="text-muted">{when(e.created_at)}</span>
              {e.comment && <p className="mt-1 whitespace-pre-wrap">{e.comment}</p>}
            </li>))}
          </ol></section>
      )}

      {waiting ? (
        <ActionForm action={decide} className="card card-pad space-y-3">
          <h2 className="font-semibold">Sua decisão</h2>
          {askName && <div><label className="label" htmlFor="name">Seu nome *</label><input id="name" name="name" className="input" required minLength={2} maxLength={80} autoComplete="name" /></div>}
          <div><label className="label" htmlFor="comment">Comentário (obrigatório para pedir ajustes)</label><textarea id="comment" name="comment" className="input min-h-24" maxLength={2000} /></div>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="decision" value="aprovado" pendingText="Enviando…">Aprovar</SubmitButton>
            <SubmitButton name="decision" value="ajustes" className="btn" pendingText="Enviando…">Solicitar ajustes</SubmitButton>
          </div>
        </ActionForm>
      ) : (
        <p className="rounded-lg border border-line px-4 py-3 text-sm text-muted">
          {p.state === "aprovado" ? "Este conteúdo já foi aprovado." : p.state === "ajustes" ? "Ajustes solicitados. A agência enviará uma nova versão." : "Este conteúdo não está aguardando aprovação no momento."}
        </p>
      )}
      {footer}
    </div>
  );
}
