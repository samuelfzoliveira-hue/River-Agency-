import { NextResponse, type NextRequest } from "next/server";
import { reportSections } from "@/lib/report-sections";
import { loadReport, parseFilters } from "@/lib/reports-data";
import { toCsv } from "@/lib/domain/reports";
import { getCtx } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ctx = await getCtx();
  if (!ctx?.profile?.active) return new NextResponse("Não autenticado", { status: 401 });
  if (ctx.profile.role !== "admin" && ctx.profile.role !== "gestor") return new NextResponse("Sem permissão", { status: 403 });
  const sp = req.nextUrl.searchParams;
  const f = parseFilters({ de: sp.get("de") ?? undefined, ate: sp.get("ate") ?? undefined, cliente: sp.get("cliente") ?? undefined, resp: sp.get("resp") ?? undefined });
  const secao = sp.get("secao") ?? "clientes";
  const data = await loadReport(ctx as Parameters<typeof loadReport>[0], f);
  const section = reportSections(data).find((s) => s.key === secao);
  if (!section) return new NextResponse("Seção inválida", { status: 400 });
  return new NextResponse(toCsv(section.headers, section.rows), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="river-os-${secao}-${f.from}_${f.to}.csv"`, "cache-control": "no-store" },
  });
}
