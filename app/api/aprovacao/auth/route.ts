import { NextRequest, NextResponse } from "next/server";
import { checkAdminPassword } from "@/lib/aprovacao/auth";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Requisição inválida." }, { status: 400 });
  }

  const password = typeof (body as { password?: unknown })?.password === "string"
    ? (body as { password: string }).password
    : "";

  if (checkAdminPassword(password)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false, error: "Senha incorreta." }, { status: 401 });
}
