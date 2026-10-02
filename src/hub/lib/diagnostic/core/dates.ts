/**
 * Datas e dinheiro do diagnostico.
 * Datas de calendario sao 'YYYY-MM-DD' e a conta usa so as partes, em UTC
 * (sem fuso nem horario de verao). "Agora" sempre chega por parametro.
 */

const SAO_PAULO = 'America/Sao_Paulo';
const DAY_MS = 86400000;
const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEKDAYS_BR = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/** Meia-noite UTC do dia, ou null quando nao e uma data real. */
function parseYmd(ymd: string): Date | null {
  if (typeof ymd !== 'string') return null;
  const match = YMD_RE.exec(ymd);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  // setUTCFullYear nao tem o ajuste de Date.UTC para anos 0-99
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date;
}

const pad = (n: number, size = 2): string => String(n).padStart(size, '0');

function formatYmd(date: Date): string {
  return `${pad(date.getUTCFullYear(), 4)}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** 'YYYY-MM-DD' com data real de calendario. */
export function isValidYmd(ymd: string): boolean {
  return parseYmd(ymd) !== null;
}

/** '2026-10-04' -> '04/10/2026'. Vazio ou invalido -> ''. */
export function ymdToBR(ymd: string): string {
  if (!isValidYmd(ymd)) return '';
  const [year, month, day] = ymd.split('-');
  return `${day}/${month}/${year}`;
}

/** Soma dias de calendario. Invalido -> ''. */
export function addDaysYmd(ymd: string, days: number): string {
  const date = parseYmd(ymd);
  if (!date || typeof days !== 'number' || !Number.isFinite(days)) return '';
  date.setUTCDate(date.getUTCDate() + Math.trunc(days));
  return formatYmd(date);
}

/** Dias inteiros de `from` ate `to` (negativo se `to` vem antes). Invalido -> NaN. */
export function diffDaysYmd(from: string, to: string): number {
  const a = parseYmd(from);
  const b = parseYmd(to);
  if (!a || !b) return NaN;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

const ymdFormatters = new Map<string, Intl.DateTimeFormat>();

function msToYmd(ms: number, timeZone: string): string {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return '';
  try {
    let formatter = ymdFormatters.get(timeZone);
    if (!formatter) {
      formatter = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
      ymdFormatters.set(timeZone, formatter);
    }
    const parts = formatter.formatToParts(new Date(ms));
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    const ymd = `${part('year').padStart(4, '0')}-${part('month')}-${part('day')}`;
    return isValidYmd(ymd) ? ymd : '';
  } catch {
    // fuso desconhecido
    return '';
  }
}

/** Dia de um instante ISO no fuso informado. Uma data pura ('YYYY-MM-DD') volta igual. */
export function isoToYmd(iso: string, timeZone = SAO_PAULO): string {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  if (isValidYmd(iso)) return iso;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? '' : msToYmd(ms, timeZone);
}

/** Dia de hoje no fuso informado, a partir do "agora" recebido. */
export function todayYmd(nowMs: number, timeZone = SAO_PAULO): string {
  return msToYmd(nowMs, timeZone);
}

/** Dia da semana por extenso ('sábado'). Invalido -> ''. */
export function weekdayLongBR(ymd: string): string {
  const date = parseYmd(ymd);
  return date ? WEEKDAYS_BR[date.getUTCDay()] : '';
}

let brlFormatter: Intl.NumberFormat | null = null;

/** 'R$ 1.234,56' com o espaco do proprio Intl (nao separavel). Nao numerico -> ''. */
export function formatBRL(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  if (!brlFormatter) brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  // -0 viraria "-R$ 0,00"
  return brlFormatter.format(value === 0 ? 0 : value);
}
