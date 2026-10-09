import Anthropic from "@anthropic-ai/sdk";
import { InstagramProfileData } from "./types";

const ROLE_INTRO = `Você é o motor de análise da River Agency, especialista em estratégia de marca pessoal, posicionamento, arquétipos de marca, marketing de conteúdo e crescimento orgânico no Instagram, com metodologia própria de diagnóstico e evolução de perfil.`;

const SHARED_RULES = `Regras de análise:
- Profundidade: cada campo analítico (analysis, description, summary etc.) deve ter de 2 a 4 frases, com explicações robustas e específicas ao perfil — no padrão de um relatório de consultoria paga, não respostas de 1 linha genéricas. Seja direto e evite redundância, mas não sacrifique profundidade por brevidade.
- Tudo em português do Brasil, tom consultivo, direto e específico ao perfil analisado (nunca genérico).
- Se os dados fornecidos forem limitados (poucas legendas, sem métricas), seja transparente nisso dentro dos textos de análise, mas ainda assim entregue uma análise completa e útil com base no que está disponível, usando boas práticas de mercado para preencher lacunas de forma plausível.
- Nunca invente números de seguidores/engajamento fora do que foi fornecido — apenas estime taxas (ex: engagementRate) e médias de mercado quando fizer sentido.
- Todo array de itens (strings ou objetos) deve ter exatamente 3 itens, a menos que uma regra abaixo diga um número diferente — profundidade está na qualidade de cada item, não na quantidade de itens.
- Chame a ferramenta fornecida com os dados preenchidos — não responda em texto.
- CRÍTICO: preencha os campos exatamente no nível raiz (top-level) do schema da ferramenta. NUNCA agrupe os campos dentro de uma chave adicional/wrapper (ex: nunca crie uma chave como "scores" ou "positioning" envolvendo os campos) — os nomes de campo do schema já são as chaves finais. NUNCA transforme um campo do tipo objeto ou array em uma string JSON escapada — preencha-o como um objeto/array estruturado de verdade, nunca como texto.`;

const PART_CONTEXT = (which: string) =>
  `Sua tarefa é produzir APENAS ${which} de um diagnóstico de perfil de Instagram extremamente completo e honesto. As outras partes são geradas por chamadas separadas e rodam em paralelo com esta — não se preocupe com elas, mas mantenha o mesmo padrão de profundidade e tom consultivo em alto nível, como se fosse uma única consultoria.`;

const IDEAL_BIO_RULES = `Regras OBRIGATÓRIAS para idealBioIdentity / idealBioPromise / idealBioAuthority / idealBioCta (a bio sugerida é a entrega mais concreta do diagnóstico — nunca a deixe genérica ou fraca):
- Primeiro identifique, com base no nome, bio atual e legendas, se o perfil é de uma PESSOA (marca pessoal) ou de uma MARCA/EMPRESA. Adapte o campo idealBioAuthority conforme o tipo, como descrito abaixo.
- idealBioIdentity: uma linha curta e específica que deixa claro QUEM é a pessoa/marca e O QUE ela faz — o nicho exato, não uma categoria vaga. Nunca escreva algo como "especialista em resultados"; escreva o nicho real (ex: "Nutricionista focada em emagrecimento feminino após os 30", "Agência de tráfego pago para clínicas odontológicas").
- idealBioPromise: a transformação ou resultado concreto que o perfil ENTREGA para quem o segue ou compra — a dor que resolve e o que a pessoa ganha. Proibido usar frases vagas como "ajudo você a alcançar seus objetivos"; a promessa tem que ser específica e tangível ao nicho identificado.
- idealBioAuthority: se for MARCA/EMPRESA, traga prova de autoridade no mercado (tempo de atuação, nº de clientes/alunos, cases, certificações, prêmios). Se for perfil PESSOAL, além de credibilidade (formação, experiência, resultados próprios), este campo precisa QUEBRAR AS PRINCIPAIS OBJEÇÕES do público-alvo daquele nicho (ex: "sem precisar de academia", "mesmo começando do zero") e trazer CLAREZA sobre como o método funciona.
- idealBioCta: uma chamada para ação clara, específica e de baixo atrito (ex: "Manda DM com a palavra PLANO"), nunca um CTA genérico como "saiba mais".
- Lidos em conjunto, os quatro campos devem deixar o visitante absolutamente certo de: quem é, o que faz, o que entrega, por que pode confiar, e o que fazer a seguir.`;

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

Gere a sua parte do diagnóstico chamando a ferramenta fornecida.`;
}

function getApiKey(): string {
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
  return apiKey;
}

const STR = { type: "string" as const };
const NUM = { type: "number" as const };
const STR_ARRAY = (n: number) => ({ type: "array" as const, items: STR, minItems: n, maxItems: n });

// Split into four independent tool-use calls, run in parallel, instead of
// one single call producing the whole schema: a full-depth response for
// the entire report naturally takes 70-90+ seconds to generate (measured),
// well past Vercel Hobby's hard 60s function-duration limit (which can't
// be raised by config). Three parts still left one bucket's natural
// variance occasionally over 60s; four smaller, evenly-sized parts running
// concurrently gives each one comfortable headroom while preserving full
// per-field depth. Results are merged client-side (top-level keys are
// disjoint across the four — see app/page.tsx).
//
// Each part is requested via forced tool-use (tool_choice) rather than
// asking the model to write raw JSON in text: the API itself guarantees
// well-formed JSON encoding for tool-call input (quotes inside string
// values are escaped correctly by construction), which previously was an
// intermittent failure mode when the model wrote JSON as plain text and
// occasionally left a quote unescaped.
const PARTS_CONFIG = {
  scores: {
    context: "a parte de SCORE, EVOLUÇÃO e ENGAJAMENTO",
    extraRules: `- As notas (scores) vão de 0 a 100 e devem refletir de forma realista os dados fornecidos.
- overallScore é a média ponderada coerente do scoreBreakdown.
- evolution.phases deve ter exatamente 4 fases, com scores crescentes: Audiência, Nutrição, Desejo, Monetização.`,
    schema: {
      type: "object" as const,
      properties: {
        overallScore: NUM,
        scoreBreakdown: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: { label: { type: "string" as const, enum: ["Engajamento", "Posicionamento", "Conteúdo", "Audiência"] }, score: NUM },
            required: ["label", "score"],
          },
          minItems: 4,
          maxItems: 4,
        },
        overallSummary: STR,
        evolution: {
          type: "object" as const,
          properties: {
            current: NUM,
            phases: {
              type: "array" as const,
              items: {
                type: "object" as const,
                properties: { name: STR, score: NUM, description: STR },
                required: ["name", "score", "description"],
              },
              minItems: 4,
              maxItems: 4,
            },
          },
          required: ["current", "phases"],
        },
        engagement: {
          type: "object" as const,
          properties: { rate: NUM, marketAverage: NUM, avgLikes: NUM, avgComments: NUM, analysis: STR },
          required: ["rate", "marketAverage", "avgLikes", "avgComments", "analysis"],
        },
        identityCrisisNote: STR,
      },
      required: ["overallScore", "scoreBreakdown", "overallSummary", "evolution", "engagement", "identityCrisisNote"],
    },
  },
  bio: {
    context: "a parte de DIAGNÓSTICO DE BIO (bio atual, problemas e bio ideal)",
    extraRules: IDEAL_BIO_RULES,
    schema: {
      type: "object" as const,
      properties: {
        bioDiagnosis: {
          type: "object" as const,
          properties: {
            currentBio: STR,
            alignmentScore: NUM,
            analysis: STR,
            problems: STR_ARRAY(3),
            idealBioIdentity: STR,
            idealBioPromise: STR,
            idealBioAuthority: STR,
            idealBioCta: STR,
          },
          required: [
            "currentBio",
            "alignmentScore",
            "analysis",
            "problems",
            "idealBioIdentity",
            "idealBioPromise",
            "idealBioAuthority",
            "idealBioCta",
          ],
        },
      },
      required: ["bioDiagnosis"],
    },
  },
  gapsSwot: {
    context: "a parte de GAPS IDENTIFICADOS e ANÁLISE SWOT",
    extraRules: "",
    schema: {
      type: "object" as const,
      properties: {
        gaps: {
          type: "array" as const,
          items: { type: "object" as const, properties: { title: STR, description: STR }, required: ["title", "description"] },
          minItems: 3,
          maxItems: 3,
        },
        swot: {
          type: "object" as const,
          properties: { strengths: STR_ARRAY(3), weaknesses: STR_ARRAY(3), opportunities: STR_ARRAY(3), threats: STR_ARRAY(3) },
          required: ["strengths", "weaknesses", "opportunities", "threats"],
        },
      },
      required: ["gaps", "swot"],
    },
  },
  positioning: {
    context: "a parte de POSICIONAMENTO DE MERCADO, ARQUÉTIPO e PERSONA",
    extraRules: `- archetypes: identifique exatamente 1 arquétipo de marca (ex: O Explorador, O Sábio, O Herói, O Criador, O Cuidador, O Mago, O Fora-da-Lei, O Inocente, O Cara Comum, O Amante, O Bobo da Corte, O Governante) — o mais alinhado ao conteúdo real do perfil.`,
    schema: {
      type: "object" as const,
      properties: {
        marketPositioning: {
          type: "object" as const,
          properties: { currentQuadrant: STR, targetQuadrant: STR, summary: STR, uniqueAdvantages: STR_ARRAY(3), gapsToFill: STR_ARRAY(3) },
          required: ["currentQuadrant", "targetQuadrant", "summary", "uniqueAdvantages", "gapsToFill"],
        },
        archetypes: {
          type: "array" as const,
          items: {
            type: "object" as const,
            properties: { name: STR, subtitle: STR, whatItIs: STR, inProfile: STR, whatItMeansForYou: STR },
            required: ["name", "subtitle", "whatItIs", "inProfile", "whatItMeansForYou"],
          },
          minItems: 1,
          maxItems: 1,
        },
        persona: {
          type: "object" as const,
          properties: { idealAvatar: STR, pain: STR, desire: STR, contentAlignment: STR, recommendations: STR_ARRAY(3) },
          required: ["idealAvatar", "pain", "desire", "contentAlignment", "recommendations"],
        },
      },
      required: ["marketPositioning", "archetypes", "persona"],
    },
  },
  tactics: {
    context: "a parte de FÓRMULA DE SUCESSO, HORÁRIOS, TENDÊNCIAS, RECOMENDAÇÕES e RESUMO",
    extraRules: "",
    schema: {
      type: "object" as const,
      properties: {
        successFormula: {
          type: "object" as const,
          properties: {
            bestFormats: STR_ARRAY(3),
            contentPillars: {
              type: "array" as const,
              items: { type: "object" as const, properties: { name: STR, description: STR }, required: ["name", "description"] },
              minItems: 3,
              maxItems: 3,
            },
            postingFrequency: STR,
          },
          required: ["bestFormats", "contentPillars", "postingFrequency"],
        },
        bestTimes: {
          type: "object" as const,
          properties: { weekdays: STR_ARRAY(3), weekends: STR_ARRAY(3) },
          required: ["weekdays", "weekends"],
        },
        marketTrends: STR_ARRAY(3),
        finalRecommendations: STR_ARRAY(3),
        summary: {
          type: "object" as const,
          properties: { mainStrength: STR, mainWeakness: STR, opportunities: STR_ARRAY(3) },
          required: ["mainStrength", "mainWeakness", "opportunities"],
        },
      },
      required: ["successFormula", "bestTimes", "marketTrends", "finalRecommendations", "summary"],
    },
  },
};

type PartLabel = keyof typeof PARTS_CONFIG;

function buildSystemPrompt(label: PartLabel): string {
  const cfg = PARTS_CONFIG[label];
  return [ROLE_INTRO, "", PART_CONTEXT(cfg.context), "", SHARED_RULES, cfg.extraRules].filter(Boolean).join("\n");
}

async function runToolCall(profile: InstagramProfileData, label: PartLabel): Promise<string> {
  const client = new Anthropic({ apiKey: getApiKey() });
  const cfg = PARTS_CONFIG[label];
  const toolName = `submit_${label}`;

  const stream = client.messages.stream({
    model: "claude-sonnet-5",
    max_tokens: 5000,
    system: buildSystemPrompt(label),
    messages: [{ role: "user", content: buildUserPrompt(profile) }],
    tools: [{ name: toolName, description: `Envia a parte "${label}" do diagnóstico.`, input_schema: cfg.schema as any }],
    tool_choice: { type: "tool", name: toolName },
  });

  const startedAt = Date.now();
  let raw = "";
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "input_json_delta") {
      raw += event.delta.partial_json;
    }
  }
  console.error(`[generate-diagnostic] "${label}" part finished in ${Date.now() - startedAt}ms`);

  // A stream that finishes because it hit max_tokens has no error of its
  // own — it just stops mid-sentence, usually mid-JSON. Catch that here
  // with a clear message instead of letting the caller's JSON.parse fail
  // and get misread as a dropped connection.
  const finalMessage = await stream.finalMessage();
  if (finalMessage.stop_reason === "max_tokens") {
    throw new Error(
      `A resposta da IA (parte "${label}") foi cortada por atingir o limite de tokens antes de terminar o JSON. Tente novamente.`
    );
  }
  return raw;
}

/**
 * Forced tool-use guarantees syntactically valid JSON, but NOT that the
 * model actually matches the given input_schema's shape — in testing it
 * sometimes wrapped every field under one extra key (e.g. {"scores": {...
 * the real fields ...}}), and for the "bio" part specifically sometimes
 * nested gaps/swot inside bioDiagnosis instead of beside it. Recover both
 * patterns here rather than relying on prompting alone to prevent them.
 */
function normalizeGeneric(parsed: unknown, required: string[]): Record<string, any> | null {
  const isValid = (v: unknown): v is Record<string, any> =>
    !!v && typeof v === "object" && !Array.isArray(v) && required.every((k) => (v as Record<string, any>)[k] !== undefined);
  return deepFind(parsed, isValid);
}

const isSwotShape = (v: unknown): v is Record<string, any> =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  ["strengths", "weaknesses", "opportunities", "threats"].every((k) => Array.isArray((v as Record<string, any>)[k]));

const isGapsShape = (v: unknown): v is { title: string; description: string }[] =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((item) => item && typeof item === "object" && typeof item.title === "string" && typeof item.description === "string");

/**
 * Recovers a value from anywhere in the response tree, however the model
 * delivered it: at the expected location, nested inside a sibling field,
 * JSON-stringified (possibly more than once), or wrapped in an extra key
 * — all observed in testing for the same logical field across different
 * generations of the same schema. Rather than special-casing each pattern,
 * this just searches the whole tree for something matching the target
 * shape, re-parsing any string it encounters along the way.
 */
function deepFind<T>(root: unknown, isValid: (v: unknown) => v is T, seen = new Set<unknown>()): T | null {
  if (isValid(root)) return root;
  if (typeof root === "string") {
    try {
      return deepFind(JSON.parse(root), isValid, seen);
    } catch {
      return null;
    }
  }
  if (root && typeof root === "object") {
    if (seen.has(root)) return null;
    seen.add(root);
    const values = Array.isArray(root) ? root : Object.values(root as Record<string, unknown>);
    for (const v of values) {
      const found = deepFind(v, isValid, seen);
      if (found) return found;
    }
  }
  return null;
}

const isBioDiagnosisShape = (v: unknown): v is Record<string, any> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, any>;
  return (
    typeof o.currentBio === "string" &&
    typeof o.alignmentScore === "number" &&
    typeof o.analysis === "string" &&
    Array.isArray(o.problems) &&
    typeof o.idealBioIdentity === "string" &&
    typeof o.idealBioPromise === "string" &&
    typeof o.idealBioAuthority === "string" &&
    typeof o.idealBioCta === "string"
  );
};

function normalizeBio(parsed: unknown): Record<string, any> | null {
  const bd = deepFind(parsed, isBioDiagnosisShape);
  if (!bd) return null;
  return {
    bioDiagnosis: {
      currentBio: bd.currentBio,
      alignmentScore: bd.alignmentScore,
      analysis: bd.analysis,
      problems: bd.problems,
      idealBio: { identity: bd.idealBioIdentity, promise: bd.idealBioPromise, authority: bd.idealBioAuthority, cta: bd.idealBioCta },
    },
  };
}

function normalizeGapsSwot(parsed: unknown): Record<string, any> | null {
  const gaps = deepFind(parsed, isGapsShape);
  const swot = deepFind(parsed, isSwotShape);
  if (!gaps || !swot) return null;
  return { gaps, swot };
}

async function fetchPart(profile: InstagramProfileData, label: PartLabel, attempt = 1): Promise<Record<string, any>> {
  const cfg = PARTS_CONFIG[label];
  const raw = await runToolCall(profile, label);

  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // leave parsed null — handled as invalid below
  }

  const normalized =
    label === "bio"
      ? normalizeBio(parsed) ?? normalizeGeneric(parsed, cfg.schema.required)
      : label === "gapsSwot"
      ? normalizeGapsSwot(parsed) ?? normalizeGeneric(parsed, cfg.schema.required)
      : normalizeGeneric(parsed, cfg.schema.required);

  if (!normalized) {
    if (attempt < 2) {
      console.error(`[generate-diagnostic] "${label}" part had invalid structure, retrying (attempt ${attempt + 1})`);
      return fetchPart(profile, label, attempt + 1);
    }
    throw new Error(`A resposta da IA (parte "${label}") veio com estrutura inválida mesmo após nova tentativa. Tente novamente.`);
  }

  return normalized;
}

// Single-char control-code tags, prefixed on every chunk so the client can
// demultiplex the five concurrently-streamed parts back into five separate
// JSON bodies. Chosen from the C0 control range, which generated JSON
// text never contains.
export const SCORES_TAG = "\u0002";
export const BIO_TAG = "\u0003";
export const POSITIONING_TAG = "\u0004";
export const TACTICS_TAG = "\u0005";
export const GAPS_SWOT_TAG = "\u0006";

const PART_TAGS: Record<PartLabel, string> = {
  scores: SCORES_TAG,
  bio: BIO_TAG,
  gapsSwot: GAPS_SWOT_TAG,
  positioning: POSITIONING_TAG,
  tactics: TACTICS_TAG,
};

/**
 * Runs all five parts of the diagnostic concurrently and yields a tagged,
 * validated JSON chunk as each one completes. Running them in parallel —
 * rather than the single call this replaced — is what keeps full
 * per-field depth while finishing in a fraction of the wall-clock time a
 * single call would take, comfortably inside Vercel Hobby's 60s hard
 * function-duration cap. Each part is validated (and retried once if
 * malformed — see fetchPart) before being emitted, so the client only
 * ever receives one complete, well-structured JSON object per part rather
 * than raw token-by-token deltas.
 */
export async function* streamDiagnosticParts(profile: InstagramProfileData): AsyncGenerator<string> {
  type Item = { tag: string; chunk: string } | { error: unknown };
  const queue: Item[] = [];
  let waiting: (() => void) | null = null;
  const labels = Object.keys(PARTS_CONFIG) as PartLabel[];
  let pending = labels.length;

  function push(item: Item) {
    queue.push(item);
    if (waiting) {
      const w = waiting;
      waiting = null;
      w();
    }
  }

  async function run(label: PartLabel) {
    try {
      const result = await fetchPart(profile, label);
      push({ tag: PART_TAGS[label], chunk: JSON.stringify(result) });
    } catch (err) {
      push({ error: err });
    }
  }

  for (const label of labels) run(label);

  while (pending > 0) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => (waiting = resolve));
      continue;
    }
    const item = queue.shift()!;
    pending -= 1;
    if ("error" in item) throw item.error;
    yield item.tag + item.chunk;
  }
}
