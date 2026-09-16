import { NextRequest } from "next/server";

export function isAdminRequest(req: NextRequest): boolean {
  const provided = req.headers.get("x-admin-password") ?? "";
  const expected = process.env.APROVACAO_ADMIN_PASSWORD || "rioadmin";
  return provided.length > 0 && provided === expected;
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.APROVACAO_ADMIN_PASSWORD || "rioadmin";
  return password === expected;
}
