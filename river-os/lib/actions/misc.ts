"use server";

import { z } from "zod";
import type { ActionState } from "./types";
import { actor, fail, optStr, refresh, str, uuid } from "./util";

export async function markNotificationAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", uuid.parse(str(fd, "id"))).is("read_at", null);
  refresh();
}
export async function markAllNotificationsAction() {
  const { supabase } = await actor();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
  refresh();
}

export async function createEventAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const title = str(fd, "title");
  const kind = z.enum(["reuniao", "campanha", "prazo_aprovacao", "interno", "outro"]).safeParse(str(fd, "kind"));
  const at = str(fd, "starts_at");
  if (title.length < 2) return { error: "Informe o título." };
  if (!kind.success) return { error: "Tipo inválido." };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at)) return { error: "Informe data e horário." };
  const { error } = await supabase.from("events").insert({
    org_id: profile.org_id, title, kind: kind.data, starts_at: new Date(`${at}:00-03:00`).toISOString(),
    client_id: optStr(fd, "client_id"), notes: optStr(fd, "notes"), created_by: user.id,
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Evento criado." };
}
export async function deleteEventAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("events").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}
