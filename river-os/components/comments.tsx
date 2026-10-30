import { ActionForm, ConfirmButton, SubmitButton } from "./form";
import { Empty } from "./ui";
import { addCommentAction, deleteCommentAction } from "@/lib/actions/contents";
import type { CommentRow, Profile } from "@/lib/db";

/** Comentários com menções (@Nome) vinculados a um conteúdo, tarefa, cliente ou captação. */
export function Comments({ entityType, entityId, comments, members, meId }: {
  entityType: "content" | "task" | "client" | "shoot"; entityId: string; comments: CommentRow[]; members: Pick<Profile, "user_id" | "full_name">[]; meId: string;
}) {
  const name = (id: string) => members.find((m) => m.user_id === id)?.full_name ?? "Usuário";
  // destaca @Nome no texto
  const render = (body: string) =>
    body.split(/(@[\p{L}]+)/gu).map((part, i) => (part.startsWith("@") ? <strong key={i} className="text-info">{part}</strong> : <span key={i}>{part}</span>));
  return (
    <div>
      {comments.length === 0 ? <Empty>Sem comentários ainda. Use @Nome para mencionar alguém.</Empty> : (
        <ul className="mb-4 space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-lg bg-sunken px-3 py-2.5 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted">
                <span><strong className="text-fg">{name(c.author_id)}</strong> · {new Date(c.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}</span>
                {c.author_id === meId && <ConfirmButton action={deleteCommentAction} fields={{ id: c.id }} label="Excluir" message="Excluir este comentário?" className="text-xs text-muted hover:text-bad" />}
              </div>
              <p className="whitespace-pre-wrap">{render(c.body)}</p>
            </li>
          ))}
        </ul>
      )}
      <ActionForm action={addCommentAction} resetOnSuccess className="space-y-2">
        <input type="hidden" name="entity_type" value={entityType} />
        <input type="hidden" name="entity_id" value={entityId} />
        <textarea className="input min-h-20" name="body" placeholder={`Comentar… (mencione com @${members[0]?.full_name.split(" ")[0] ?? "Nome"})`} required maxLength={5000} aria-label="Comentário" />
        <SubmitButton pendingText="Enviando…">Comentar</SubmitButton>
      </ActionForm>
    </div>
  );
}
