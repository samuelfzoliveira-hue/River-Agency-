import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Profile, Role } from "./db";

export const getCtx = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return { supabase, user, profile: (profile as Profile | null) ?? null };
});
export type Ctx = NonNullable<Awaited<ReturnType<typeof getCtx>>> & { profile: Profile };

/** Exige sessão + perfil; opcionalmente restringe por papel. */
export async function requireCtx(roles?: Role[]): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  if (!ctx.profile || !ctx.profile.active) redirect("/onboarding");
  if (ctx.profile.role === "cliente") redirect("/cliente");
  if (roles && !roles.includes(ctx.profile.role)) redirect("/meu-painel");
  return ctx as Ctx;
}
export const isManager = (r: Role) => r === "admin" || r === "gestor";
