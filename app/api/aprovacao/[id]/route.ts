import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/aprovacao/auth";
import { deleteMediaFiles } from "@/lib/aprovacao/media";
import { deleteContent, listContent, updateContent } from "@/lib/aprovacao/store";
import type { ApprovalStatus, ContentItem } from "@/lib/aprovacao/types";

export const runtime = "nodejs";

const VALID_STATUSES: ApprovalStatus[] = ["pendente", "aprovado", "ajustes"];

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  const payload = body as Partial<Record<keyof ContentItem, unknown>>;
  const admin = isAdminRequest(req);
  const patch: Partial<ContentItem> = {};

  if (typeof payload.status === "string" && VALID_STATUSES.includes(payload.status as ApprovalStatus)) {
    patch.status = payload.status as ApprovalStatus;
  }
  if (typeof payload.clientNote === "string") {
    patch.clientNote = payload.clientNote.slice(0, 2000);
  }
  if (admin) {
    if (typeof payload.caption === "string") patch.caption = payload.caption;
    if (typeof payload.cliente === "string" && payload.cliente.trim()) {
      patch.cliente = payload.cliente.trim();
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });
  }

  const updated = await updateContent(id, patch);
  if (!updated) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Senha de agência inválida." }, { status: 401 });
  }
  const { id } = await params;

  const items = await listContent();
  const item = items.find((i) => i.id === id);
  const ok = await deleteContent(id);
  if (!ok) {
    return NextResponse.json({ error: "Conteúdo não encontrado." }, { status: 404 });
  }
  if (item) {
    await deleteMediaFiles(item.media);
  }
  return NextResponse.json({ ok: true });
}
