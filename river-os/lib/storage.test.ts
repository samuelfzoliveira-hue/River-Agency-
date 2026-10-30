import { describe, expect, it } from "vitest";
import { buildPath, kindFromMime, pathBelongs, safeFileName } from "./storage";

describe("storage", () => {
  it("normaliza nomes de arquivo", () => {
    expect(safeFileName("Logo Ação (final).PNG")).toBe("Logo-Acao-final.png");
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("////")).toBe("arquivo");
    expect(safeFileName("a".repeat(200) + ".mp4").length).toBeLessThanOrEqual(65);
  });
  it("monta e valida o caminho org/cliente/arquivo", () => {
    const p = buildPath("ORG", "CLI", "Arte final.png", "uuid1");
    expect(p).toBe("ORG/CLI/uuid1-Arte-final.png");
    expect(pathBelongs(p, "ORG", "CLI")).toBe(true);
    expect(pathBelongs(p, "ORG")).toBe(true);
    expect(pathBelongs(p, "OUTRA", "CLI")).toBe(false);
    expect(pathBelongs(p, "ORG", "OUTRO")).toBe(false);
    expect(pathBelongs("ORG/CLI/../x.png", "ORG", "CLI")).toBe(false);
    expect(pathBelongs("ORG/CLI/sub/x.png", "ORG", "CLI")).toBe(false);
  });
  it("classifica por MIME", () => {
    expect(kindFromMime("image/png")).toBe("imagem"); expect(kindFromMime("video/mp4")).toBe("video"); expect(kindFromMime("application/pdf")).toBe("documento");
  });
});
