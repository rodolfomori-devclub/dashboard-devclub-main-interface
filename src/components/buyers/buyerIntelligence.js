const countFormatter = new Intl.NumberFormat('pt-BR');
export const validCount = value => Number.isSafeInteger(value) && value >= 0;
export const count = value => validCount(value) ? countFormatter.format(value) : '—';
export function percentage(numerator, denominator) {
  return validCount(numerator) && validCount(denominator) && denominator > 0 && numerator <= denominator
    ? `${(numerator / denominator * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—';
}
export function brazilToday() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = key => parts.find(part => part.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
export const validPeriod = (period, today = brazilToday()) => date(period.dateFrom) && date(period.dateTo)
  && period.dateFrom >= '2024-01-01' && period.dateFrom <= period.dateTo && period.dateTo <= today;
export function dateLabel(value, withTime = false) {
  if (!value) return 'Não informada';
  const parsed = new Date(value.length === 10 ? `${value}T12:00:00Z` : value);
  if (Number.isNaN(parsed.valueOf())) return 'Não informada';
  return parsed.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', ...(withTime ? { timeStyle: 'short' } : {}) });
}
export function oraculoBuyersUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return null;
    return new URL('/compradores', url).href;
  } catch { return null; }
}
