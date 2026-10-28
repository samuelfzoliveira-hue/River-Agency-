"use server";

import { buildClosing } from "@/lib/domain/closing";
import { loadClientMonth } from "@/lib/data";
import type { ActionState } from "./types";
import { actor, fail, refresh, str, uuid } from "./util";

/** O cálculo é refeito no servidor no instante do fechamento; nada é apagado ou movido. */
export async function closeMonthAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor(["admin", "gestor"]);
  const clientId = uuid.safeParse(str(fd, "client_id"));
  const competence = str(fd, "competence");
  if (!clientId.success || !/^\d{4}-\d{2}-01$/.test(competence)) return { error: "Dados inválidos." };
  const { calc } = await loadClientMonth(supabase, clientId.data, competence);
  if (calc.contracted === 0) return { error: "Não há metas cadastradas para este mês; não há o que fechar." };
  const { snapshot, pending } = buildClosing(calc);
  const { error } = await supabase.rpc("close_month", { p_client: clientId.data, p_competence: competence, p_snapshot: snapshot, p_pending: pending, p_notes: str(fd, "notes") });
  if (error) return fail(error);
  refresh();
  return { ok: `Mês fechado: ${snapshot.delivered} de ${snapshot.contracted} entregas. ${pending.length ? "As pendências foram registradas com a competência original." : "Nenhuma pendência."}` };
}

export async function reopenMonthAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await actor(["admin"]);
  const id = uuid.safeParse(str(fd, "closing_id"));
  if (!id.success) return { error: "Fechamento inválido." };
  const { error } = await supabase.rpc("reopen_month", { p_closing: id.data, p_reason: str(fd, "reason") });
  if (error) return fail(error);
  refresh();
  return { ok: "Fechamento reaberto e registrado no histórico." };
}
