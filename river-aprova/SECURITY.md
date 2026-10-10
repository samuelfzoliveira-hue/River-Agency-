# Revisão de segurança — River Aprova

Escopo: RLS das tabelas e do storage, isolamento entre clientes, ações restritas ao admin.

## Como foi verificado
`supabase/tests/run.sh` sobe um Postgres local com *stubs* do Supabase (roles `anon`/`authenticated`, `auth.uid()`, `storage.objects`), aplica **todas as migrações** e roda `rls_test.sql`: **68 testes, 0 falhas**.
Limite honesto: os testes rodam em Postgres local, não na instância real do Supabase; a API de Storage (URLs assinadas, upload TUS) e o Auth real não foram exercitados.

## O que foi verificado
**Isolamento entre clientes** (testado com dois clientes + admin)
- Cliente vê apenas os próprios `clients`, `contents`, `content_versions`, `content_media`, `approval_log`; por id direto, retorna 0 linhas para conteúdo de outro.
- Cliente não lê `profiles` de outros, `notifications` nem `allowed_signups`.
- Storage: bucket `media` privado; cliente só **lê** objetos cuja primeira pasta é o próprio `client_id`; não envia, não apaga.
- Mídias só são aceitas se o caminho começa com o `client_id` do conteúdo (bloqueia apontar para arquivo de outro cliente e `..`).

**Só o admin**
- Criar cliente: `/api/create-client` valida o JWT e o papel `admin` no servidor (chave de serviço nunca vai ao navegador).
- Criar conteúdo, nova versão, reabrir, marcar publicado e reordenar feed: funções `SECURITY DEFINER` que checam `is_admin()`; cliente recebe "Acesso negado".
- Cliente não consegue `INSERT/UPDATE/DELETE` direto em `contents`, `clients`, `profiles`, `approval_log`, `notifications`.
- `approval_log` é imutável (sem permissão de escrita para ninguém no app); só as funções gravam.

**Regras de aprovação no banco** (não só na tela)
- Só decide o dono do conteúdo, só quando `aguardando`; aprovado fica bloqueado; comentário obrigatório no ajuste; slide e `mm:ss` validados.
- Nova versão só com `ajuste_solicitado`; reabrir só `aprovado`.

**Permissões de função**: `anon` não tem EXECUTE em nenhuma função sensível; `validate_media`/`insert_media` são internas (nem `authenticated` executa).

## O que foi corrigido durante a revisão
1. **Cadastro bloqueado** não dependia de dado confiável: a versão inicial confiava em `app_metadata` na criação, que a API pode gravar só depois do INSERT (e barrava o próprio admin). Agora o servidor pré-aprova o e-mail em `allowed_signups` (tabela fechada ao app) por instantes; qualquer outro cadastro público continua sendo recusado pelo trigger.
2. **Tela em branco** (loop de redirecionamento) para usuário logado sem perfil: agora volta ao login.
3. Cabeçalhos de segurança no `vercel.json` (CSP restritiva, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`).
4. Falha ao criar o cliente desfaz a conta de login criada (sem conta órfã) e remove uploads já enviados.

## Riscos conhecidos / recomendações
- **Troca obrigatória de senha é imposta pela interface.** O flag `must_change_password` só é limpo pela função `complete_password_change`, mas um cliente mal-intencionado poderia chamá-la sem trocar a senha (afeta só a própria conta). Para impor no servidor seria preciso um *hook* de Auth.
- **Desligue o cadastro público no Supabase** (Authentication → Sign In / Providers → "Allow new users to sign up"). O admin já existe e a API administrativa continua criando clientes; é uma segunda camada além do trigger. Depois disso `/primeiro-acesso` deixa de funcionar (esperado).
- URLs assinadas valem 1 h: quem receber o link nesse período acessa o arquivo. É o trade-off do requisito.
- Plano gratuito do Supabase limita arquivos a 50 MB; o limite de 500 MB exige plano pago.
- `/api/notify` (decisão): idempotente por registro (`notified`), então não permite spam; (aguardando): só admin.
- Ative no Supabase: limite de tentativas de login e proteção contra senhas vazadas (Authentication → Attack Protection).
