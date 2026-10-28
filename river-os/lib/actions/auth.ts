"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "./types";

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter ao menos 8 caracteres"),
});

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = credentials.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "E-mail ou senha incorretos." };
  redirect("/");
}

export async function signup(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = credentials.extend({ full_name: z.string().trim().min(2, "Informe seu nome") }).safeParse({
    email: fd.get("email"), password: fd.get("password"), full_name: fd.get("full_name"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email, password: parsed.data.password,
    options: { data: { full_name: parsed.data.full_name }, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { error: error.message.includes("registered") ? "Este e-mail já tem cadastro. Entre ou recupere a senha." : "Não foi possível criar a conta. Tente novamente." };
  if (data.session) redirect("/"); // confirmação de e-mail desativada: já está logado
  return { ok: "Conta criada. Confirme seu e-mail para entrar." };
}

export async function bootstrapAgency(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ org: z.string().trim().min(2, "Informe o nome da agência"), name: z.string().trim().min(2, "Informe seu nome") })
    .safeParse({ org: fd.get("org"), name: fd.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_organization", { p_org_name: parsed.data.org, p_full_name: parsed.data.name });
  if (error) return { error: error.message };
  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
