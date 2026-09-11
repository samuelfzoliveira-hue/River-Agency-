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

/**
 * Attempts to fetch public profile data straight from Instagram's
 * unauthenticated web API. Instagram aggressively rate-limits and blocks
 * requests coming from data-center / cloud IPs, so this frequently fails —
 * callers MUST handle the null case and fall back to manual input.
 */
export async function fetchInstagramProfile(
  username: string
): Promise<InstagramProfileData | null> {
  try {
    const res = await fetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(
        username
      )}`,
      {
        headers: {
          "X-IG-App-ID": IG_APP_ID,
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          Accept: "*/*",
        },
        cache: "no-store",
      }
    );

    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const recentCaptions: string[] = (
      user.edge_owner_to_timeline_media?.edges ?? []
    )
      .slice(0, 12)
      .map(
        (e: any) =>
          e?.node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? ""
      )
      .filter(Boolean);

    const recentPosts = (user.edge_owner_to_timeline_media?.edges ?? []).slice(
      0,
      12
    );
    const totalLikes = recentPosts.reduce(
      (sum: number, e: any) => sum + (e?.node?.edge_liked_by?.count ?? 0),
      0
    );
    const totalComments = recentPosts.reduce(
      (sum: number, e: any) =>
        sum + (e?.node?.edge_media_to_comment?.count ?? 0),
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
