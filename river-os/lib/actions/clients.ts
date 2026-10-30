"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { monthStart, todayBR } from "@/lib/domain/dates";
import type { ActionState } from "./types";
import { actor, fail, optDate, optNum, optStr, refresh, str, uuid } from "./util";

const clientSchema = z.object({
  name: z.string().min(2, "Informe o nome da empresa"),
  status: z.enum(["ativo", "pausado", "encerrado"]).default("ativo"),
});

function parseContacts(fd: FormData) {
  const name = str(fd, "contact_name");
  if (!name) return [];
  return [{ name, role: str(fd, "contact_role") || undefined, email: str(fd, "contact_email") || undefined, phone: str(fd, "contact_phone") || undefined }];
}
function parseSocials(fd: FormData) {
  const out: Record<string, string> = {};
  for (const k of ["instagram", "tiktok", "youtube", "linkedin", "site"]) { const v = str(fd, `social_${k}`); if (v) out[k] = v; }
  return out;
}

/** Itens do pacote vêm como item_<typeId> (quantidade) e per_<typeId> (periodicidade). */
function parseItems(fd: FormData) {
  const items: { deliverable_type_id: string; quantity: number; periodicity: string }[] = [];
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("item_")) continue;
    const id = k.slice(5);
    const q = Number(String(v).trim() || 0);
    if (!uuid.safeParse(id).success || !Number.isInteger(q) || q < 0) continue;
    if (q === 0) continue;
    const per = String(fd.get(`per_${id}`) ?? "monthly");
    items.push({ deliverable_type_id: id, quantity: q, periodicity: ["weekly", "biweekly", "monthly"].includes(per) ? per : "monthly" });
  }
  return items;
}

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const parsed = clientSchema.safeParse({ name: str(fd, "name"), status: str(fd, "status") || "ativo" });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const startDate = optDate(fd, "start_date") ?? todayBR();
  const value = optNum(fd, "monthly_value");
  if (value !== null && (Number.isNaN(value) || value < 0)) return { error: "Valor mensal inválido." };

  const { data: client, error } = await supabase.from("clients").insert({
    org_id: profile.org_id, name: parsed.data.name, status: parsed.data.status, segment: optStr(fd, "segment"),
    owner_id: optStr(fd, "owner_id"), contract_start: startDate, contacts: parseContacts(fd), socials: parseSocials(fd),
    strategic_notes: optStr(fd, "strategic_notes"),
  }).select("id").single();
  if (error || !client) return fail(error);

  if (value !== null) {
    const { error: e } = await supabase.from("client_financials").insert({ client_id: client.id, org_id: profile.org_id, monthly_value: value });
    if (e) return fail(e);
  }
  const items = parseItems(fd);
  if (items.length) {
    const { data: contract, error: e } = await supabase.from("contracts").insert({
      org_id: profile.org_id, client_id: client.id, start_date: startDate, end_date: optDate(fd, "end_date"),
      completion_criterion: str(fd, "criterion") || "published",
    }).select("id").single();
    if (e || !contract) return fail(e);
    const { error: e2 } = await supabase.from("contract_items").insert(items.map((i) => ({ ...i, contract_id: contract.id })));
    if (e2) return fail(e2);
    await supabase.rpc("ensure_monthly_targets", { p_month: monthStart(todayBR()) });
  }
  refresh();
  redirect(`/clientes/${client.id}`);
}

export async function updateClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const id = uuid.safeParse(str(fd, "id"));
  const parsed = clientSchema.safeParse({ name: str(fd, "name"), status: str(fd, "status") });
  if (!id.success || !parsed.success) return { error: parsed.success ? "Cliente inválido" : parsed.error.issues[0].message };
  const { error } = await supabase.from("clients").update({
    name: parsed.data.name, status: parsed.data.status, segment: optStr(fd, "segment"), owner_id: optStr(fd, "owner_id"),
    contacts: parseContacts(fd), socials: parseSocials(fd), strategic_notes: optStr(fd, "strategic_notes"),
  }).eq("id", id.data);
  if (error) return fail(error);
  const value = optNum(fd, "monthly_value");
  if (value !== null && !Number.isNaN(value)) {
    const { error: e } = await supabase.from("client_financials").upsert({ client_id: id.data, org_id: profile.org_id, monthly_value: value });
    if (e) return fail(e);
  }
  refresh();
  return { ok: "Cadastro atualizado." };
}

export async function deleteClientAction(fd: FormData) {
  const { supabase } = await actor(["admin"]);
  const id = uuid.parse(str(fd, "id"));
  await supabase.from("clients").delete().eq("id", id);
  refresh();
  redirect("/clientes");
}

/** Cria ou atualiza o contrato. O pacote novo vale para os meses seguintes; metas já geradas não são reescritas. */
export async function saveContractAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const clientId = uuid.safeParse(str(fd, "client_id"));
  if (!clientId.success) return { error: "Cliente inválido" };
  const start = optDate(fd, "start_date");
  if (!start) return { error: "Informe a data de início." };
  const end = optDate(fd, "end_date");
  if (end && end < start) return { error: "O encerramento não pode ser anterior ao início." };
  const criterion = z.enum(["approved", "scheduled", "published"]).safeParse(str(fd, "criterion"));
  if (!criterion.success) return { error: "Critério de conclusão inválido." };
  const status = z.enum(["ativo", "pausado", "encerrado"]).safeParse(str(fd, "status") || "ativo");
  if (!status.success) return { error: "Status inválido." };

  let contractId = str(fd, "contract_id");
  const base = { start_date: start, end_date: end, completion_criterion: criterion.data, status: status.data, name: str(fd, "name") || "Contrato mensal" };
  if (contractId) {
    const { error } = await supabase.from("contracts").update(base).eq("id", uuid.parse(contractId));
    if (error) return fail(error);
  } else {
    const { data, error } = await supabase.from("contracts").insert({ ...base, org_id: profile.org_id, client_id: clientId.data }).select("id").single();
    if (error || !data) return fail(error);
    contractId = data.id;
  }
  const items = parseItems(fd);
  // pacote padrão: substitui os itens (afeta somente meses ainda sem meta gerada)
  await supabase.from("contract_items").delete().eq("contract_id", contractId);
  if (items.length) {
    const { error } = await supabase.from("contract_items").insert(items.map((i) => ({ ...i, contract_id: contractId })));
    if (error) return fail(error);
  }
  await supabase.rpc("ensure_monthly_targets", { p_month: monthStart(todayBR()) });
  refresh();
  return { ok: "Contrato salvo. O novo pacote vale para metas ainda não geradas; ajuste o mês corrente abaixo, se necessário." };
}

/** Ajusta as metas de UMA competência (contratos com quantidades diferentes por mês). */
export async function saveMonthTargetsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor(["admin", "gestor"]);
  const competence = str(fd, "competence");
  if (!/^\d{4}-\d{2}-01$/.test(competence)) return { error: "Competência inválida." };
  let n = 0;
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("target_")) continue;
    const id = k.slice(7);
    const q = Number(String(v).trim() || 0);
    if (!uuid.safeParse(id).success || !Number.isInteger(q) || q < 0) return { error: "Quantidades devem ser números inteiros ≥ 0." };
    const { error } = await supabase.from("monthly_targets").update({ quantity: q }).eq("id", id).eq("competence", competence);
    if (error) return fail(error);
    n++;
  }
  refresh();
  return { ok: `${n} meta(s) de ${competence.slice(5, 7)}/${competence.slice(0, 4)} atualizadas. Outros meses não foram alterados.` };
}

/** Meta extra para o mês: adiciona um tipo que não estava no pacote. */
export async function addMonthTargetAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase, profile } = await actor(["admin", "gestor"]);
  const competence = str(fd, "competence");
  const contractId = uuid.safeParse(str(fd, "contract_id"));
  const typeId = uuid.safeParse(str(fd, "deliverable_type_id"));
  const q = Number(str(fd, "quantity"));
  if (!/^\d{4}-\d{2}-01$/.test(competence) || !contractId.success || !typeId.success || !Number.isInteger(q) || q < 0) return { error: "Dados inválidos." };
  const { data: contract } = await supabase.from("contracts").select("client_id,completion_criterion").eq("id", contractId.data).single();
  if (!contract) return { error: "Contrato não encontrado." };
  const { error } = await supabase.from("monthly_targets").upsert({
    org_id: profile.org_id, contract_id: contractId.data, client_id: contract.client_id, competence, deliverable_type_id: typeId.data,
    quantity: q, completion_criterion: contract.completion_criterion,
  }, { onConflict: "contract_id,competence,deliverable_type_id" });
  if (error) return fail(error);
  refresh();
  return { ok: "Meta adicionada ao mês." };
}
