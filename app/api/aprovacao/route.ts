import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/aprovacao/auth";
import { saveMediaFile } from "@/lib/aprovacao/media";
import { addContent, listContent } from "@/lib/aprovacao/store";
import type { ContentItem, ContentType } from "@/lib/aprovacao/types";

export const runtime = "nodejs";

const VALID_TYPES: ContentType[] = ["feed", "carousel", "story", "reels"];

export async function GET(req: NextRequest) {
  const items = await listContent();
  const cliente = req.nextUrl.searchParams.get("cliente");
  const filtered = cliente
    ? items.filter((item) => item.cliente.toLowerCase() === cliente.toLowerCase())
    : items;
  return NextResponse.json({ items: filtered });
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Senha de agência inválida." }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o formulário enviado." }, { status: 400 });
  }

  const type = String(form.get("type") ?? "") as ContentType;
  const cliente = String(form.get("cliente") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "Tipo de conteúdo inválido." }, { status: 400 });
  }
  if (!cliente) {
    return NextResponse.json({ error: "Informe o nome do cliente." }, { status: 400 });
  }
  if (files.length === 0) {
    return NextResponse.json({ error: "Envie ao menos um arquivo." }, { status: 400 });
  }
  if ((type === "feed" || type === "story" || type === "reels") && files.length !== 1) {
    return NextResponse.json(
      { error: "Esse formato aceita apenas 1 arquivo. Use Carrossel para múltiplos." },
      { status: 400 }
    );
  }
  if (type === "carousel" && files.length < 2) {
    return NextResponse.json({ error: "O carrossel precisa de ao menos 2 arquivos." }, { status: 400 });
  }
  if (type === "carousel" && files.length > 10) {
    return NextResponse.json({ error: "O carrossel aceita no máximo 10 arquivos." }, { status: 400 });
  }
  if (type === "reels" && !files[0].type.startsWith("video/")) {
    return NextResponse.json({ error: "Reels precisa ser um arquivo de vídeo." }, { status: 400 });
  }

  try {
    const media = [];
    for (const file of files) {
      media.push(await saveMediaFile(file));
    }

    const now = new Date().toISOString();
    const item: ContentItem = {
      id: randomUUID(),
      type,
      cliente,
      caption,
      media,
      status: "pendente",
      clientNote: "",
      createdAt: now,
      updatedAt: now,
    };
    await addContent(item);
    return NextResponse.json({ item }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao salvar o conteúdo.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
