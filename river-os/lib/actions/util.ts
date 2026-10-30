import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCtx, type Ctx } from "@/lib/session";
import type { Role } from "@/lib/db";

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const optDate = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
};
export const optNum = (fd: FormData, k: string) => {
  const v = str(fd, k).replace(",", ".");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
export const uuid = z.string().uuid("Identificador inválido");

/** Atualiza todas as telas: dashboard, Central, cliente, pipeline e equipe leem os mesmos dados. */
export const refresh = () => revalidatePath("/", "layout");

export async function actor(roles?: Role[]): Promise<Ctx> {
  const ctx = await requireCtx(roles);
  return ctx;
}

export function fail(e: { message: string } | null | undefined, fallback = "Não foi possível salvar."): { error: string } {
  const m = e?.message ?? "";
  if (m.includes("row-level security") || m.includes("permission denied")) return { error: "Você não tem permissão para esta ação." };
  if (m.includes("duplicate key")) return { error: "Já existe um registro igual." };
  if (m.includes("violates foreign key")) return { error: "Registro relacionado não encontrado." };
  if (m.includes("etapa não pertence")) return { error: "Esta etapa não pertence ao tipo de projeto do conteúdo." };
  return { error: m && m.length < 140 ? m : fallback };
}
