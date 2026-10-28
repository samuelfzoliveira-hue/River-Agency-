/** Aceita "90" (minutos), "1:30" (h:mm) ou "1,5h". Retorna minutos inteiros ou null. */
export function parseDuration(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(",", ".");
  let m: RegExpMatchArray | null;
  if ((m = v.match(/^(\d{1,2}):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if ((m = v.match(/^(\d+(?:\.\d+)?)\s*h$/))) return Math.round(Number(m[1]) * 60);
  if ((m = v.match(/^(\d+)(?:\s*min)?$/))) return Number(m[1]);
  return null;
}

