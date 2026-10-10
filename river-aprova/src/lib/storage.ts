import { useEffect, useMemo, useState } from "react";
import * as tus from "tus-js-client";
import { SUPABASE_URL, supabase } from "./supabase";

const BUCKET = "media";
const cache = new Map<string, { url: string; exp: number }>();

/** URLs assinadas (1 h) para arquivos do bucket privado; reaproveita as ainda válidas. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const missing = [...new Set(paths)].filter((p) => !cache.get(p) || cache.get(p)!.exp < now + 60_000);
  if (missing.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(missing, 3600);
    data?.forEach((d) => {
      if (d.path && d.signedUrl) cache.set(d.path, { url: d.signedUrl, exp: now + 3_600_000 });
    });
  }
  const out: Record<string, string> = {};
  paths.forEach((p) => {
    const hit = cache.get(p);
    if (hit) out[p] = hit.url;
  });
  return out;
}

export function useSignedUrls(paths: (string | null | undefined)[]) {
  const key = useMemo(() => paths.filter(Boolean).join("|"), [paths]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const list = key ? key.split("|") : [];
    if (!list.length) return;
    let live = true;
    signedUrls(list).then((u) => live && setUrls((prev) => ({ ...prev, ...u })));
    return () => {
      live = false;
    };
  }, [key]);
  return urls;
}

const safeName = (n: string) => n.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);

/** Envia para `<clientId>/<uuid>-<nome>`. Arquivos grandes usam upload retomável (TUS). */
export async function uploadFile(clientId: string, file: File, onProgress?: (pct: number) => void): Promise<string> {
  const path = `${clientId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  if (file.size <= 6 * 1024 * 1024) {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "3600" });
    if (error) throw new Error(error.message);
    onProgress?.(100);
    return path;
  }
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? "";
  await new Promise<void>((resolve, reject) => {
    const up = new tus.Upload(file, {
      endpoint: `${SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${token}`, "x-upsert": "false" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: 6 * 1024 * 1024,
      metadata: { bucketName: BUCKET, objectName: path, contentType: file.type, cacheControl: "3600" },
      onError: (e) => reject(e),
      onProgress: (sent, total) => onProgress?.(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    up.start();
  });
  return path;
}
