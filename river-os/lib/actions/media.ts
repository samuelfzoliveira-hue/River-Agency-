"use server";

import { z } from "zod";
import type { ActionState } from "./types";
import { actor, fail, optDate, optStr, refresh, str, uuid } from "./util";

export async function addMediaAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile, user } = await actor();
  const clientId = uuid.safeParse(str(fd, "client_id"));
  const kind = z.enum(["imagem", "video", "documento", "outro"]).safeParse(str(fd, "kind") || "outro");
  const url = str(fd, "url");
  const name = str(fd, "name");
  if (!clientId.success) return { error: "Selecione o cliente." };
  if (name.length < 2) return { error: "Informe um nome." };
  if (!/^https?:\/\/[^\s]+$/i.test(url)) return { error: "Informe um link http(s) válido (ex.: pasta do Google Drive)." };
  if (!kind.success) return { error: "Tipo inválido." };
  const { error } = await supabase.from("media_assets").insert({
    org_id: profile.org_id, client_id: clientId.data, name, url, kind: kind.data, campaign: optStr(fd, "campaign"),
    captured_on: optDate(fd, "captured_on"), created_by: user.id,
  });
  if (error) return fail(error);
  refresh();
  return { ok: "Material adicionado ao banco de mídia." };
}

export async function deleteMediaAction(fd: FormData) {
  const { supabase } = await actor();
  await supabase.from("media_assets").delete().eq("id", uuid.parse(str(fd, "id")));
  refresh();
}
