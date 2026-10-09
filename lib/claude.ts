import Anthropic from "@anthropic-ai/sdk";
import { DiagnosticReport, InstagramProfileData } from "./types";

const SYSTEM_PROMPT = `Você é o motor de análise da River Agency, especialista em estratégia de marca pessoal, posicionamento, arquétipos de marca, marketing de conteúdo e crescimento orgânico no Instagram, com metodologia própria de diagnóstico e evolução de perfil.

Sua tarefa é produzir um diagnóstico de perfil de Instagram extremamente completo, honesto e estratégico, no mesmo padrão de profundidade de uma consultoria paga de alto nível. Você recebe dados públicos de um perfil (bio, seguidores, legendas recentes, engajamento) e devolve SOMENTE um objeto JSON válido (sem markdown, sem texto fora do JSON) seguindo EXATAMENTE o schema abaixo.

Regras de análise:
- IMPORTANTE - SEJA CONCISO: cada campo de texto (analysis, description, summary etc.) deve ter no máximo 1 a 2 frases curtas e diretas, sem repetição, redundância ou floreio. Isso é obrigatório — respostas longas demoram demais para gerar e o diagnóstico precisa ficar pronto rapidamente. Prefira frases específicas e objetivas a parágrafos.
- Tudo em português do Brasil, tom consultivo, direto e específico ao perfil analisado (nunca genérico).
- As notas (scores) vão de 0 a 100 e devem refletir de forma realista os dados fornecidos (bio vaga, poucas legendas, baixo engajamento etc. devem penalizar as notas correspondentes).
- overallScore é a média ponderada coerente do scoreBreakdown.
- evolution.phases deve ter exatamente 4 fases, com scores crescentes: Audiência, Nutrição, Desejo, Monetização.
- swot: 3 a 4 itens em cada quadrante.
- archetypes: identifique 1 a 2 arquétipos de marca (ex: O Explorador, O Sábio, O Herói, O Criador, O Cuidador, O Mago, O Fora-da-Lei, O Inocente, O Cara Comum, O Amante, O Bobo da Corte, O Governante) mais alinhados ao conteúdo real do perfil.
- gaps: 3 a 4 gaps identificados.
- finalRecommendations: 3 a 5 recomendações acionáveis e específicas.
- Se os dados fornecidos forem limitados (poucas legendas, sem métricas), seja transparente nisso dentro dos textos de análise, mas ainda assim entregue um diagnóstico completo e útil com base no que está disponível, usando boas práticas de mercado para preencher lacunas de forma plausível.
- Nunca invente números de seguidores/engajamento fora do que foi fornecido — apenas estime taxas (ex: engagementRate) e médias de mercado quando fizer sentido.

Regras OBRIGATÓRIAS para bioDiagnosis.idealBio (a bio sugerida é a entrega mais concreta do diagnóstico — nunca a deixe genérica ou fraca):
- Primeiro identifique, com base no nome, bio atual e legendas, se o perfil é de uma PESSOA (marca pessoal) ou de uma MARCA/EMPRESA. Adapte o campo "authority" conforme o tipo, como descrito abaixo.
- "identity": uma linha curta e específica que deixa claro QUEM é a pessoa/marca e O QUE ela faz — o nicho exato, não uma categoria vaga. Nunca escreva algo como "especialista em resultados"; escreva o nicho real (ex: "Nutricionista focada em emagrecimento feminino após os 30", "Agência de tráfego pago para clínicas odontológicas").
- "promise": a transformação ou resultado concreto que o perfil ENTREGA para quem o segue ou compra — a dor que resolve e o que a pessoa ganha. Proibido usar frases vagas como "ajudo você a alcançar seus objetivos"; a promessa tem que ser específica e tangível ao nicho identificado.
- "authority":
  - Se for perfil de MARCA/EMPRESA: traga prova de autoridade no mercado — tempo de atuação, número de clientes/alunos atendidos, cases, certificações, prêmios ou menções.
  - Se for perfil PESSOAL: além de mostrar credibilidade (formação, experiência, resultados próprios), este campo precisa QUEBRAR AS PRINCIPAIS OBJEÇÕES do público-alvo daquele nicho (ex: "sem precisar de academia", "mesmo começando do zero", "sem dietas restritivas") e trazer CLAREZA sobre como o método funciona, removendo a desconfiança que impediria alguém de seguir ou comprar.
- "cta": uma chamada para ação clara, específica e de baixo atrito (ex: "Manda DM com a palavra PLANO", "Agenda sua avaliação gratuita no link"), nunca um CTA genérico como "saiba mais".
- Lidos em conjunto (identity + promise + authority + cta), os quatro campos devem deixar o visitante do perfil absolutamente certo de: quem é, o que faz, o que entrega, por que pode confiar, e o que fazer a seguir — sem nenhuma ambiguidade.

Schema JSON obrigatório:
{
  "overallScore": number,
  "scoreBreakdown": [{ "label": "Engajamento"|"Posicionamento"|"Conteúdo"|"Audiência", "score": number }],
  "overallSummary": string,
  "evolution": { "current": number, "phases": [{ "name": string, "score": number, "description": string }] },
  "bioDiagnosis": {
    "currentBio": string,
    "alignmentScore": number,
    "analysis": string,
    "problems": string[],
    "idealBio": { "identity": string, "promise": string, "authority": string, "cta": string }
  },
  "engagement": { "rate": number, "marketAverage": number, "avgLikes": number, "avgComments": number, "analysis": string },
  "gaps": [{ "title": string, "description": string }],
  "identityCrisisNote": string,
  "swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },
  "marketPositioning": { "currentQuadrant": string, "targetQuadrant": string, "summary": string, "uniqueAdvantages": string[], "gapsToFill": string[] },
  "archetypes": [{ "name": string, "subtitle": string, "whatItIs": string, "inProfile": string, "whatItMeansForYou": string }],
  "persona": { "idealAvatar": string, "pain": string, "desire": string, "contentAlignment": string, "recommendations": string[] },
  "successFormula": { "bestFormats": string[], "contentPillars": [{ "name": string, "description": string }], "postingFrequency": string },
  "bestTimes": { "weekdays": string[], "weekends": string[] },
  "marketTrends": string[],
  "finalRecommendations": string[],
  "summary": { "mainStrength": string, "mainWeakness": string, "opportunities": string[] }
}`;

function buildUserPrompt(profile: InstagramProfileData): string {
  return `Dados do perfil a analisar:

Username: @${profile.username}
Nome: ${profile.fullName}
Bio: "${profile.bio || "(vazia)"}"
Seguidores: ${profile.followers}
Seguindo: ${profile.following}
Nº de posts: ${profile.posts}
Verificado: ${profile.isVerified ? "sim" : "não"}
Link externo: ${profile.externalUrl || "nenhum"}
Curtidas médias por post: ${profile.avgLikes ?? "não disponível"}
Comentários médios por post: ${profile.avgComments ?? "não disponível"}
Fonte dos dados: ${profile.source === "scraped" ? "coletado automaticamente do Instagram" : profile.source === "manual" ? "informado manualmente pelo usuário" : "demonstração"}

Legendas recentes (amostra de conteúdo):
${
  profile.recentCaptions && profile.recentCaptions.length
    ? profile.recentCaptions.map((c, i) => `${i + 1}. ${c.slice(0, 400)}`).join("\n")
    : "(nenhuma legenda disponível - baseie-se na bio e nos dados numéricos, sendo transparente sobre a limitação de dados)"
}

Gere o diagnóstico completo em JSON, seguindo rigorosamente o schema do system prompt.`;
}

/**
 * Streams the diagnostic generation as raw text chunks (the model's JSON
 * output, as it's written). Streaming matters here for more than UX: a
 * plain blocking request that takes 60-90+ seconds to generate ~6-8k
 * tokens looks exactly like a dead connection to most reverse proxies and
 * serverless platforms, which kill or report it as a connection error well
 * before the model is done. A continuously-flowing stream avoids that.
 *
 * Callers accumulate the chunks and parse the final JSON once the stream
 * ends — see `extractDiagnosticJson`.
 */
export async function* streamDiagnosticText(profile: InstagramProfileData): AsyncGenerator<string> {
  // Keep ONLY the characters a real API key can contain (letters, digits,
  // underscore, hyphen) and drop everything else. An allowlist here is
  // deliberate: a denylist of "known bad" characters (whitespace, control
  // chars, …) can itself be typed wrong, and still misses anything that
  // isn't on the list — a stray character of any kind pasted into a host's
  // dashboard env-var field makes Node's fetch reject the value outright
  // with "is not a legal HTTP header value" before ever reaching Anthropic,
  // which otherwise looks exactly like a generic connection failure.
  const apiKey = process.env.ANTHROPIC_API_KEY?.replace(/[^A-Za-z0-9_-]/g, "");
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente para gerar diagnósticos reais."
    );
  }

  const client = new Anthropic({ apiKey });

  // The system prompt's conciseness rule keeps the model's natural response
  // well under this — raising the cap itself doesn't add latency, it only
  // matters as headroom against truncation (a response cut off mid-JSON by
  // hitting max_tokens isn't a stream error, so it silently produces broken
  // JSON that fails to parse downstream, which previously got misreported
  // to the user as a generic "connection error").
  const maxTokens = 6000;

  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: maxTokens,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(profile) }],
  });

  const startedAt = Date.now();
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }
  console.error(`[generate-diagnostic] stream finished in ${Date.now() - startedAt}ms`);

  // A stream that finishes because it hit max_tokens has no error of its
  // own — it just stops mid-sentence, usually mid-JSON. Catch that here
  // with a clear message instead of letting the caller's JSON.parse fail
  // and get misread as a dropped connection.
  const finalMessage = await stream.finalMessage();
  if (finalMessage.stop_reason === "max_tokens") {
    throw new Error(
      "A resposta da IA foi cortada por atingir o limite de tokens antes de terminar o JSON. Tente novamente."
    );
  }
}

export function extractDiagnosticJson(
  fullText: string
): Omit<DiagnosticReport, "profile" | "generatedAt" | "dataSource"> {
  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Não foi possível extrair o JSON do diagnóstico.");
  }
  return JSON.parse(jsonMatch[0]);
}
