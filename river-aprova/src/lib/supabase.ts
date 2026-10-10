import { createClient } from "@supabase/supabase-js";

export const ADMIN_EMAIL = "riiveragency@gmail.com";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? "http://localhost:54321",
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "missing-key",
);
