import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityList } from "@/components/activity";
import { ApprovalPanel } from "@/components/approval-panel";
import { ChecklistEditor } from "@/components/checklist-editor";
import { Comments } from "@/components/comments";
import { ContentFields } from "@/components/content-fields";
import { ActionForm, ConfirmButton, SubmitButton } from "@/components/form";
import { Empty, Field, PageHeader, Section } from "@/components/ui";
import { addAttachmentAction, cancelContentAction, deleteContentAction, removeAttachmentAction, restoreContentAction, saveChecklistAction, updateContentAction } from "@/lib/actions/contents";
import { createTaskAction } from "@/lib/actions/tasks";
import type { ActivityRow, ApprovalEventRow, ClientRow, CommentRow, ContentRow, Profile, StatusRow, TaskRow, VersionRow } from "@/lib/db";
import { TASK_STATUS_LABEL } from "@/lib/db";
import { formatBR } from "@/lib/domain/dates";
import type { DeliverableType } from "@/lib/domain/types";
import { isManager, requireCtx } from "@/lib/session";

export default async function ContentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  const { supabase } = ctx;
  const { data: content } = await supabase.from("contents").select("*").eq("id", id).maybeSingle<Omit<ContentRow, "approval_state">>();
  if (!content) notFound();

  const [client, type, statuses, members, tasks, comments, activity, supporters, versions, apEvents] = await Promise.all([
    supabase.from("clients").select("id,name").eq("id", content.client_id).single().then((r) => r.data as Pick<ClientRow, "id" | "name"> | null),
    supabase.from("deliverable_types").select("*").eq("id", content.deliverable_type_id).single().then((r) => r.data as DeliverableType | null),
    supabase.from("pipeline_statuses").select("*").eq("active", true).order("position").then((r) => ((r.data ?? []) as StatusRow[]).filter((s) => s.deliverable_type_id === null || s.deliverable_type_id === content.deliverable_type_id)),
    supabase.from("profiles").select("*").eq("active", true).order("full_name").then((r) => (r.data ?? []) as Profile[]),
    supabase.from("tasks").select("*").eq("content_id", id).order("due_date", { nullsFirst: false }).then((r) => (r.data ?? []) as TaskRow[]),
    supabase.from("comments").select("*").eq("entity_type", "content").eq("entity_id", id).order("created_at").then((r) => (r.data ?? []) as CommentRow[]),
    supabase.from("activity_log").select("*").eq("entity_type", "content").eq("entity_id", id).order("created_at", { ascending: false }).limit(30).then((r) => (r.data ?? []) as ActivityRow[]),
    supabase.from("content_supporters").select("user_id").eq("content_id", id).then((r) => (r.data ?? []).map((x) => x.user_id as string)),
    supabase.from("content_versions").select("*").eq("content_id", id).order("version", { ascending: false }).then((r) => (r.data ?? []) as VersionRow[]),
    supabase.from("approval_events").select("*").eq("content_id", id).order("created_at", { ascending: false }).then((r) => (r.data ?? []) as ApprovalEventRow[]),
  ]);
  const status = statuses.find((s) => s.id === content.status_id);
  const manager = isManager(ctx.profile.role);
  const nm = (uid: string | null) => members.find((m) => m.user_id === uid)?.full_name ?? "—";
  const attachments = (content.attachments ?? []) as { name: string; url: string }[];

  return (
    <>
      <PageHeader eyebrow={`${client?.name ?? "Cliente"} · ${type?.name ?? ""}`} title={content.title}
        subtitle={<>
          {content.cancelled_at ? <span className="badge badge-bad mr-2">cancelado</span> : <span className={`badge mr-2 ${content.delivery_stage >= 4 ? "badge-ok" : ""}`}>{status?.name}</span>}
          {content.is_extra && <span className="badge badge-info mr-2">extra</span>}
          {content.published_late && <span className="badge badge-warn mr-2">publicado fora do prazo</span>}
          {content.approved_at && <>Aprovado em {formatBR(content.approved_at.slice(0, 10))} por {nm(content.approved_by)} · </>}
          competência {content.competence.slice(5, 7)}/{content.competence.slice(0, 4)}
        </>}
        actions={client && <Link href={`/clientes/${client.id}`} className="btn">Ver cliente</Link>} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Section title="Ficha do conteúdo">
            <ActionForm key={content.status_id} action={updateContentAction} className="space-y-4">
              <input type="hidden" name="id" value={id} />
              <ContentFields members={members} statuses={statuses} showStatus supporters={supporters} defaults={content} />
              <SubmitButton>Salvar alterações</SubmitButton>
            </ActionForm>
          </Section>

          <ApprovalPanel contentId={id} versions={versions} events={apEvents} state={status?.approval_state ?? null} />

          <Section title="Checklist" hint="Salvo automaticamente a cada alteração">
            <ChecklistEditor initial={content.checklist ?? []} save={saveChecklistAction.bind(null, id)} />
          </Section>

          <Section title="Anexos e material" hint="Links para arquivos (Google Drive, Dropbox…). Upload direto e banco de mídia: Fase 2.">
            {attachments.length === 0 ? <Empty>Nenhum anexo.</Empty> : (
              <ul className="mb-4 space-y-2 text-sm">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center justify-between gap-3"><a className="link truncate" href={a.url} target="_blank" rel="noopener noreferrer">{a.name}</a>
                    <ConfirmButton action={removeAttachmentAction} fields={{ id, index: String(i) }} label="Remover" message="Remover este anexo?" className="text-xs text-muted hover:text-bad" /></li>
                ))}
              </ul>
            )}
            <ActionForm action={addAttachmentAction} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <input type="hidden" name="id" value={id} />
              <Field label="Nome"><input className="input" name="name" placeholder="Prévia v1" /></Field>
              <Field label="Link"><input className="input" name="url" type="url" required placeholder="https://" /></Field>
              <SubmitButton className="btn">Anexar</SubmitButton>
            </ActionForm>
          </Section>

          <Section title="Comentários e decisões">
            <Comments entityType="content" entityId={id} comments={comments} members={members} meId={ctx.user.id} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Tarefas deste conteúdo" hint="Tarefas internas não contam como entregas: um Reel com várias tarefas continua sendo um Reel.">
            {tasks.length === 0 ? <Empty>Nenhuma tarefa.</Empty> : (
              <ul className="mb-4 space-y-2 text-sm">
                {tasks.map((t) => (
                  <li key={t.id}><Link href={`/tarefas?tarefa=${t.id}`} className="flex items-start justify-between gap-2 hover:underline">
                    <span className={t.status === "done" ? "text-muted line-through" : ""}>{t.title}<span className="block text-xs text-muted">{nm(t.assignee_id)}{t.due_date ? ` · ${formatBR(t.due_date).slice(0, 5)}` : ""}{t.estimated_hours != null ? ` · ${t.estimated_hours}h` : ""}</span></span>
                    <span className="badge shrink-0">{TASK_STATUS_LABEL[t.status]}</span></Link></li>
                ))}
              </ul>
            )}
            <ActionForm action={createTaskAction} resetOnSuccess className="space-y-2 border-t border-line pt-4">
              <input type="hidden" name="content_id" value={id} />
              <input className="input" name="title" placeholder="Nova tarefa (ex.: Editar vídeo)" required minLength={2} aria-label="Título da tarefa" />
              <div className="grid grid-cols-2 gap-2">
                <select className="input" name="assignee_id" defaultValue={content.assignee_id ?? ""} aria-label="Responsável"><option value="">Sem responsável</option>{members.filter((m) => m.role !== "cliente").map((m) => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}</select>
                <input className="input" type="date" name="due_date" defaultValue={content.internal_deadline ?? ""} aria-label="Prazo" />
                <input className="input" name="estimated_hours" inputMode="decimal" placeholder="Horas est." aria-label="Horas estimadas" />
                <select className="input" name="priority" defaultValue={content.priority} aria-label="Prioridade"><option value="baixa">Baixa</option><option value="media">Média</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
              </div>
              <SubmitButton className="btn">Adicionar tarefa</SubmitButton>
            </ActionForm>
          </Section>

          <Section title="Histórico de alterações">
            <ActivityList items={activity} members={members} />
          </Section>

          <Section title="Ações">
            <div className="flex flex-wrap gap-2">
              {content.cancelled_at ? (
                <form action={restoreContentAction}><input type="hidden" name="id" value={id} /><SubmitButton className="btn">Restaurar conteúdo</SubmitButton></form>
              ) : (
                <div className="w-full space-y-2">
                  <p className="text-xs text-muted">Cancelados não contam como entregues. O histórico é mantido e o conteúdo pode ser restaurado.</p>
                  <ConfirmButton action={cancelContentAction} fields={{ id }} label="Cancelar conteúdo" message="Cancelar este conteúdo? Ele deixará de contar nas entregas do cliente." />
                </div>
              )}
              {manager && <ConfirmButton action={deleteContentAction} fields={{ id }} label="Excluir definitivamente" message="Excluir este conteúdo e suas tarefas? Isto não pode ser desfeito (prefira cancelar para manter o histórico)." />}
            </div>
          </Section>
        </div>
      </div>
    </>
  );
}
