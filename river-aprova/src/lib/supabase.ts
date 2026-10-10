import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "riiveragency@gmail.com";

const env = import.meta.env;

export const supabase = createClient(
  env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
  env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "missing-key",
);
