export const TMB_CASH_RATE = 0.4
export const TMB_CASH_RULE = 'tmb_sales_40_percent'
export const TMB_CASH_LABEL = 'TMB · 40% do valor vendido'
export const TMB_CASH_METADATA = Object.freeze({
  cashBasis: 'sales_rule', cashRule: TMB_CASH_RULE, cashLabel: TMB_CASH_LABEL,
  cashRate: TMB_CASH_RATE, cashDateBasis: 'sale_date',
})

function number(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

// Apply 40% to each sale and round once to cents. Decimal integer arithmetic
// avoids binary floating-point errors at half-cent boundaries. The base is
// always the sold amount, never an already computed cash amount.
export function tmbCashAmount(value) {
  const parsed = number(value)
  if (parsed === null || Math.abs(parsed) > Number.MAX_SAFE_INTEGER / 100) return null
  const [, sign, whole, fraction = '', exponent = '0'] = String(parsed).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i)
  const numerator = BigInt(`${whole}${fraction}`) * 40n
  const scale = Number(exponent) - fraction.length
  let cents
  if (scale >= 0) cents = numerator * 10n ** BigInt(scale)
  else {
    const denominator = 10n ** BigInt(-scale)
    cents = numerator / denominator
    if ((numerator % denominator) * 2n >= denominator) cents++
  }
  return (sign === '-' ? -Number(cents) : Number(cents)) / 100
}

export function isTmbSale(row) {
  return row?.kind === 'sale' && [row.sourceId, row.source, row.platform].some(value => String(value || '').trim().toLowerCase() === 'tmb')
}

function calendarDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : null
  }
  if (value === null || value === undefined || value === '') return null
  const epoch = typeof value === 'number' || /^\d{10,13}$/.test(String(value)) ? Number(value) : null
  const parsed = new Date(epoch === null ? value : epoch < 1e12 ? epoch * 1000 : epoch)
  return Number.isNaN(parsed.getTime()) ? null : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(parsed)
}

export function applyTmbCashRule(row) {
  if (!isTmbSale(row)) return row
  const original = row.original || {}
  const raw = original.raw || {}
  // The old API substitutes zero for a malformed raw TMB total. Preserve its
  // existing sale fields, but never promote that unknown amount to known cash.
  const unknownRawTotal = !row.isManual && Object.hasOwn(raw, 'valor_total') && number(raw.valor_total) === null
  const saleDate = original.date?.original ?? original.timestamp ?? row.date
  return { ...row, ...TMB_CASH_METADATA, received: unknownRawTotal ? null : tmbCashAmount(row.gross), cashDate: calendarDate(saleDate) }
}
