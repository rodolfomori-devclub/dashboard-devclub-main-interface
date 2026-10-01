export function formatDate(value, options = {}) {
  if (!value) return 'Sem data'
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value)
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', ...options })
}

export function formatValue(value, unit = 'count', compact = false) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return 'Não informado'
  const options = { maximumFractionDigits: unit === 'count' ? 0 : 2 }
  if (compact && Math.abs(value) >= 1000) { options.notation = 'compact'; options.maximumFractionDigits = 1 }
  if (unit === 'currency') { options.style = 'currency'; options.currency = 'BRL' }
  return `${new Intl.NumberFormat('pt-BR', options).format(value)}${unit === 'percent' ? '%' : ''}`
}
