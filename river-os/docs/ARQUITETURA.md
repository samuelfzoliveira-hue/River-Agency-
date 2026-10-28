# RIVER OS — Arquitetura e plano de implementação

> Documento de projeto que antecede o código. Descreve o que existe na Fase 1 (implementada)
> e o que fica para as Fases 2 e 3, marcando cada item com seu estado real.

Legenda: ✅ implementado e testado · 🟡 implementado parcialmente · ⏳ planejado (schema já preparado quando indicado)

---

## 1. Arquitetura do sistema

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  Next.js (App Router) — React Server Components + Client islands  │
│  Tailwind (tokens CSS claro/escuro) · dnd-kit (Kanban)            │
└───────────────┬───────────────────────────────────────────────────┘
                │ cookies de sessão (Supabase SSR)
┌───────────────▼───────────────────────────────────────────────────┐
│  Next.js server                                                   │
│  middleware.ts      → renova sessão, protege rotas                │
│  app/(app)/**       → páginas (RSC) que leem via Supabase + RLS   │
│  app/actions/**     → Server Actions (zod → escrita → log → revalida) │
│  lib/domain/**      → MOTOR PURO (sem I/O): contratos, alertas,   │
│                       capacidade, calendário. 100% testado.       │
└───────────────┬───────────────────────────────────────────────────┘
                │ PostgREST / RPC com o JWT do usuário
┌───────────────▼───────────────────────────────────────────────────┐
│  Supabase                                                         │
│  Auth · PostgreSQL (RLS por organização e papel) · Storage        │
│  Triggers: stage da entrega, histórico, notificações              │
│  Funções SECURITY DEFINER: bootstrap, convite, metas mensais      │
└───────────────────────────────────────────────────────────────────┘
```

**Decisões-chave**

| Decisão | Motivo |
|---|---|
| **Uma única fonte de verdade.** Dashboard, Central de Operações, cliente, calendário e equipe leem as mesmas tabelas e passam pelo mesmo motor (`lib/domain`). | Requisito "sem dashboards desconectados nem números fictícios". |
| **Motor de regras em TypeScript puro**, alimentado por linhas do banco. | Testável sem banco; regras de contagem não ficam espalhadas em telas. |
| **Segurança no banco (RLS)**, não só na interface. | Um cliente nunca consegue ler dados de outro, mesmo chamando a API direto. |
| **Multi-organização** (`org_id` em toda tabela de negócio). | A River Agency é a primeira organização; o modelo não a hardcoda. |
| **Valor do contrato em tabela separada** (`client_financials`) com RLS própria. | Segurança por coluna sem depender da interface: só admin/gestor leem. |
| **Fechamento e mudança de contrato nunca reescrevem o passado.** Metas são gravadas **por competência** (`monthly_targets`). | Histórico preservado; meses com quantidades diferentes. |
| **`stage` numérico no status do pipeline** (0 produção · 1 produzido · 2 aprovado · 3 agendado · 4 publicado). | Permite status configuráveis e, ainda assim, contagem determinística por critério de conclusão. |

Stack: Next.js 15 + TypeScript, Tailwind 3 (componentes próprios no estilo shadcn, sem dependência de CLI), Supabase (`@supabase/ssr`), zod, dnd-kit, vitest.

---

## 2. Mapa das telas

| Rota | Tela | Papéis | Fase | Estado |
|---|---|---|---|---|
| `/login`, `/cadastro` | Entrar · criar agência · aceitar convite | público | 1 | ✅ |
| `/` | **Visão geral** (KPIs clicáveis, alertas, tarefas, produtividade) | equipe | 1 | ✅ |
| `/operacoes` | **Central de Operações** (8 perguntas do gestor) | admin, gestor | 1 | ✅ |
| `/clientes` | Lista de clientes + cumprimento do mês | equipe | 1 | ✅ |
| `/clientes/[id]` | Ficha do cliente: contrato, metas do mês, conteúdos, captações, histórico | equipe | 1 | ✅ |
| `/pipeline` | Kanban de 12 etapas, filtros, arrastar e soltar | equipe | 1 | ✅ |
| `/conteudos/[id]` | Ficha do conteúdo: briefing, roteiro, checklist, comentários, histórico | equipe | 1 | ✅ |
| `/tarefas` | Tarefas (internas ≠ entregas), filtros, criação | equipe | 1 | ✅ |
| `/meu-painel` | Painel pessoal | equipe | 1 | ✅ |
| `/calendario` | Mês · semana · dia, filtros, cores por tipo de data | equipe | 1 | ✅ |
| `/captacoes` | Sessões de gravação + conteúdos gravados/pendentes | equipe | 1 (mínimo) | 🟡 |
| `/equipe` | Capacidade (disponível/atenção/sobrecarregado), redistribuição, indisponibilidades, convites | admin, gestor | 1 | 🟡 |
| `/notificacoes` | Caixa de notificações | equipe | 1 | ✅ |
| `/configuracoes` | Etapas do pipeline, tipos de entrega | admin | 1 | 🟡 |
| `/fechamento` | Fechamento mensal, pendências, reabertura com justificativa, PDF | admin, gestor | 2 | ✅ |
| `/midia` | Banco de mídia por cliente/campanha/tipo/data (links; Drive direto fica para depois) | equipe | 2 | 🟡 |
| `/aprovar/[token]` | Link seguro de aprovação do cliente (sem login) | externo | 2 | ✅ |
| `/cliente`, `/cliente/[id]` | Portal do cliente: lista e aprovação dos próprios conteúdos | cliente | 2 | ✅ |
| `/relatorios` | Relatórios (8 seções) com filtros de período/cliente/equipe, CSV por seção e PDF | admin, gestor | 3 | ✅ |

## 3. Modelo de banco de dados

Arquivo: `supabase/migrations/*.sql`. Resumo:

```
organizations ─┬─ profiles (user_id → auth.users, role, cargo, especialidade, horas/semana)
               ├─ invites
               ├─ deliverable_types (reel, post, carrossel, story, captação…; kind = content|shoot)
               ├─ pipeline_statuses (nome, posição, stage 0‑4, por tipo ou padrão)
               ├─ clients ─┬─ client_financials (valor mensal — restrito)
               │           ├─ client_users (acesso do papel "cliente")
               │           ├─ contracts ─┬─ contract_items (pacote padrão: tipo, qtd, periodicidade)
               │           │             └─ monthly_targets (meta por competência × tipo)
               │           ├─ contents  (competência, tipo, status, is_extra, cancelado…)
               │           ├─ shoots (captações) ─ shoot_members · shoot_contents
               │           └─ events (reuniões, campanhas, prazos)
               ├─ tasks (+ task_supporters) — podem ou não apontar para um conteúdo
               ├─ comments (menções) · activity_log · notifications
               ├─ member_unavailability (férias/folgas)
               ├─ alert_settings (limites por cliente/tipo)
               └─ (Fase 2: month_closings, content_versions, approval_links)
```

Regras codificadas no banco:

* `contents.delivery_stage` é mantido por **trigger** a partir do status → a contagem é uma consulta simples e consistente.
* `contents.published_late` é gravado no momento da publicação e **nunca** apagado.
* Um conteúdo é **uma linha**; tarefas apontam para ele. Logo, "um Reel com 5 tarefas conta 1 Reel".
* `monthly_targets` tem `unique (contract_id, competence, deliverable_type_id)`; `ensure_monthly_targets()` é idempotente e **não sobrescreve** metas já existentes.
* Conteúdos cancelados (`cancelled_at`) e extras (`is_extra`) são excluídos/separados da contagem contratada.
* `activity_log` é preenchido por trigger nas tabelas relevantes (quem, quando, o quê mudou).

## 4. Relação cliente → contrato → entrega → tarefa

```
Cliente 1──n Contrato 1──n Item do pacote (ex.: 8 Reels / mês)
                │
                └─ n Meta mensal (competência 2026‑10, tipo Reel, qtd 8, critério)
                          ▲
Conteúdo (Reel "Lançamento") ── competência 2026‑10, tipo Reel, cliente, contrato
        │   status → delivery_stage ≥ critério?  →  conta 1 entrega
        └─ n Tarefas (roteiro, captação, edição, revisão) → NÃO contam como entrega
Captação (sessão) ── competência, cliente → conta como "captação realizada" quando status = realizada
```

Contagem do progresso de um tipo em uma competência:

```
contratado = meta mensal do tipo
entregue   = conteúdos do cliente/competência/tipo, não cancelados, não extras, com delivery_stage ≥ critério
produzido / aprovado / publicado = idem com stage ≥ 1 / 2 / 4
atrasado   = não entregue e (prazo interno ou publicação prevista < hoje)
extras     = conteúdos is_extra (mostrados à parte)
pct        = min(entregue, contratado) / contratado ; geral = Σ min / Σ contratado
```

## 5. Fluxo de navegação

```
Login → (sem perfil?) Cadastro: criar agência ─┐
                                               ▼
        admin/gestor → Central de Operações ─► Cliente ─► Conteúdo ─► Tarefa
        demais papéis → Meu painel                 ▲          ▲
Dashboard (KPI clicável) ──────────────────────────┘          │
Pipeline (arrastar) ──────────────────────────────────────────┘
Calendário (clicar no evento) ────────────────────────────────┘
```

Todo indicador é um link com filtros na URL (`/pipeline?cliente=…&status=atrasado`), então a
origem de cada número é sempre auditável.

## 6. Plano de implementação

**Fase 1 — MVP operacional (esta entrega)**
1. Esquema + RLS + triggers + testes SQL em Postgres real. ✅
2. Motor de domínio (competência, contratos, alertas, capacidade) + testes unitários. ✅
3. Auth, onboarding, convites, layout responsivo claro/escuro. ✅
4. Clientes, contratos, metas mensais, painel de cumprimento. ✅
5. Pipeline Kanban, ficha do conteúdo, tarefas, comentários, histórico. ✅
6. Calendário, Visão geral, **Central de Operações**, alertas básicos, carga de trabalho inicial, captações mínimas. ✅/🟡

**Fase 2 — Produção e colaboração (entregue, exceto o que está marcado como pendente)**: ✅ aprovação com versões, link seguro (token de 256 bits, só o hash é guardado, expira e é revogado a cada novo envio) e portal; ✅ fechamento mensal com PDF; ✅ banco de mídia por links; ✅ checklists de captação; ✅ controle de horas (cronômetro + lançamento manual) e ✅ redistribuição de tarefas por arrastar (entregues depois); ⏳ upload direto de arquivos (Storage). Planejado originalmente: aprovação com link seguro e versões, banco de mídia/Storage, captações completas (checklists), menções com notificação por e‑mail, **Fechamento mensal** (`month_closings`), redistribuição visual por arrastar, controle de horas.

**Fase 3 — Inteligência operacional (entregue)**: ✅ histórico de etapas por trigger (`content_status_history`) → tempo por etapa, gargalos, revisões e tempo médio de produção; ✅ relatórios com CSV/PDF; ✅ previsão de prazo por conteúdo (permanência média histórica por tipo e etapa, com a base declarada no alerta); ✅ automações com notificações idempotentes e rota de cron para e-mail (Resend); 🟡 Google Drive: reconhecimento de links, miniaturas e player embutido — sem OAuth/listagem de pastas. Planejado originalmente: relatórios com PDF/CSV, alertas preventivos com histórico de duração das etapas, análise histórica de produtividade, integração Google Drive e e‑mail.

## 7. Limites honestos da Fase 1

* A previsão de risco usa **regras operacionais** (dias úteis restantes × entregas pendentes × capacidade) e é rotulada como estimativa — não há histórico suficiente para modelo estatístico.
* A capacidade usa **horas estimadas** das tarefas; as horas registradas (cronômetro/lançamento) aparecem ao lado e nos relatórios, mas não substituem a estimativa.
* Notificações são internas; a tabela guarda `email_sent_at` para a futura integração por e‑mail.
* Feriados não são considerados no cálculo de dias úteis (apenas fins de semana).
