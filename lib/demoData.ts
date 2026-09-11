import { DiagnosticReport } from "./types";

export const DEMO_REPORT: DiagnosticReport = {
  profile: {
    username: "seuperfil",
    fullName: "Perfil de Demonstração",
    followers: 2700,
    engagementRate: 3.56,
  },
  overallScore: 62,
  scoreBreakdown: [
    { label: "Engajamento", score: 80 },
    { label: "Posicionamento", score: 30 },
    { label: "Conteúdo", score: 60 },
    { label: "Audiência", score: 70 },
  ],
  overallSummary:
    "Este é um relatório de demonstração. Configure a chave da API (ANTHROPIC_API_KEY) para gerar diagnósticos reais a partir de qualquer perfil do Instagram. O exemplo abaixo ilustra a profundidade de análise que a ferramenta entrega: fundação sólida, audiência pequena mas engajada, penalizada por desalinhamento entre bio e conteúdo.",
  evolution: {
    current: 62,
    phases: [
      {
        name: "Audiência",
        score: 75,
        description:
          "Foco total no alinhamento: ajustar a bio e iniciar conteúdo viral sobre o tema central, atraindo seguidores qualificados.",
      },
      {
        name: "Nutrição",
        score: 82,
        description:
          "Com a audiência certa chegando, aprofunda-se a conexão via Stories interativos e conteúdo mais denso, construindo comunidade e autoridade.",
      },
      {
        name: "Desejo",
        score: 88,
        description:
          "O conteúdo evolui para gerar desejo por uma solução, abordando dores e sonhos do avatar e preparando o terreno para a oferta.",
      },
      {
        name: "Monetização",
        score: 95,
        description:
          "Com audiência construída, nutrida e aquecida, a conversão acontece de forma orgânica e alinhada ao propósito da marca.",
      },
    ],
  },
  bioDiagnosis: {
    currentBio: "Exemplo: CEO & Founder | Construo marcas. Prego pelo propósito.",
    alignmentScore: 45,
    analysis:
      "A bio estabelece uma promessa profissional forte, mas o conteúdo do feed não a comprova, gerando dissonância entre a expectativa criada e a entrega real.",
    problems: [
      "A promessa da bio não é comprovada no conteúdo.",
      "A bio atrai um público que se frustra ao não encontrar o conteúdo prometido.",
      "Falta uma chamada para ação (CTA) clara.",
    ],
    idealBio: {
      promise: "Ajudo você a construir [resultado desejado] com [diferencial único].",
      authority: "Credencial ou prova social relevante | Traço de personalidade autêntico.",
      cta: "Comece sua jornada aqui",
    },
  },
  engagement: {
    rate: 3.56,
    marketAverage: 3.0,
    avgLikes: 90,
    avgComments: 7,
    analysis:
      "A taxa de engajamento está acima da média de mercado para o tamanho de audiência, indicando uma comunidade pequena, porém leal e conectada ao conteúdo mais autêntico do perfil.",
  },
  gaps: [
    {
      title: "Gap de Posicionamento",
      description: "A bio vende uma coisa, o feed entrega outra.",
    },
    {
      title: "Gap de Autoridade",
      description: "Falta conteúdo que comprove a expertise anunciada na bio.",
    },
    {
      title: "Gap de Estratégia",
      description: "Conteúdo sem objetivo claro além de compartilhar momentos.",
    },
    {
      title: "Gap de Conversão",
      description: "Nenhum mecanismo para capturar leads ou direcionar tráfego.",
    },
  ],
  identityCrisisNote:
    "Os dados revelam uma possível crise de identidade de marca: o engajamento vem de quem se conecta com a pessoa física, não necessariamente com o especialista anunciado na bio. A oportunidade é construir uma ponte sólida entre os dois.",
  swot: {
    strengths: [
      "Taxa de engajamento acima da média de mercado.",
      "Autenticidade que gera forte conexão emocional.",
      "Boa qualidade visual de produção.",
    ],
    weaknesses: [
      "Incoerência entre bio profissional e conteúdo pessoal.",
      "Falta de estratégia de conteúdo definida.",
      "Ausência de conteúdo que valide a expertise anunciada.",
    ],
    opportunities: [
      "Unificar a mensagem sob um tema central claro.",
      "Criar conteúdo educacional alinhado ao posicionamento desejado.",
      "Aproveitar o engajamento alto para lançar produtos/serviços.",
    ],
    threats: [
      "Confusão de posicionamento pode estagnar o crescimento.",
      "Falta de pilar educacional impede construção de autoridade.",
      "Risco de perder conexão atual numa transição mal executada.",
    ],
  },
  marketPositioning: {
    currentQuadrant: "Marca Pessoal / Relacional",
    targetQuadrant: "Líder de Nicho",
    summary:
      "Atualmente o perfil tem alta autenticidade mas baixa oferta de conteúdo prático. O objetivo é manter a autenticidade e somar valor estratégico.",
    uniqueAdvantages: [
      "Comunicação genuína e não impositiva.",
      "Estética visual diferenciada.",
      "Experiência real que pode gerar credibilidade.",
    ],
    gapsToFill: [
      "Conteúdo que resolva problemas específicos do avatar.",
      "Consistência em uma linha editorial clara.",
      "Estratégias mais ativas de construção de comunidade.",
    ],
  },
  archetypes: [
    {
      name: "O Explorador",
      subtitle: "O Aventureiro",
      whatItIs:
        "Valoriza liberdade, descoberta e autenticidade; busca o novo e o próprio caminho.",
      inProfile: "Conteúdo de jornada, bastidores e o convite a sair da rotina.",
      whatItMeansForYou:
        "Sua marca fala de liberdade e descoberta — atrai quem quer construir o próprio caminho.",
    },
    {
      name: "O Sábio",
      subtitle: "Especialista, Autoridade, Mentor",
      whatItIs: "Busca a verdade e o conhecimento; vende clareza e profundidade.",
      inProfile: "Conteúdo que explica, comprova com dados e mostra domínio do assunto.",
      whatItMeansForYou:
        "Posicionamento valioso para vender alto ticket, pois a confiança vem do domínio demonstrado.",
    },
  ],
  persona: {
    idealAvatar:
      "Jovem adulto (22-35 anos) que aspira empreender ou já deu os primeiros passos, em busca de referência de sucesso alinhada aos seus valores.",
    pain: "Medo de comprometer princípios pessoais para crescer profissionalmente.",
    desire: "Encontrar um modelo de sucesso que prove ser possível crescer sem perder a essência.",
    contentAlignment:
      "O conteúdo atual gera identificação, mas ainda não oferece um caminho claro de transformação.",
    recommendations: [
      "Crie conteúdo sobre os bastidores de decisões alinhadas aos seus valores.",
      "Compartilhe estudos de caso e aprendizados reais.",
      "Use enquetes e caixas de perguntas para aprofundar a conexão com a comunidade.",
    ],
  },
  successFormula: {
    bestFormats: [
      "Reels curtos com reflexões usando áudios em alta.",
      "Carrosséis que contam uma história ou ensinam um passo a passo.",
      "Stories diários com enquetes e caixas de perguntas.",
    ],
    contentPillars: [
      { name: "Pilar 1", description: "Conteúdo que mostra valores guiando decisões." },
      { name: "Pilar 2", description: "Bastidores e jornada, validando autoridade." },
      { name: "Pilar 3", description: "Reflexões e insights sob a ótica do propósito." },
    ],
    postingFrequency:
      "3 a 4 Reels por semana para atração, 2 carrosséis para aprofundamento, Stories diários para nutrição.",
  },
  bestTimes: {
    weekdays: ["12:00 - 14:00", "19:00 - 21:00"],
    weekends: ["10:00 - 12:00", "20:00 - 22:00"],
  },
  marketTrends: [
    "Conteúdo de bastidores que humaniza a jornada.",
    "Storytelling em Reels contando superação em menos de 60 segundos.",
    "Legendas curtas e diretas, com a informação principal no próprio vídeo.",
  ],
  finalRecommendations: [
    "Crie um Reel semanal mostrando um desafio real e como você o superou.",
    "Desenvolva carrosséis com ganchos fortes no primeiro slide.",
    "Faça parcerias orgânicas com outros criadores do seu nicho.",
  ],
  summary: {
    mainStrength:
      "Capacidade de criar conexão autêntica e emocional através de conteúdo visualmente atraente.",
    mainWeakness:
      "Desconexão estratégica entre a promessa da bio e a entrega real de conteúdo do feed.",
    opportunities: [
      "Capitalizar a confiança já existente para se tornar referência no nicho.",
      "Desenvolver uma linha editorial clara que converta seguidores em clientes.",
    ],
  },
  generatedAt: new Date().toISOString(),
  dataSource: "demo",
};
