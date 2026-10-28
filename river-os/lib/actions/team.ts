"use server";

import { z } from "zod";
import type { ActionState } from "./types";
import { actor, fail, optDate, optNum, optStr, refresh, str, uuid } from "./util";

const roles = z.enum(["admin", "gestor", "social", "designer", "videomaker", "cliente"]);

export async function inviteMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor(["admin", "gestor"]);
  const email = z.string().trim().toLowerCase().email("E-mail inválido").safeParse(str(fd, "email"));
  const role = roles.safeParse(str(fd, "role"));
  if (!email.success) return { error: email.error.issues[0].message };
  if (!role.success) return { error: "Papel inválido." };
  const { error } = await supabase.from("invites").insert({
    org_id: profile.org_id, email: email.data, role: role.data, full_name: optStr(fd, "full_name"), invited_by: user.id,
  });
  if (error) return fail(error);
  refresh();
  return { ok: `Convite registrado. ${email.data} deve criar a conta com este e-mail para entrar na agência.` };
}

export async function revokeInviteAction(fd: FormData) {
  const { supabase } = await actor(["admin", "gestor"]);
  await supabase.from("invites").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}

export async function updateMemberAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const id = uuid.safeParse(str(fd, "user_id"));
  const hours = optNum(fd, "weekly_capacity_hours");
  if (!id.success) return { error: "Usuário inválido." };
  if (hours === null || Number.isNaN(hours) || hours < 0 || hours > 80) return { error: "Capacidade semanal deve estar entre 0 e 80 horas." };
  const patch: Record<string, unknown> = {
    full_name: str(fd, "full_name") || undefined, job_title: optStr(fd, "job_title"), specialty: optStr(fd, "specialty"), weekly_capacity_hours: hours,
  };
  if (profile.role === "admin") {
    const role = roles.safeParse(str(fd, "role"));
    if (role.success) patch.role = role.data;
    patch.active = fd.get("active") === "on";
  }
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", id.data);
  if (error) return fail(error);
  refresh();
  return { ok: "Colaborador atualizado." };
}

export async function addUnavailabilityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor();
  const from = optDate(fd, "starts_on");
  const to = optDate(fd, "ends_on");
  const kind = z.enum(["ferias", "folga", "outro"]).safeParse(str(fd, "kind"));
  if (!from || !to || !kind.success) return { error: "Informe o período e o tipo." };
  if (to < from) return { error: "O fim não pode ser anterior ao início." };
  const userId = profile.role === "admin" || profile.role === "gestor" ? str(fd, "user_id") || profile.user_id : profile.user_id;
  const { error } = await supabase.from("member_unavailability").insert({
    org_id: profile.org_id, user_id: userId, starts_on: from, ends_on: to, kind: kind.data, note: optStr(fd, "note"),
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Indisponibilidade registrada. A capacidade foi recalculada." };
}

export async function removeUnavailabilityAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("member_unavailability").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}
