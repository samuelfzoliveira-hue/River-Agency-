import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "riiveragency@gmail.com";

const env = import.meta.env;
export const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
const KEY: string = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "missing-key";

export const supabase = createClient(SUPABASE_URL, KEY);

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${data.session?.access_token ?? ""}` };
}

/** Chama uma função serverless (/api/...) como o usuário logado. */
export async function callApi<T = unknown>(path: string, body: unknown): Promise<{ ok: boolean; data: T & { error?: string } }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, data: await res.json().catch(() => ({} as T & { error?: string })) };
  } catch {
    return { ok: false, data: { error: "Falha de conexão. Tente novamente." } as T & { error?: string } };
  }
}
