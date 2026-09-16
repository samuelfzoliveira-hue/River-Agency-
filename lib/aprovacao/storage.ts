import path from "path";

// Em produção (ex.: Render, com disco persistente montado), defina
// APROVACAO_STORAGE_DIR para o caminho do disco — ex.: /var/data.
// Sem essa variável, os dados ficam dentro do próprio projeto (uso local).
const STORAGE_DIR = process.env.APROVACAO_STORAGE_DIR
  ? path.resolve(process.env.APROVACAO_STORAGE_DIR)
  : process.cwd();

export const DATA_DIR = path.join(STORAGE_DIR, "data");
export const DATA_FILE = path.join(DATA_DIR, "aprovacao.json");
export const UPLOAD_DIR = path.join(STORAGE_DIR, "uploads", "aprovacao");
