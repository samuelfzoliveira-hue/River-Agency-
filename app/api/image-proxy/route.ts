import { NextRequest } from "next/server";

export const runtime = "nodejs";

// Instagram's CDN serves profile photos with hotlink protection — loading
// the URL straight from our own domain (a different origin, no Instagram
// session/referrer) gets a 403 instead of the image, which is why the photo
// doesn't show up even though we do have a profilePicUrl. Fetching it here,
// server-side, with a normal browser User-Agent works around that, and we
// only proxy Instagram/Facebook CDN hosts to avoid turning this into an
// open image-fetching relay for arbitrary URLs (SSRF).
const ALLOWED_HOST_SUFFIXES = [".cdninstagram.com", ".fbcdn.net"];

function isAllowedHost(hostname: string): boolean {
  return ALLOWED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
    return new Response("Host not allowed", { status: 400 });
  }

  try {
    const res = await fetch(parsed.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!res.ok || !res.body) {
      return new Response("Upstream error", { status: 502 });
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new Response("Fetch failed", { status: 502 });
  }
}
