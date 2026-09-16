import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type { MediaFile } from "./types";
import { UPLOAD_DIR } from "./storage";

const MAX_FILE_SIZE = 200 * 1024 * 1024; // 200MB

function safeExtension(file: File): string {
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "";
  if (fromName) return fromName;
  if (file.type.startsWith("video/")) return "mp4";
  return "jpg";
}

export async function saveMediaFile(file: File): Promise<MediaFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`Arquivo "${file.name}" excede o limite de 200MB.`);
  }
  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if (!isVideo && !isImage) {
    throw new Error(`Formato não suportado para "${file.name}".`);
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${randomUUID()}.${safeExtension(file)}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, filename), bytes);

  return {
    url: `/api/aprovacao/media/${filename}`,
    kind: isVideo ? "video" : "image",
  };
}

export async function deleteMediaFiles(media: MediaFile[]): Promise<void> {
  await Promise.all(
    media.map(async (m) => {
      const filename = m.url.split("/").pop();
      if (!filename) return;
      const filePath = path.join(UPLOAD_DIR, filename);
      await fs.unlink(filePath).catch(() => undefined);
    })
  );
}
