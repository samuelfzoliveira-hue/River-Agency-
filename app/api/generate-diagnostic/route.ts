import { NextRequest } from "next/server";
import { streamDiagnosticText } from "@/lib/claude";
import { InstagramProfileData } from "@/lib/types";
import { DEMO_REPORT } from "@/lib/demoData";

export const runtime = "nodejs";
// The AI generation step has run close to 60s on its own in testing, with
// some run-to-run variance in how long the model takes — give it more
// headroom than the default so a slightly-longer-than-usual run doesn't
// get cut off right before finishing. (If the hosting plan caps this lower
// regardless, that's the next thing to check.)
export const maxDuration = 120;

/**
 * Stage 2 of 2: generate the diagnosis from an already-resolved profile
 * (see /api/analyze for stage 1). Streams the model's raw text back as
 * plain chunks rather than waiting for the full ~6-8k token response —
 * a blocking request that long looks like a dead connection to most
 * proxies/platforms and gets killed before the model finishes. The client
 * accumulates the chunks and parses the final JSON once the stream ends.
 *
 * In demo mode (no ANTHROPIC_API_KEY) this just emits the demo report as
 * a single chunk — no need to stream something that's instant.
 */
export async function POST(req: NextRequest) {
  const body: { profile?: InstagramProfileData } = await req.json().catch(() => ({}));
  const profile = body.profile;

  if (!profile) {
    return new Response(JSON.stringify({ error: "Dados do perfil ausentes." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  if (!process.env.ANTHROPIC_API_KEY) {
    const demoJson = JSON.stringify(DEMO_REPORT);
    const readable = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode("\u0001DEMO\u0001"));
        controller.enqueue(encoder.encode(demoJson));
        controller.close();
      },
    });
    return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  const readable = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("\u0001REAL\u0001"));
      try {
        for await (const chunk of streamDiagnosticText(profile)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err: any) {
        // Log full detail server-side (visible in Vercel's function logs) —
        // the SDK's own err.message alone (e.g. "Connection error.") doesn't
        // say WHY the connection failed.
        console.error("[generate-diagnostic] streaming failed:", {
          name: err?.name,
          message: err?.message,
          status: err?.status,
          cause: err?.cause,
          stack: err?.stack,
        });
        const detail = [err?.message, err?.cause?.message, err?.cause?.code].filter(Boolean).join(" | ");
        controller.enqueue(
          encoder.encode(`\u0001ERROR\u0001${detail || "Falha ao gerar o diagnóstico."}`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
