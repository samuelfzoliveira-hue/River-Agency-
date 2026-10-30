import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/cadastro", "/auth", "/aprovar"];

function configProblem(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return "Variáveis ausentes: defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel (Settings → Environment Variables) e faça um novo deploy.";
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+\/?$/.test(url.trim())) return "NEXT_PUBLIC_SUPABASE_URL inválida: use o endereço completo do projeto, como https://xxxxxxxx.supabase.co (com https://, sem espaços e sem caminho).";
  return null;
}

export async function middleware(req: NextRequest) {
  const problem = configProblem();
  if (problem) return new NextResponse(`RIVER OS — configuração incompleta\n\n${problem}\n`, { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
  let user = null;
  try { user = (await supabase.auth.getUser()).data.user; } catch { /* Supabase indisponível: trata como sem sessão */ }
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));
  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && (path === "/login" || path === "/cadastro")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"] };
