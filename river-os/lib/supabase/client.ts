import { createBrowserClient } from "@supabase/ssr";

/** Cliente do navegador: usado só para enviar arquivos direto ao Storage (a sessão vem dos cookies). */
export const createBrowserSupabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
