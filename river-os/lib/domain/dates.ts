// Datas como strings "YYYY-MM-DD" no fuso da agência (America/Sao_Paulo). Sem dependências.
export const TZ = "America/Sao_Paulo";

const pad = (n: number) => String(n).padStart(2, "0");
const toUTC = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (dt: Date) => `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;

/** Data (YYYY-MM-DD) de um instante no fuso da agência. */
export function brDate(input: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof input === "string" ? new Date(input) : input,
  );
  return parts; // en-CA => YYYY-MM-DD
}
export const todayBR = () => brDate(new Date());

/** Hora (HH:mm) de um instante no fuso da agência. */
export function brTime(input: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(
    typeof input === "string" ? new Date(input) : input,
  );
}

export const addDays = (ymd: string, n: number) => {
  const dt = toUTC(ymd);
  dt.setUTCDate(dt.getUTCDate() + n);
  return fromUTC(dt);
};
export const diffDays = (a: string, b: string) => Math.round((toUTC(a).getTime() - toUTC(b).getTime()) / 86400000);
/** 1 = segunda … 7 = domingo */
export const isoWeekday = (ymd: string) => ((toUTC(ymd).getUTCDay() + 6) % 7) + 1;
export const isBusinessDay = (ymd: string) => isoWeekday(ymd) <= 5;

export const monthStart = (ymd: string) => `${ymd.slice(0, 7)}-01`;
export const monthEnd = (ymd: string) => {
  const dt = toUTC(monthStart(ymd));
  dt.setUTCMonth(dt.getUTCMonth() + 1);
  dt.setUTCDate(0);
  return fromUTC(dt);
};
export const addMonths = (ymd: string, n: number) => {
  const dt = toUTC(monthStart(ymd));
  dt.setUTCMonth(dt.getUTCMonth() + n);
  return fromUTC(dt);
};
export const weekStart = (ymd: string) => addDays(ymd, -(isoWeekday(ymd) - 1));

export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}
/** Dias úteis (seg–sex) entre from e to, inclusive. Feriados não são considerados. */
export const businessDaysBetween = (from: string, to: string) => (from > to ? 0 : eachDay(from, to).filter(isBusinessDay).length);
export const mondaysInMonth = (ymd: string) => eachDay(monthStart(ymd), monthEnd(ymd)).filter((d) => isoWeekday(d) === 1).length;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const monthName = (ymd: string) => MESES[Number(ymd.slice(5, 7)) - 1];
export const monthLabel = (ymd: string) => `${monthName(ymd)} de ${ymd.slice(0, 4)}`;
export const formatBR = (ymd: string | null | undefined) => (ymd ? `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}` : "—");
export const formatShortBR = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
