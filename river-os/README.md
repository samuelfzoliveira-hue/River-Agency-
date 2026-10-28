# RIVER OS

Sistema operacional interno da River Agency (Next.js 15 + TypeScript + Tailwind + Supabase).
Arquitetura, mapa de telas, modelo de dados e plano de fases: [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

## Rodar

1. Crie um projeto no Supabase e aplique, em ordem, `supabase/migrations/*.sql` (SQL Editor ou `supabase db push`).
2. `cp .env.example .env.local` e preencha `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. `npm install && npm run dev`.
4. Em `/cadastro` crie a conta; no primeiro acesso você cria a agência e vira administrador. Os demais entram por convite (Equipe → Convidar), usando o mesmo e-mail.

Recomenda-se desativar "Enable sign ups" no Supabase depois de criar o administrador: novos usuários passam a entrar só por convite.

## Testes

```bash
npm test          # motor de regras (contratos, alertas, capacidade, calendário)
npm run test:db   # migrações + RLS + triggers em um PostgreSQL temporário (precisa dos binários do Postgres)
npm run typecheck
```

## Aprovação pelo cliente

Na ficha do conteúdo: crie uma versão (legenda + links das prévias) → **Enviar para aprovação**. O link `/aprovar/<token>` é exibido uma única vez (só o hash fica no banco), expira (3–60 dias) e é revogado quando um novo link é gerado. Quem abre o link não vê nada além daquele conteúdo e informa o nome ao decidir. Pessoas do cliente também podem ter conta no portal (`/cliente`): Cliente → Portal do cliente → Liberar acesso.

## Relatórios, automações e e-mail (Fase 3)

- `/relatorios`: cumprimento por cliente/mês, produtividade e tendência por colaborador, tempo por etapa e gargalos, revisões, tarefas atrasadas. Cada tabela exporta CSV (`;` + BOM, abre direto no Excel pt-BR) e o relatório inteiro exporta PDF.
- O tempo por etapa vem de `content_status_history`, preenchido por trigger a partir da migração. Conteúdos anteriores entram marcados como "retroalimentados" e ficam fora das médias; **a previsão de prazo só ganha base histórica depois de algumas semanas de uso** (mínimo de 3 passagens por etapa; antes disso o alerta informa que usa regras operacionais).
- Automações (`run_automations`): prazo próximo, tarefa atrasada, resumo diário para gestores, aprovação lenta do cliente e fim de contrato. Rodam ao abrir telas de gestão (no máx. a cada 30 min) e pela rota `/api/cron`.
- E-mail: defina `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` e `EMAIL_FROM`; o `vercel.json` agenda `/api/cron` de hora em hora. Sem as chaves de e-mail a rota só faz "ensaio". A chave de serviço é usada exclusivamente por essa rota.

## Horas e redistribuição

Em Tarefas, ▶ inicia o cronômetro (um por pessoa; iniciar outro encerra o anterior; teto de 12 h por lançamento) e o relógio aparece no menu lateral em qualquer tela. Também é possível lançar horas manualmente (`90`, `1:30` ou `1,5h`). `tarefas.logged_hours` é sempre a soma dos lançamentos. Em Equipe, gestores arrastam tarefas entre pessoas e a ocupação é recalculada na hora.

## Upload de arquivos

A migração `20261105000000_storage.sql` cria o bucket privado `media` (JPG/PNG/WebP/GIF, MP4/MOV/WebM e PDF, até 50 MB) e as políticas: a equipe só lê/envia dentro de `<org>/<cliente>/…` da própria agência; apaga quem enviou ou um gestor. Os arquivos são exibidos por URLs assinadas (1 h para a equipe; do tamanho da validade do link para o cliente). Prévias de aprovação aceitam link **ou** arquivo. Ao apagar um conteúdo/versão os arquivos permanecem no banco de mídia/Storage (remova pelo Banco de mídia).

## Estrutura

- `lib/domain/` — regras de negócio puras (única fonte dos números exibidos).
- `lib/actions/` — Server Actions (validação com zod, escrita, revalidação).
- `supabase/migrations/` — esquema, triggers, funções e políticas RLS.
