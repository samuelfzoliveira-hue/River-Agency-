import Anthropic from "@anthropic-ai/sdk";
import { DiagnosticReport, InstagramProfileData } from "./types";

const SYSTEM_PROMPT = `Você é o motor de análise da River Agency, especialista em estratégia de marca pessoal, posicionamento, arquétipos de marca, marketing de conteúdo e crescimento orgânico no Instagram (metodologia PMM - Perfil, Mensagem, Monetização).

Sua tarefa é produzir um diagnóstico de perfil de Instagram extremamente completo, honesto e estratégico, no mesmo padrão de profundidade de uma consultoria paga de alto nível. Você recebe dados públicos de um perfil (bio, seguidores, legendas recentes, engajamento) e devolve SOMENTE um objeto JSON válido (sem markdown, sem texto fora do JSON) seguindo EXATAMENTE o schema abaixo.

Regras de análise:
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
    "idealBio": { "promise": string, "authority": string, "cta": string }
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

export async function generateDiagnostic(
  profile: InstagramProfileData
): Promise<Omit<
  DiagnosticReport,
  "profile" | "generatedAt" | "dataSource"
>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Configure a variável de ambiente para gerar diagnósticos reais."
    );
  }

  const client = new Anthropic({ apiKey });

  const message = await client.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(profile) }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Resposta inesperada do modelo.");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Não foi possível extrair o JSON do diagnóstico.");
  }

  return JSON.parse(jsonMatch[0]);
}
