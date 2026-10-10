# River Aprova

Portal de aprovação de conteúdo de Instagram da River Agency. Vite + React + TypeScript + Tailwind; Supabase (Auth, Postgres, Storage); funções serverless na Vercel (`api/`).

## Banco (rodar no SQL Editor do Supabase, nesta ordem)
1. `supabase/migrations/20261010000000_auth_profiles.sql`
2. `supabase/migrations/20261010010000_allowed_signups.sql`
3. `supabase/migrations/20261011000000_clients_contents.sql`

## Variáveis de ambiente (Vercel)
| Nome | Para quê |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | app (públicas) |
| `SUPABASE_SERVICE_ROLE_KEY` | criar clientes e enviar e-mails (**secreta**) |
| `RESEND_API_KEY` | envio dos e-mails de notificação (sem ela, o sino funciona e os e-mails são ignorados) |
| `RESEND_FROM` (opcional) | remetente, ex.: `River Aprova <aviso@seudominio.com>` (precisa de domínio verificado no Resend para enviar a clientes) |
| `APP_URL` (opcional) | endereço do site usado nos links dos e-mails |

## Rotas
Cliente: `/conteudos` (abas + "Meu feed"), `/conteudo/:id`, `/trocar-senha`. Admin: `/admin`, `/admin/clientes/:id`, `/conteudo/:id`.

## Testes de segurança
`PGHOST=... PGUSER=... ./supabase/tests/run.sh` (ver `SECURITY.md`).
