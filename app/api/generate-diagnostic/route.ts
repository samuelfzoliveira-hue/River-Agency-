import { NextRequest } from "next/server";
import { streamDiagnosticParts } from "@/lib/claude";
import { InstagramProfileData } from "@/lib/types";
import { DEMO_REPORT } from "@/lib/demoData";

export const runtime = "nodejs";
// Set generously above what this needs (the 5 parallel parts in
// streamDiagnosticParts typically finish in 25-40s, occasionally more if a
// part needs its one retry) — Vercel Hobby hard-caps real execution at 60s
// regardless of this value, so staying under that cap is handled by the
// parallel-parts architecture itself, not by this setting.
export const maxDuration = 120;

/**
 * Stage 2 of 2: generate the diagnosis from an already-resolved profile
 * (see /api/analyze for stage 1). Runs the report as five parallel AI
 * calls (see streamDiagnosticParts) and streams each one back as a single
 * tagged, validated JSON chunk once it completes, rather than waiting for
 * one ~70-90s blocking call — which is both too slow (reverse proxies/
 * serverless platforms treat that as a dead connection) and, on its own,
 * already past Vercel Hobby's 60s hard cap. The client demultiplexes the
 * five tagged parts and parses each as its own JSON once the stream ends.
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
        for await (const chunk of streamDiagnosticParts(profile)) {
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
