"use server";

import { z } from "zod";
import type { ActionState } from "./types";
import { actor, fail, optDate, optNum, optStr, refresh, str, uuid } from "./util";

const priority = z.enum(["baixa", "media", "alta", "urgente"]);

export async function createTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const title = str(fd, "title");
  const pr = priority.safeParse(str(fd, "priority") || "media");
  if (title.length < 2) return { error: "Informe o título da tarefa." };
  if (!pr.success) return { error: "Prioridade inválida." };
  const hours = optNum(fd, "estimated_hours");
  if (hours !== null && (Number.isNaN(hours) || hours < 0 || hours > 999)) return { error: "Estimativa de horas inválida." };
  const contentId = optStr(fd, "content_id");
  let clientId = optStr(fd, "client_id");
  if (contentId && uuid.safeParse(contentId).success) {
    const { data } = await supabase.from("contents").select("client_id").eq("id", contentId).maybeSingle();
    clientId = data?.client_id ?? clientId;
  }
  const { error } = await supabase.from("tasks").insert({
    org_id: profile.org_id, title, description: optStr(fd, "description"), client_id: clientId, content_id: contentId,
    assignee_id: optStr(fd, "assignee_id"), priority: pr.data, due_date: optDate(fd, "due_date"), estimated_hours: hours, created_by: user.id,
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Tarefa criada." };
}

export async function updateTaskAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor();
  const id = uuid.safeParse(str(fd, "id"));
  const pr = priority.safeParse(str(fd, "priority"));
  const status = z.enum(["todo", "doing", "done", "cancelled"]).safeParse(str(fd, "status"));
  const title = str(fd, "title");
  if (!id.success || !pr.success || !status.success || title.length < 2) return { error: "Dados inválidos." };
  const hours = optNum(fd, "estimated_hours");
  const logged = optNum(fd, "logged_hours");
  if ((hours !== null && (Number.isNaN(hours) || hours < 0)) || (logged !== null && (Number.isNaN(logged) || logged < 0))) return { error: "Horas inválidas." };
  const { data, error } = await supabase.from("tasks").update({
    title, description: optStr(fd, "description"), assignee_id: optStr(fd, "assignee_id"), priority: pr.data, status: status.data,
    due_date: optDate(fd, "due_date"), estimated_hours: hours, logged_hours: logged ?? 0,
  }).eq("id", id.data).select("id");
  if (error) return fail(error);
  if (!data?.length) return { error: "Você só pode editar tarefas atribuídas a você ou criadas por você." };
  refresh();
  return { ok: "Tarefa atualizada." };
}

export async function setTaskStatusAction(fd: FormData) {
  const { supabase } = await actor();
  const status = z.enum(["todo", "doing", "done", "cancelled"]).parse(str(fd, "status"));
  await supabase.from("tasks").update({ status }).eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

/** Redistribuição direta (painel de capacidade): troca o responsável de uma tarefa. */
export async function reassignTaskAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor"]);
  const to = str(fd, "assignee_id");
  await supabase.from("tasks").update({ assignee_id: uuid.safeParse(to).success ? to : null }).eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

export async function deleteTaskAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor"]);
  await supabase.from("tasks").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}
