# River Agency — Diagnóstico de Perfil Instagram

Ferramenta web para gerar um diagnóstico completo de perfis do Instagram (posicionamento,
conteúdo, engajamento, arquétipo de marca, persona, SWOT, recomendações etc.), seguindo a
metodologia própria de diagnóstico e evolução da River Agency.

Basta colar o link (ou `@usuário`) de um perfil público do Instagram e a ferramenta gera o
relatório completo, com a identidade visual da River Agency (branco + azul), pronto para
visualizar na tela ou exportar em PDF.

## Como funciona

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

## Configuração

```bash
npm install
cp .env.example .env.local
# edite .env.local e adicione sua ANTHROPIC_API_KEY
npm run dev
```

Sem `ANTHROPIC_API_KEY` configurada, a ferramenta funciona em **modo demonstração**, exibindo um
relatório de exemplo para que a interface possa ser avaliada sem custo de API.

## Limitações conhecidas

- O Instagram não oferece uma API pública oficial para leitura de perfis de terceiros sem
  autenticação de app aprovado (Instagram Graph API exige que o dono do perfil conecte a conta).
  A coleta automática aqui usa o endpoint público não-oficial usado pelo próprio site do
  Instagram e **pode ser bloqueada** a qualquer momento, especialmente em ambientes de servidor
  na nuvem. O formulário de dados manuais existe justamente para contornar essa limitação.
- Perfis privados não podem ser analisados (nem manualmente, pois os dados não são públicos).
- A qualidade do diagnóstico depende da quantidade de dados disponíveis (principalmente
  legendas recentes); quanto mais contexto for coletado/informado, mais específico o relatório.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (tema River Agency: branco + azul)
- Anthropic SDK (Claude) para geração do diagnóstico
- html2canvas + jsPDF para exportação em PDF
