# Implantação do RIVER OS (passo a passo)

Tempo estimado: 20–30 min. Nada aqui exige a CLI do Supabase, mas ela é a opção mais limpa (`supabase db push`).

## 1. Supabase

1. Crie um projeto em supabase.com (região mais próxima; guarde a senha do banco).
2. **Aplicar o banco** — escolha uma:
   - **CLI:** `supabase link --project-ref <ref>` e `supabase db push` (usa `supabase/migrations/`).
   - **SQL Editor:** cole o conteúdo de `supabase/apply-all.sql` (todas as 6 migrações, em ordem) e execute. Se alterar uma migração, gere de novo com `./supabase/bundle.sh`.
3. **Conferir:** cole `supabase/post-apply-check.sql` no SQL Editor. **Todas as linhas devem mostrar `ok = true`.** Qualquer `false` indica algo a corrigir antes de usar (ex.: bucket `media` ausente ou coluna de dono do Storage com nome diferente).
4. Authentication → URL Configuration: *Site URL* = a URL do app (ex.: `https://os.suaagencia.com`), e em *Redirect URLs* acrescente `<URL>/auth/callback`.
5. Settings → API: copie *Project URL* e a chave **anon**. A chave **service_role** só é necessária para a rotina `/api/cron` (e-mail/automações) — nunca a coloque em variável `NEXT_PUBLIC_*`.

## 2. Aplicação (Vercel ou similar)

Variáveis de ambiente (veja `.env.example`):

| Variável | Obrigatória | Uso |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | sim | conexão do app |
| `NEXT_PUBLIC_SITE_URL` | sim | links de confirmação/aprovação |
| `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` | para automações por agendador | protege e executa `/api/cron` |
| `RESEND_API_KEY`, `EMAIL_FROM` | para e-mails | sem elas a rota só faz ensaio |

Projeto Vercel: *Root Directory* = `river-os`. O `vercel.json` agenda `/api/cron` de hora em hora.

### Armadilhas comuns na Vercel

- **A pasta `river-os` não aparece:** a Vercel importa a *branch padrão* do repositório. Garanta que o código do RIVER OS esteja nela.
- **“Nenhum serviço detectado” / preset “Services”:** troque **Application Preset** para **Next.js** e deixe **Root Directory** = `river-os`.
- **“Project … already exists”:** cada clique em Deploy cria o projeto antes de compilar; se a compilação falhar, o projeto fica. Abra o projeto existente em vez de criar outro (Settings → ajustar → novo deploy).
- **Site abre mas o login falha:** confira `NEXT_PUBLIC_SUPABASE_URL` (precisa ser a URL real do projeto, sem espaços ou barra no final) e a chave pública.
- Depois de mudar variáveis de ambiente, é preciso um **novo deploy** para valerem.

## 3. Primeiro acesso

1. Abra `/cadastro`, crie a conta do administrador e, no passo seguinte, a agência (cria etapas e tipos padrão).
2. **Cadastros:** com “Enable sign ups” ligado, quem se cadastra sem convite cria uma agência própria e isolada (não enxerga seus dados). Se preferir fechar, desligue “Enable sign ups” depois do primeiro acesso e convide pessoas por Authentication → Users → *Invite user* usando o **mesmo e-mail** do convite registrado em Equipe/Cliente: o perfil e o papel são aplicados automaticamente no primeiro login.
3. Em Equipe → Convidar, cadastre a equipe; em cada cliente → Portal do cliente, libere o acesso de quem aprova.
4. Em Configurações, revise etapas, tipos de entrega e limites de alerta.

## 4. Smoke test (10 min)

1. Crie um cliente com pacote → Clientes mostra 0% e metas do mês.
2. Crie um conteúdo, mova no Pipeline até “Aprovado” → o cliente passa a 1 entrega (critério “após aprovação”).
3. Na ficha do conteúdo: crie uma versão com um arquivo, **Enviar para aprovação**, abra o link numa janela anônima e aprove.
4. Banco de mídia: envie uma imagem e abra-a.
5. Tarefas: inicie e pare o cronômetro. Relatórios: confira o período e baixe o CSV/PDF.
6. Fechamento: feche o mês do cliente e exporte o PDF.
