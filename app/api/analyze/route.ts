import { NextRequest, NextResponse } from "next/server";
import { extractUsername, fetchInstagramProfile } from "@/lib/instagram";
import { generateDiagnostic } from "@/lib/claude";
import { AnalyzeRequestBody, InstagramProfileData } from "@/lib/types";
import { DEMO_REPORT } from "@/lib/demoData";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: AnalyzeRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const username = extractUsername(body.instagramUrl || body.manualData?.username || "");
  if (!username) {
    return NextResponse.json(
      { error: "Não foi possível identificar um @usuário válido do Instagram." },
      { status: 400 }
    );
  }

  let profile: InstagramProfileData | null = null;

  if (body.manualData && (body.manualData.bio || body.manualData.recentCaptions?.length)) {
    // The client already tried an automatic fetch and is now sending the
    // fields that couldn't be collected automatically (bio/captions),
    // possibly merged with prefill data we handed back earlier.
    profile = {
      username,
      fullName: body.manualData.fullName || username,
      bio: body.manualData.bio || "",
      followers: body.manualData.followers ?? 0,
      following: body.manualData.following ?? 0,
      posts: body.manualData.posts ?? 0,
      recentCaptions: body.manualData.recentCaptions ?? [],
      avgLikes: body.manualData.avgLikes,
      avgComments: body.manualData.avgComments,
      externalUrl: body.manualData.externalUrl,
      source: "manual",
    };
  } else {
    const result = await fetchInstagramProfile(username);

    if (result.status === "full") {
      profile = result.profile;
    } else {
      // Nothing usable, or only partial (name/followers/counts, no bio/captions
      // — Instagram usually withholds those from unauthenticated requests).
      // Ask the client for just what's missing, pre-filled with whatever we did get.
      return NextResponse.json(
        {
          needsManualData: true,
          username,
          prefill: result.status === "partial" ? result.partial : { username },
          error:
            result.status === "partial"
              ? "Conseguimos os números do perfil automaticamente, mas o Instagram não libera a bio e as legendas sem login. Complete só isso abaixo."
              : "Não conseguimos coletar os dados automaticamente agora (o Instagram costuma bloquear acessos automatizados, principalmente de servidores). Informe os dados do perfil manualmente para gerar o diagnóstico.",
        },
        { status: 200 }
      );
    }
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({
      ...DEMO_REPORT,
      profile: {
        username: profile.username,
        fullName: profile.fullName,
        profilePicUrl: profile.profilePicUrl,
        followers: profile.followers,
        engagementRate: DEMO_REPORT.profile.engagementRate,
      },
      dataSource: "demo",
      generatedAt: new Date().toISOString(),
    });
  }

  try {
    const diagnostic = await generateDiagnostic(profile);
    const followers = profile.followers || 1;
    const engagementRate =
      profile.avgLikes && profile.avgComments
        ? Number((((profile.avgLikes + profile.avgComments) / followers) * 100).toFixed(2))
        : diagnostic.engagement?.rate ?? 0;

    return NextResponse.json({
      ...diagnostic,
      profile: {
        username: profile.username,
        fullName: profile.fullName,
        profilePicUrl: profile.profilePicUrl,
        followers: profile.followers,
        engagementRate,
      },
      generatedAt: new Date().toISOString(),
      dataSource: profile.source,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Falha ao gerar o diagnóstico." }, { status: 500 });
  }
}
