"use server";

import { z } from "zod";
import { BUCKET, kindFromMime, pathBelongs } from "@/lib/storage";
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

/** Registra um arquivo já enviado ao Storage. O caminho é revalidado: precisa ser da agência e do cliente informado. */
export async function registerMediaFileAction(fd: FormData): Promise<{ error?: string }> {
  const { supabase, profile, user } = await actor();
  const clientId = uuid.safeParse(str(fd, "client_id"));
  const path = str(fd, "path");
  const mime = str(fd, "mime");
  const size = Number(str(fd, "size"));
  if (!clientId.success) return { error: "Selecione o cliente." };
  if (!pathBelongs(path, profile.org_id, clientId.data)) return { error: "Caminho de arquivo inválido." };
  if (!Number.isFinite(size) || size <= 0 || size > 50 * 1024 * 1024) return { error: "Tamanho inválido." };
  const { data: exists } = await supabase.storage.from(BUCKET).list(`${profile.org_id}/${clientId.data}`, { search: path.split("/")[2] });
  if (!exists?.some((o) => o.name === path.split("/")[2])) return { error: "O arquivo não foi encontrado no armazenamento." };
  const { error } = await supabase.from("media_assets").insert({
    org_id: profile.org_id, client_id: clientId.data, name: str(fd, "name").slice(0, 160) || "Arquivo", storage_path: path, size_bytes: size, kind: kindFromMime(mime),
    campaign: optStr(fd, "campaign"), captured_on: optDate(fd, "captured_on"), created_by: user.id,
  });
  if (error) { await supabase.storage.from(BUCKET).remove([path]); return fail(error); }
  refresh();
  return {};
}

export async function deleteMediaAction(fd: FormData) {
  const { supabase } = await actor();
  const id = uuid.parse(str(fd, "id"));
  const { data } = await supabase.from("media_assets").select("storage_path").eq("id", id).maybeSingle();
  const { error } = await supabase.from("media_assets").delete().eq("id", id);
  if (!error && data?.storage_path) await supabase.storage.from(BUCKET).remove([data.storage_path]);
  refresh();
}
