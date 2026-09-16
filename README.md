# River Agency

## Central de Aprovação de Conteúdo (`/`)

Página principal do site: a agência publica conteúdo (posts de feed, carrosséis, stories e
reels) e envia para os clientes aprovarem, com prévia fiel ao formato real do Instagram — feed
com carrossel arrastável, stories em tela cheia com barra de progresso, e reels em vídeo.

- **Acesso da agência**: clique em "Modo Agência" e informe a senha definida em
  `APROVACAO_ADMIN_PASSWORD` (padrão `rioadmin` se a variável não estiver configurada — troque
  em produção). Com a sessão de agência ativa, é possível publicar novo conteúdo, remover itens
  e enviar links por cliente.
- **Link por cliente**: acrescente `?cliente=Nome+do+Cliente` à URL (ex.:
  `seusite.com/?cliente=Loja+Aurora`) para enviar ao cliente uma visão já filtrada apenas com o
  conteúdo dele.
- **Aprovação do cliente**: não exige login — o cliente abre o link, visualiza cada peça (com
  legenda) e clica em "Aprovar" ou "Pedir ajustes" (com campo de observação).
- **Armazenamento**: os itens ficam em `<APROVACAO_STORAGE_DIR>/data/aprovacao.json` e os
  arquivos de mídia em `<APROVACAO_STORAGE_DIR>/uploads/aprovacao/` (servidos pela rota
  `/api/aprovacao/media/[arquivo]`), fora do controle de versão — dados de runtime. Sem
  `APROVACAO_STORAGE_DIR` definida, usa uma pasta dentro do próprio projeto (bom para uso local).
  Em produção, isso requer um servidor Node com **disco persistente** entre deploys/reinícios
  (não funciona em hospedagens serverless, como a Vercel, que descartam o filesystem local a
  cada requisição).

### Deploy no Render

O repositório já inclui um `render.yaml` pronto: cria um Web Service Node com disco persistente
de 1GB montado em `/var/data` e já aponta `APROVACAO_STORAGE_DIR` para lá. Se a tela do seu
Render não mostrar a opção "Blueprint", crie manualmente em **New → Web Service** usando:

- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm run start`
- **Instance Type**: um plano pago (Starter ou superior — o free tier não tem disco persistente)
- **Environment Variables**: `APROVACAO_ADMIN_PASSWORD` (sua senha) e `APROVACAO_STORAGE_DIR=/var/data`
- **Disk**: mount path `/var/data`, tamanho 1GB

Após o deploy, a Central de Aprovação fica direto em `https://<seu-serviço>.onrender.com/` — não
precisa de nenhum caminho extra no fim do link.

## Diagnóstico de Perfil Instagram (`/diagnostico`)

Ferramenta separada para gerar um diagnóstico completo de perfis do Instagram (posicionamento,
conteúdo, engajamento, arquétipo de marca, persona, SWOT, recomendações etc.), seguindo a
metodologia própria de diagnóstico e evolução da River Agency.

Basta colar o link (ou `@usuário`) de um perfil público do Instagram e a ferramenta gera o
relatório completo, com a identidade visual da River Agency (branco + azul), pronto para
visualizar na tela ou exportar em PDF.

### Como funciona

1. **Coleta de dados** (`lib/instagram.ts`): a ferramenta tenta buscar dados públicos do perfil
   (bio, seguidores, legendas recentes) diretamente da API pública do Instagram. Como o
   Instagram bloqueia agressivamente acessos automatizados — especialmente vindos de servidores
   na nuvem —, essa coleta pode falhar. Quando isso acontece, a ferramenta pede que os dados
   sejam colados manualmente (bio, seguidores, legendas), garantindo que o diagnóstico sempre
   possa ser gerado.
2. **Geração do diagnóstico** (`lib/claude.ts`): os dados do perfil são enviados para a API da
   Anthropic (Claude), com um prompt que replica a mesma profundidade de análise de um relatório
   de consultoria: score geral, projeção de evolução do perfil, diagnóstico de bio, análise de
   engajamento, gaps, SWOT, posicionamento de mercado, arquétipo de marca, persona/avatar,
   fórmula de sucesso, melhores horários, tendências e recomendações finais.
3. **Relatório visual** (`components/ReportView.tsx`): o diagnóstico é renderizado como um
   relatório completo, com a identidade visual branco + azul da River Agency, e pode ser
   exportado em PDF com um clique.

Sem `ANTHROPIC_API_KEY` configurada, a ferramenta funciona em **modo demonstração**, exibindo um
relatório de exemplo para que a interface possa ser avaliada sem custo de API.

### Limitações conhecidas

- O Instagram não oferece uma API pública oficial para leitura de perfis de terceiros sem
  autenticação de app aprovado (Instagram Graph API exige que o dono do perfil conecte a conta).
  A coleta automática aqui usa o endpoint público não-oficial usado pelo próprio site do
  Instagram e **pode ser bloqueada** a qualquer momento, especialmente em ambientes de servidor
  na nuvem. O formulário de dados manuais existe justamente para contornar essa limitação.
- Perfis privados não podem ser analisados (nem manualmente, pois os dados não são públicos).
- A qualidade do diagnóstico depende da quantidade de dados disponíveis (principalmente
  legendas recentes); quanto mais contexto for coletado/informado, mais específico o relatório.

## Configuração local

```bash
npm install
cp .env.example .env.local
# edite .env.local conforme necessário (veja .env.example)
npm run dev
```

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (tema River Agency: branco + azul)
- Anthropic SDK (Claude) para geração do diagnóstico
- html2canvas + jsPDF para exportação em PDF
