"use server";

import type { ActionState } from "./types";
import { actor, fail, optNum, refresh, str, uuid } from "./util";

export async function saveStatusAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin"]);
  const name = str(fd, "name");
  const position = optNum(fd, "position");
  const stage = Number(str(fd, "stage"));
  const approval = str(fd, "approval_state");
  if (name.length < 2) return { error: "Informe o nome da etapa." };
  if (position === null || Number.isNaN(position) || !Number.isInteger(position)) return { error: "Posição inválida." };
  if (![0, 1, 2, 3, 4].includes(stage)) return { error: "Estágio inválido." };
  const row = {
    name, position, stage, approval_state: ["aguardando", "ajustes", "aprovado"].includes(approval) ? approval : null,
    active: fd.get("active") === "on", deliverable_type_id: str(fd, "deliverable_type_id") || null,
  };
  const id = str(fd, "id");
  const { error } = id
    ? await supabase.from("pipeline_statuses").update(row).eq("id", uuid.parse(id))
    : await supabase.from("pipeline_statuses").insert({ ...row, org_id: profile.org_id });
  if (error) return fail(error);
  refresh();
  return { ok: "Etapa salva." };
}

export async function saveTypeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin"]);
  const name = str(fd, "name");
  const hours = optNum(fd, "default_hours");
  if (name.length < 2) return { error: "Informe o nome." };
  if (hours === null || Number.isNaN(hours) || hours < 0) return { error: "Horas padrão inválidas." };
  const id = str(fd, "id");
  if (id) {
    const { error } = await supabase.from("deliverable_types").update({ name, default_hours: hours, active: fd.get("active") === "on" }).eq("id", uuid.parse(id));
    if (error) return fail(error);
  } else {
    const key = name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const kind = str(fd, "kind") === "shoot" ? "shoot" : "content";
    const { error } = await supabase.from("deliverable_types").insert({ org_id: profile.org_id, key: key || "tipo", name, kind, default_hours: hours, position: 99 });
    if (error) return fail(error);
  }
  refresh();
  return { ok: "Tipo salvo." };
}

/** Limites de alerta: sem cliente = padrão da agência; com cliente = exceção daquele cliente. */
export async function saveAlertSettingsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const clientId = str(fd, "client_id") || null;
  const typeId = str(fd, "deliverable_type_id") || null;
  const num = (k: string) => optNum(fd, k);
  const wait = num("approval_wait_hours"), warn = num("deadline_warning_days"), end = num("contract_end_warning_days"), per = num("min_business_days_per_item");
  if ([wait, warn, end, per].some((n) => n === null || Number.isNaN(n))) return { error: "Preencha todos os limites com números." };
  if (wait! <= 0 || per! <= 0 || warn! < 0 || end! < 0) return { error: "Limites devem ser positivos." };
  if (clientId && !uuid.safeParse(clientId).success) return { error: "Cliente inválido." };
  let q = supabase.from("alert_settings").select("id").eq("org_id", profile.org_id);
  q = clientId ? q.eq("client_id", clientId) : q.is("client_id", null);
  q = typeId ? q.eq("deliverable_type_id", typeId) : q.is("deliverable_type_id", null);
  const { data: existing } = await q.maybeSingle();
  const row = { approval_wait_hours: wait, deadline_warning_days: warn, contract_end_warning_days: end, min_business_days_per_item: per };
  const { error } = existing
    ? await supabase.from("alert_settings").update(row).eq("id", existing.id)
    : await supabase.from("alert_settings").insert({ ...row, org_id: profile.org_id, client_id: clientId, deliverable_type_id: typeId });
  if (error) return fail(error);
  refresh();
  return { ok: "Limites de alerta salvos." };
}
