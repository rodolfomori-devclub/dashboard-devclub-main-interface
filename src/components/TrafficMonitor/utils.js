// Helpers de formatação
export const formatCurrency = (val) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(val || 0)

export const formatPercent = (val) => `${parseFloat(val || 0).toFixed(2)}%`

export const formatNumber = (val) =>
  typeof val === 'number' ? val.toLocaleString('pt-BR') : (val || 0)

export const formatCompact = (val) => {
  const n = Number(val) || 0
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k'
  return n.toLocaleString('pt-BR')
}

// Resolve período → { startDate, endDate, comparePrevStart, comparePrevEnd }
// Datas em formato YYYY-MM-DD
export function resolvePeriod(filters) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let start, end
  switch (filters.period) {
    case 'today': {
      start = new Date(today)
      end = new Date(today)
      break
    }
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate() - 1)
      start = y; end = y
      break
    }
    case 'last7days': {
      start = new Date(today); start.setDate(start.getDate() - 6)
      end = new Date(today)
      break
    }
    case 'last30days': {
      start = new Date(today); start.setDate(start.getDate() - 29)
      end = new Date(today)
      break
    }
    case 'last90days': {
      start = new Date(today); start.setDate(start.getDate() - 89)
      end = new Date(today)
      break
    }
    case 'custom': {
      if (!filters.customStart || !filters.customEnd) return { startDate: null, endDate: null }
      start = new Date(filters.customStart + 'T12:00:00')
      end = new Date(filters.customEnd + 'T12:00:00')
      break
    }
    default: {
      start = new Date(today); start.setDate(start.getDate() - 6)
      end = new Date(today)
    }
  }

  const startDate = fmt(start)
  const endDate = fmt(end)

  // Período anterior (mesma duração imediatamente antes)
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1)
  const prevEnd = new Date(start); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd); prevStart.setDate(prevStart.getDate() - (days - 1))

  return {
    startDate,
    endDate,
    comparePrevStart: fmt(prevStart),
    comparePrevEnd: fmt(prevEnd),
    days,
  }
}

export function periodLabel(filters) {
  switch (filters.period) {
    case 'today': return 'Hoje'
    case 'yesterday': return 'Ontem'
    case 'last7days': return 'Últimos 7 dias'
    case 'last30days': return 'Últimos 30 dias'
    case 'last90days': return 'Últimos 90 dias'
    case 'custom': {
      if (filters.customStart && filters.customEnd) {
        const fmtBR = (s) => { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}` }
        return `${fmtBR(filters.customStart)} - ${fmtBR(filters.customEnd)}`
      }
      return 'Personalizado'
    }
    default: return ''
  }
}

// Calcula delta % entre atual e anterior. null se anterior === 0.
export function calcDelta(current, previous) {
  if (!previous || previous === 0) return null
  return ((current - previous) / previous) * 100
}

// Filtra registros cuja data (ISO) caia no intervalo LOCAL [startDate, endDate].
// Necessário porque APIs filtram em UTC e isso "vaza" registros do dia anterior local
// quando o usuário pede "Hoje". startDate/endDate são YYYY-MM-DD.
export function filterByLocalDate(items, startDate, endDate, getDate = (i) => i.createdAt) {
  if (!startDate || !endDate) return items
  return items.filter((it) => {
    const iso = getDate(it)
    if (!iso) return false
    const d = new Date(iso)
    if (isNaN(d.getTime())) return false
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return day >= startDate && day <= endDate
  })
}

// Agrupa registros (com createdAt ISO) por dia → { 'YYYY-MM-DD': count }
export function groupByDay(items, getDate = (i) => i.createdAt) {
  const map = {}
  for (const item of items) {
    const raw = getDate(item)
    if (!raw) continue
    const d = new Date(raw)
    if (isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    map[key] = (map[key] || 0) + 1
  }
  return map
}

// Distribuição de campo de pesquisa
export function distributionFor(items, key) {
  const map = {}
  for (const item of items) {
    const v = item?.pesquisa?.[key]
    const label = (v === undefined || v === null || v === '') ? '—' : String(v)
    map[label] = (map[label] || 0) + 1
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

// Top-N de um campo de pesquisa, com agregação "Outros"
export function topNDistribution(items, key, n = 10) {
  const dist = distributionFor(items, key)
  if (dist.length <= n) return dist
  const top = dist.slice(0, n)
  const others = dist.slice(n).reduce((s, x) => s + x.value, 0)
  return [...top, { name: 'Outros', value: others }]
}

// Heatmap dia da semana × hora
export function weekdayHourHeatmap(items, getDate = (i) => i.createdAt) {
  const matrix = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const item of items) {
    const raw = getDate(item)
    if (!raw) continue
    const d = new Date(raw)
    if (isNaN(d.getTime())) continue
    matrix[d.getDay()][d.getHours()]++
  }
  const cells = []
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      cells.push({ day, hour, value: matrix[day][hour] })
    }
  }
  return cells
}

// Bins de leadScore
export function leadScoreHistogram(items, binSize = 10) {
  const bins = {}
  for (const item of items) {
    const score = Number(item.leadScore)
    if (isNaN(score) || item.leadScore === null) continue
    const bin = Math.floor(score / binSize) * binSize
    const label = `${bin}-${bin + binSize - 1}`
    bins[label] = (bins[label] || 0) + 1
  }
  return Object.entries(bins)
    .map(([name, value]) => ({ name, value, sortKey: parseInt(name, 10) }))
    .sort((a, b) => a.sortKey - b.sortKey)
}

export const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#14b8a6', '#a855f7']

export const PESQUISA_FIELDS = [
  { key: 'idade', label: 'Idade' },
  { key: 'genero', label: 'Gênero' },
  { key: 'ocupacao', label: 'Ocupação' },
  { key: 'faixaSalarial', label: 'Faixa Salarial' },
  { key: 'faculdade', label: 'Tem Faculdade?' },
  { key: 'computador', label: 'Tem Computador?' },
  { key: 'cartaoCredito', label: 'Cartão de Crédito?' },
  { key: 'estudouProgramacao', label: 'Estudou Programação?' },
  { key: 'estudouIA', label: 'Estudou IA?' },
  { key: 'investiuCurso', label: 'Investiu em Curso?' },
  { key: 'investimento', label: 'Pode Investir?' },
  { key: 'urgencia', label: 'Urgência' },
  { key: 'interesseEvento', label: 'Interesse no Evento' },
  { key: 'atracaoProfissao', label: 'Atração da Profissão' },
  { key: 'barreira', label: 'Barreira (top 10)' },
  { key: 'porqueGestor', label: 'Por que Gestor (top 10)' },
]

export const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
