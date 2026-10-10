# River Aprova — etapa 1 (base + autenticação)

Portal de aprovação de conteúdo de Instagram da River Agency. Vite + React + TypeScript + Tailwind, backend Supabase (Lovable Cloud).

## Backend
Aplique `supabase/migrations/20261010000000_auth_profiles.sql` (tabela `profiles` com `role`, RLS, bloqueio de cadastro público e papel admin automático para `riiveragency@gmail.com`).

- **Cadastro**: um trigger em `auth.users` rejeita qualquer e-mail diferente do admin. A próxima etapa criará clientes via API administrativa com `app_metadata.created_by_admin = true` (único caminho que o trigger aceita além do e-mail do admin).
- **Primeiro acesso do admin**: `/primeiro-acesso` (rota sem link no app) — ou crie o usuário no painel do backend.
- **Redefinição de senha**: adicione `<url-do-app>/redefinir-senha` às URLs de redirecionamento permitidas da autenticação.

## Rodar
```bash
cp .env.example .env   # VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm install && npm run dev
```

Rotas: `/login`, `/esqueci-senha`, `/redefinir-senha`, `/admin`, `/conteudos`.
