const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** Preserve business dates; render timestamps on the operation's São Paulo calendar. */
export function commissionDateKey(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  const parts = dateFormatter.formatToParts(parsed);
  return `${parts.find((item) => item.type === 'year')?.value}-${parts.find((item) => item.type === 'month')?.value}-${parts.find((item) => item.type === 'day')?.value}`;
}

export function formatCommissionDate(value: string): string {
  return commissionDateKey(value)?.split('-').reverse().join('/') || 'Data a confirmar';
}
