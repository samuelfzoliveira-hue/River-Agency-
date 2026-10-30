"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { monthStart, todayBR } from "@/lib/domain/dates";
import type { ActionState } from "./types";
import { actor, fail, optDate, optStr, refresh, str, uuid } from "./util";

const priority = z.enum(["baixa", "media", "alta", "urgente"]);

/** Primeira etapa aplicável ao tipo (específica do tipo, senão a padrão). */
async function firstStatusId(supabase: Awaited<ReturnType<typeof actor>>["supabase"], typeId: string) {
  const { data } = await supabase.from("pipeline_statuses").select("id,deliverable_type_id,position").eq("active", true)
    .or(`deliverable_type_id.is.null,deliverable_type_id.eq.${typeId}`).order("position");
  const own = (data ?? []).filter((s) => s.deliverable_type_id === typeId);
  return (own[0] ?? (data ?? [])[0])?.id as string | undefined;
}

export async function createContentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const clientId = uuid.safeParse(str(fd, "client_id"));
  const typeId = uuid.safeParse(str(fd, "deliverable_type_id"));
  const title = str(fd, "title");
  if (!clientId.success) return { error: "Selecione o cliente." };
  if (!typeId.success) return { error: "Selecione o tipo de conteúdo." };
  if (title.length < 2) return { error: "Informe o título." };
  const pr = priority.safeParse(str(fd, "priority") || "media");
  if (!pr.success) return { error: "Prioridade inválida." };

  const publish = optDate(fd, "publish_date");
  const compInput = str(fd, "competence"); // YYYY-MM
  const competence = /^\d{4}-\d{2}$/.test(compInput) ? `${compInput}-01` : monthStart(publish ?? todayBR());
  const statusId = await firstStatusId(supabase, typeId.data);
  if (!statusId) return { error: "Nenhuma etapa de pipeline configurada." };

  // vincula ao contrato vigente do cliente na competência
  const { data: contracts } = await supabase.from("contracts").select("id,start_date,end_date").eq("client_id", clientId.data).eq("status", "ativo");
  const contract = (contracts ?? []).find((c) => c.start_date <= competence.slice(0, 7) + "-31" && (!c.end_date || c.end_date >= competence));

  const { data, error } = await supabase.from("contents").insert({
    org_id: profile.org_id, client_id: clientId.data, contract_id: contract?.id ?? null, competence, deliverable_type_id: typeId.data,
    title, objective: optStr(fd, "objective"), briefing: optStr(fd, "briefing"), script: optStr(fd, "script"), status_id: statusId,
    assignee_id: optStr(fd, "assignee_id"), priority: pr.data, internal_deadline: optDate(fd, "internal_deadline"), publish_date: publish,
    is_extra: fd.get("is_extra") === "on", created_by: user.id,
  }).select("id").single();
  if (error || !data) return fail(error);
  refresh();
  redirect(`/conteudos/${data.id}`);
}

export async function updateContentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor();
  const id = uuid.safeParse(str(fd, "id"));
  const title = str(fd, "title");
  const pr = priority.safeParse(str(fd, "priority"));
  if (!id.success || !pr.success) return { error: "Dados inválidos." };
  if (title.length < 2) return { error: "Informe o título." };
  const publish = optDate(fd, "publish_date");
  const compInput = str(fd, "competence");
  const patch: Record<string, unknown> = {
    title, objective: optStr(fd, "objective"), briefing: optStr(fd, "briefing"), script: optStr(fd, "script"),
    assignee_id: optStr(fd, "assignee_id"), priority: pr.data, internal_deadline: optDate(fd, "internal_deadline"), publish_date: publish,
    is_extra: fd.get("is_extra") === "on",
  };
  if (/^\d{4}-\d{2}$/.test(compInput)) patch.competence = `${compInput}-01`;
  const statusId = str(fd, "status_id");
  if (uuid.safeParse(statusId).success) patch.status_id = statusId;
  const { error } = await supabase.from("contents").update(patch).eq("id", id.data);
  if (error) return fail(error);
  // colaboradores de apoio
  const supporters = fd.getAll("supporters").map(String).filter((s) => uuid.safeParse(s).success);
  await supabase.from("content_supporters").delete().eq("content_id", id.data);
  if (supporters.length) await supabase.from("content_supporters").insert(supporters.map((user_id) => ({ content_id: id.data, user_id })));
  refresh();
  return { ok: "Conteúdo atualizado." };
}

/** Chamado pelo Kanban (arrastar e soltar). Retorna o erro, se houver, para o cliente reverter a posição. */
export async function moveContentAction(contentId: string, statusId: string): Promise<{ error?: string }> {
  const { supabase } = await actor();
  if (!uuid.safeParse(contentId).success || !uuid.safeParse(statusId).success) return { error: "Dados inválidos." };
  const { error, data } = await supabase.from("contents").update({ status_id: statusId }).eq("id", contentId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { error: "Sem permissão para mover este conteúdo." };
  refresh();
  return {};
}

export async function saveChecklistAction(contentId: string, items: { id: string; text: string; done: boolean }[]): Promise<{ error?: string }> {
  const { supabase } = await actor();
  const clean = items.filter((i) => i.text.trim()).slice(0, 100).map((i) => ({ id: String(i.id).slice(0, 40), text: i.text.trim().slice(0, 300), done: !!i.done }));
  const { error } = await supabase.from("contents").update({ checklist: clean }).eq("id", uuid.parse(contentId));
  if (error) return fail(error);
  return {};
}

export async function cancelContentAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor", "social"]);
  const id = uuid.parse(str(fd, "id"));
  await supabase.from("contents").update({ cancelled_at: new Date().toISOString(), cancel_reason: str(fd, "reason") || null }).eq("id", id);
  refresh();
  redirect("/pipeline");
}

export async function restoreContentAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor", "social"]);
  await supabase.from("contents").update({ cancelled_at: null, cancel_reason: null }).eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

export async function deleteContentAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor"]);
  await supabase.from("contents").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
  redirect("/pipeline");
}

export async function addCommentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const entity = z.enum(["content", "task", "client", "shoot"]).safeParse(str(fd, "entity_type"));
  const entityId = uuid.safeParse(str(fd, "entity_id"));
  const body = str(fd, "body");
  if (!entity.success || !entityId.success) return { error: "Dados inválidos." };
  if (!body) return { error: "Escreva um comentário." };
  if (body.length > 5000) return { error: "Comentário muito longo." };
  // menções: @Nome → usuários da agência cujo primeiro nome aparece depois de @
  const { data: members } = await supabase.from("profiles").select("user_id,full_name").eq("active", true);
  const mentions = (members ?? []).filter((m) => {
    const first = m.full_name.split(" ")[0];
    return first && new RegExp(`@${first.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(body);
  }).map((m) => m.user_id);
  const { error } = await supabase.from("comments").insert({
    org_id: profile.org_id, entity_type: entity.data, entity_id: entityId.data, author_id: user.id, body, mentions,
  });
  if (error) return fail(error);
  refresh();
  return { ok: mentions.length ? `Comentário publicado. ${mentions.length} pessoa(s) notificada(s).` : "Comentário publicado." };
}

export async function deleteCommentAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("comments").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

export async function addAttachmentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor();
  const id = uuid.safeParse(str(fd, "id"));
  const url = str(fd, "url");
  const name = str(fd, "name") || url;
  if (!id.success) return { error: "Conteúdo inválido." };
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: "Informe um link http(s) válido (Google Drive, Dropbox, etc.)." };
  const { data } = await supabase.from("contents").select("attachments").eq("id", id.data).single();
  const list = ((data?.attachments as { name: string; url: string }[]) ?? []).concat({ name: name.slice(0, 120), url });
  const { error } = await supabase.from("contents").update({ attachments: list }).eq("id", id.data);
  if (error) return fail(error);
  refresh();
  return { ok: "Anexo adicionado." };
}

export async function removeAttachmentAction(fd: FormData) {
  const { supabase } = await actor();
  const id = uuid.parse(str(fd, "id"));
  const idx = Number(str(fd, "index"));
  const { data } = await supabase.from("contents").select("attachments").eq("id", id).single();
  const list = ((data?.attachments as { name: string; url: string }[]) ?? []).filter((_, i) => i !== idx);
  await supabase.from("contents").update({ attachments: list }).eq("id", id);
  refresh();
}
