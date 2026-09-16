import { promises as fs } from "fs";
import path from "path";
import type { ContentItem } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "aprovacao.json");

// Serializa as escritas para evitar corromper o arquivo em requisições concorrentes.
let writeQueue: Promise<unknown> = Promise.resolve();

function withLock<T>(task: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(task, task);
  writeQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

async function ensureFile(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, "[]", "utf-8");
  }
}

async function readAll(): Promise<ContentItem[]> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ContentItem[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(items: ContentItem[]): Promise<void> {
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
}

export async function listContent(): Promise<ContentItem[]> {
  const items = await readAll();
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addContent(item: ContentItem): Promise<ContentItem> {
  return withLock(async () => {
    const items = await readAll();
    items.push(item);
    await writeAll(items);
    return item;
  });
}

export async function updateContent(
  id: string,
  patch: Partial<ContentItem>
): Promise<ContentItem | null> {
  return withLock(async () => {
    const items = await readAll();
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return null;
    const updated: ContentItem = {
      ...items[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    items[idx] = updated;
    await writeAll(items);
    return updated;
  });
}

export async function deleteContent(id: string): Promise<boolean> {
  return withLock(async () => {
    const items = await readAll();
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return false;
    await writeAll(next);
    return true;
  });
}
