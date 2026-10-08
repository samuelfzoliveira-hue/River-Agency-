import { InstagramProfileData } from "./types";

export function extractUsername(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already a bare username (letters, numbers, dots, underscores)
  if (/^@?[a-zA-Z0-9_.]{1,30}$/.test(trimmed) && !trimmed.includes("/")) {
    return trimmed.replace(/^@/, "");
  }

  try {
    const url = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(url);
    if (!parsed.hostname.includes("instagram.com")) return null;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const reserved = ["p", "reel", "reels", "stories", "explore", "tv"];
    if (reserved.includes(segments[0])) return null;
    return segments[0];
  } catch {
    return null;
  }
}

const IG_APP_ID = "936619743392459";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/**
 * Method 1 (best): Instagram's unauthenticated web API. When it works, it
 * returns everything — bio, counts, and real recent captions with
 * like/comment counts. Instagram aggressively rate-limits and blocks this
 * from data-center / cloud IPs, so it frequently returns null.
 */
async function fetchViaWebProfileInfo(username: string): Promise<InstagramProfileData | null> {
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
      {
        headers: { "X-IG-App-ID": IG_APP_ID, "User-Agent": BROWSER_UA, Accept: "*/*" },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const recentCaptions: string[] = (user.edge_owner_to_timeline_media?.edges ?? [])
      .slice(0, 12)
      .map((e: any) => e?.node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "")
      .filter(Boolean);

    const recentPosts = (user.edge_owner_to_timeline_media?.edges ?? []).slice(0, 12);
    const totalLikes = recentPosts.reduce((sum: number, e: any) => sum + (e?.node?.edge_liked_by?.count ?? 0), 0);
    const totalComments = recentPosts.reduce(
      (sum: number, e: any) => sum + (e?.node?.edge_media_to_comment?.count ?? 0),
      0
    );
    const n = recentPosts.length || 1;

    return {
      username: user.username,
      fullName: user.full_name || user.username,
      bio: user.biography || "",
      profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url,
      followers: user.edge_followed_by?.count ?? 0,
      following: user.edge_follow?.count ?? 0,
      posts: user.edge_owner_to_timeline_media?.count ?? 0,
      isVerified: user.is_verified,
      isPrivate: user.is_private,
      externalUrl: user.external_url ?? undefined,
      recentCaptions,
      avgLikes: Math.round(totalLikes / n),
      avgComments: Math.round(totalComments / n),
      source: "scraped",
    };
  } catch {
    return null;
  }
}

function parseCompactNumber(raw: string): number {
  const cleaned = raw.trim().replace(/,/g, "");
  const m = cleaned.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!m) return Number(cleaned.replace(/\D/g, "")) || 0;
  const n = parseFloat(m[1]);
  if (m[2]?.toLowerCase() === "k") return Math.round(n * 1000);
  if (m[2]?.toLowerCase() === "m") return Math.round(n * 1000000);
  return Math.round(n);
}

/**
 * Method 2 (fallback, partial): scrape the public profile page's <title>
 * and og:description meta tag. Instagram still serves these to most
 * unauthenticated requests even when the full JSON API is blocked, but the
 * bio text and post captions are usually NOT included — only name, handle
 * and follower/following/post counts. Returns null if even this is blocked.
 */
async function fetchViaProfilePage(
  username: string
): Promise<Pick<InstagramProfileData, "username" | "fullName" | "followers" | "following" | "posts"> | null> {
  try {
    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();

    const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i);
    if (!descMatch) return null;

    const desc = descMatch[1];
    const countsMatch = desc.match(
      /([\d.,]+[kKmM]?)\s+Followers,\s*([\d.,]+[kKmM]?)\s+Following,\s*([\d.,]+[kKmM]?)\s+Posts/i
    );
    if (!countsMatch) return null;

    const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
    const nameMatch = titleMatch?.[1]?.match(/^(.*?)\s*\(@[\w.]+\)/);

    return {
      username,
      fullName: nameMatch?.[1]?.trim() || username,
      followers: parseCompactNumber(countsMatch[1]),
      following: parseCompactNumber(countsMatch[2]),
      posts: parseCompactNumber(countsMatch[3]),
    };
  } catch {
    return null;
  }
}

// Apify's Instagram Profile Scraper actor, addressed by its REST "act id"
// (username/actor-name with the slash swapped for `~`, per Apify's API).
const APIFY_ACTOR_ID = "apify~instagram-profile-scraper";

function firstDefined<T>(...values: (T | undefined | null)[]): T | undefined {
  for (const v of values) if (v !== undefined && v !== null) return v as T;
  return undefined;
}

/**
 * Method 0 (paid, reliable): Apify's hosted Instagram Profile Scraper. Unlike
 * the two free methods below, Apify runs this from rotating residential
 * proxies specifically built to get past Instagram's anti-bot blocking, so
 * it's the only method here that works consistently rather than "when
 * Instagram happens to allow it." Only used when APIFY_API_TOKEN is set.
 *
 * Apify's actor output field names aren't hardcoded to one exact shape here
 * — different scraper versions and similar actors name things slightly
 * differently (biography vs bio, followersCount vs followersCount vs
 * followers) — each field is read defensively from a few known candidates
 * so a minor schema drift degrades gracefully instead of breaking silently.
 */
async function fetchViaApify(username: string): Promise<InstagramProfileData | null> {
  const token = process.env.APIFY_API_TOKEN;
  if (!token) return null;

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${encodeURIComponent(
        token
      )}&timeout=90`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [username],
          directUrls: [`https://www.instagram.com/${username}/`],
          resultsLimit: 12,
        }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;

    const items = await res.json();
    const item = Array.isArray(items) ? items[0] : null;
    if (!item || item.error) return null;

    const rawPosts: any[] = firstDefined(item.latestPosts, item.posts, item.topPosts, item.lastPosts) ?? [];
    const posts = rawPosts.slice(0, 12);
    const recentCaptions: string[] = posts
      .map((p) => firstDefined<string>(p?.caption, p?.text, p?.description) ?? "")
      .filter(Boolean);

    const totalLikes = posts.reduce((sum, p) => sum + (firstDefined<number>(p?.likesCount, p?.likes) ?? 0), 0);
    const totalComments = posts.reduce(
      (sum, p) => sum + (firstDefined<number>(p?.commentsCount, p?.comments) ?? 0),
      0
    );
    const n = posts.length || 1;

    const followers = firstDefined<number>(item.followersCount, item.followers_count, item.followers);
    const resolvedUsername = firstDefined<string>(item.username, item.handle) ?? username;

    if (followers === undefined) return null; // shape didn't match what we expect — don't fabricate data

    return {
      username: resolvedUsername,
      fullName: firstDefined<string>(item.fullName, item.full_name, item.name) ?? resolvedUsername,
      bio: firstDefined<string>(item.biography, item.bio) ?? "",
      profilePicUrl: firstDefined<string>(item.profilePicUrlHD, item.profilePicUrl, item.profile_pic_url),
      followers,
      following: firstDefined<number>(item.followsCount, item.following_count, item.following) ?? 0,
      posts: firstDefined<number>(item.postsCount, item.posts_count) ?? posts.length,
      isVerified: firstDefined<boolean>(item.verified, item.isVerified),
      isPrivate: firstDefined<boolean>(item.private, item.isPrivate),
      externalUrl: firstDefined<string>(item.externalUrl, item.external_url) ?? undefined,
      recentCaptions,
      avgLikes: Math.round(totalLikes / n),
      avgComments: Math.round(totalComments / n),
      source: "scraped",
    };
  } catch {
    return null;
  }
}

export type ProfileFetchResult =
  | { status: "full"; profile: InstagramProfileData }
  | {
      status: "partial";
      partial: Pick<InstagramProfileData, "username" | "fullName" | "followers" | "following" | "posts">;
    }
  | { status: "none" };

/**
 * Tries Apify first when configured (paid, reliable — bypasses Instagram's
 * blocking via proxies). Without it, falls back to the free full API, then
 * the lighter partial profile-page scrape. The free methods are best-effort:
 * Instagram can block either at any time, especially from cloud IPs.
 */
export async function fetchInstagramProfile(username: string): Promise<ProfileFetchResult> {
  const viaApify = await fetchViaApify(username);
  if (viaApify) return { status: "full", profile: viaApify };

  const full = await fetchViaWebProfileInfo(username);
  if (full) return { status: "full", profile: full };

  const partial = await fetchViaProfilePage(username);
  if (partial) return { status: "partial", partial };

  return { status: "none" };
}
