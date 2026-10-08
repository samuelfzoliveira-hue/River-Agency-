# River Agency — Diagnóstico de Perfil Instagram

Ferramenta web para gerar um diagnóstico completo de perfis do Instagram (posicionamento,
conteúdo, engajamento, arquétipo de marca, persona, SWOT, recomendações etc.), seguindo a
metodologia própria de diagnóstico e evolução da River Agency.

Basta colar o link (ou `@usuário`) de um perfil público do Instagram e a ferramenta gera o
relatório completo, com a identidade visual da River Agency, pronto para visualizar na tela
ou exportar em PDF.

## Como funciona

1. **Coleta de dados** (`lib/instagram.ts`), em ordem de prioridade:
   - **Apify** (`APIFY_API_TOKEN`, opcional): quando configurado, busca o perfil real via o
     ator "Instagram Profile Scraper" da Apify, que usa proxies para contornar o bloqueio do
     Instagram de forma consistente. É o único método com confiabilidade garantida.
   - **API pública do Instagram** (gratuita, melhor esforço): tenta o endpoint não-oficial
     usado pelo próprio site do Instagram. Costuma ser bloqueado em servidores na nuvem.
   - **Página pública do perfil** (gratuita, parcial): se o método anterior falhar, tenta
     extrair ao menos nome/seguidores/posts do HTML público da página.
   - **Formulário manual**: se nada funcionar, pede os dados que faltaram (geralmente só bio
     e legendas, já que o Instagram não libera isso sem login de qualquer forma).
2. **Geração do diagnóstico** (`lib/claude.ts`): os dados do perfil são enviados para a API da
   Anthropic (Claude), com um prompt que replica a mesma profundidade de análise de um relatório
   de consultoria: score geral, projeção de evolução do perfil, diagnóstico de bio, análise de
   engajamento, gaps, SWOT, posicionamento de mercado, arquétipo de marca, persona/avatar,
   fórmula de sucesso, melhores horários, tendências e recomendações finais.
3. **Relatório visual** (`components/ReportView.tsx`): o diagnóstico é renderizado como um
   relatório completo, com a identidade visual da River Agency.
4. **PDF** (`lib/pdf.ts`): o relatório é exportado como um PDF nativo (texto vetorial real, não
   uma captura de tela), com quebras de página que respeitam o conteúdo — uma caixa nunca é
   cortada ao meio.

## Configuração

```bash
npm install
cp .env.example .env.local
# edite .env.local e adicione sua ANTHROPIC_API_KEY (e, se tiver, APIFY_API_TOKEN)
npm run dev
```

Sem `ANTHROPIC_API_KEY` configurada, a ferramenta funciona em **modo demonstração**, exibindo um
relatório de exemplo para que a interface possa ser avaliada sem custo de API.

Sem `APIFY_API_TOKEN`, a busca automática do perfil usa apenas os métodos gratuitos (melhor
esforço) e recorre ao formulário manual quando o Instagram bloquear.

## Limitações conhecidas

- Sem `APIFY_API_TOKEN`, a coleta automática não é garantida: o Instagram bloqueia agressivamente
  acessos automatizados, especialmente vindos de servidores na nuvem. O formulário de dados
  manuais existe para contornar essa limitação quando ela ocorrer.
- Perfis privados não podem ser analisados (nem manualmente, pois os dados não são públicos).
- A qualidade do diagnóstico depende da quantidade de dados disponíveis (principalmente
  legendas recentes); quanto mais contexto for coletado/informado, mais específico o relatório.
- O mapeamento de campos da resposta da Apify (`fetchViaApify` em `lib/instagram.ts`) foi
  escrito com base no formato usual desse tipo de ator, mas não pôde ser validado contra uma
  resposta real neste ambiente de desenvolvimento (sem acesso de rede à Apify). Teste com um
  perfil real ao configurar o token; se algum campo vier vazio, ajuste os nomes candidatos em
  `firstDefined(...)` conforme a resposta real.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS (tema River Agency)
- Anthropic SDK (Claude) para geração do diagnóstico
- Apify (opcional) para coleta confiável do perfil do Instagram
- jsPDF (geração nativa de PDF, sem captura de tela)
