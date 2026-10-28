"use server";

import { z } from "zod";
import { brDate, monthStart } from "@/lib/domain/dates";
import type { ActionState } from "./types";
import { actor, fail, optNum, optStr, refresh, str, uuid } from "./util";

/** Converte "YYYY-MM-DDTHH:mm" digitado no fuso da agência (UTC-3, sem horário de verão desde 2019) para ISO. */
function localToISO(v: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return null;
  return new Date(`${v}:00-03:00`).toISOString();
}

export async function createShootAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const clientId = uuid.safeParse(str(fd, "client_id"));
  const startsAt = localToISO(str(fd, "starts_at"));
  const dur = optNum(fd, "duration_minutes") ?? 120;
  if (!clientId.success) return { error: "Selecione o cliente." };
  if (!startsAt) return { error: "Informe data e horário." };
  if (!Number.isInteger(dur) || dur <= 0) return { error: "Duração inválida." };
  const { data, error } = await supabase.from("shoots").insert({
    org_id: profile.org_id, client_id: clientId.data, title: str(fd, "title") || "Captação", starts_at: startsAt,
    competence: monthStart(brDate(startsAt)), duration_minutes: dur, location: optStr(fd, "location"), notes: optStr(fd, "notes"),
    is_extra: fd.get("is_extra") === "on", created_by: user.id,
  }).select("id").single();
  if (error || !data) return fail(error);
  const team = fd.getAll("team").map(String).filter((s) => uuid.safeParse(s).success);
  if (team.length) await supabase.from("shoot_members").insert(team.map((user_id) => ({ shoot_id: data.id, user_id })));
  refresh();
  return { ok: "Captação agendada." };
}

export async function setShootStatusAction(fd: FormData) {
  const { supabase } = await actor();
  const status = z.enum(["agendada", "realizada", "reagendada", "cancelada"]).parse(str(fd, "status"));
  await supabase.from("shoots").update({ status }).eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

export async function rescheduleShootAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor();
  const startsAt = localToISO(str(fd, "starts_at"));
  if (!startsAt) return { error: "Informe data e horário." };
  const { error } = await supabase.from("shoots").update({
    starts_at: startsAt, competence: monthStart(brDate(startsAt)), status: "reagendada",
    location: optStr(fd, "location"), raw_material_url: optStr(fd, "raw_material_url"), notes: optStr(fd, "notes"),
  }).eq("id", uuid.parse(str(fd, "id")));
  if (error) return fail(error);
  refresh();
  return { ok: "Captação atualizada. Alertas e carga da equipe foram recalculados." };
}

export async function linkShootContentAction(fd: FormData) {
  const { supabase } = await actor();
  const shoot = uuid.parse(str(fd, "shoot_id"));
  const content = uuid.safeParse(str(fd, "content_id"));
  if (!content.success) return;
  await supabase.from("shoot_contents").upsert({ shoot_id: shoot, content_id: content.data });
  refresh();
}

export async function toggleRecordedAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("shoot_contents").update({ recorded: str(fd, "recorded") === "true" })
    .eq("shoot_id", uuid.parse(str(fd, "shoot_id"))).eq("content_id", uuid.parse(str(fd, "content_id")));
  refresh();
}

export async function unlinkShootContentAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("shoot_contents").delete().eq("shoot_id", uuid.parse(str(fd, "shoot_id"))).eq("content_id", uuid.parse(str(fd, "content_id")));
  refresh();
}
