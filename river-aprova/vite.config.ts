import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Aceita variáveis com prefixo VITE_ (padrão) ou NEXT_PUBLIC_ (formato copiado do Supabase).
export default defineConfig({ plugins: [react()], envPrefix: ["VITE_", "NEXT_PUBLIC_"] });
