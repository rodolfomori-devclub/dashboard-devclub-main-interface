// Turns a block calculated by the server into what the screen draws. Nothing is
// recalculated here, and a missing value stays null: a gap, never a zero.
import { COMPARISON_COLORS, format } from '../charts/comparisonFormat.js'

export const CASH_METRIC = ['cash', 'Cash collected', 'currency']
// The refund card's vocabulary: disputes and cancellations are not refunds.
export const REFUND_METRICS = [['refund', 'Valor das vendas reembolsadas', 'currency'], ['refundCount', 'Reembolsos confirmados', 'count'], ['disputeCount', 'Contestações', 'count'], ['cancelledCount', 'Cancelamentos', 'count']]
export const GROUP_LABELS = { product: 'Produto', family: 'Família', platform: 'Plataforma', payment: 'Pagamento' }
const STATUS_TEXT = { ready: 'Dados completos', partial: 'Dados parciais', pending: 'Ainda em coleta' }
const axisText = kind => kind === 'hourly' ? 'horário exato' : 'data individual'
const shortName = name => name.length > 15 ? `${name.slice(0, 14)}…` : name

export const isKnownBlock = block => ['comparison', 'summary', 'buyers'].includes(block?.kind)
export const blockNumber = block => Number(String(block?.blockId ?? '').slice(1)) || null
export const statusText = (status, inProgress = false) => status === 'ready' && inProgress ? 'Dados até agora' : STATUS_TEXT[status] ?? 'Dados parciais'
export const periodCaption = ({ label, days, inProgress }) => `${label} · ${days} ${days === 1 ? 'dia' : 'dias'}${inProgress ? ' · até hoje, em andamento' : ''}`
// `dailyBoleto` and similar exist only on the Comparativo; a block lists what it carries.
export const carriedMetrics = (definitions, metrics) => definitions.filter(([key]) => metrics?.[key])
export const filterChips = (filters = {}) => [['Plataforma', filters.platform], ['Família', filters.family], ['Pagamento', filters.payment], ['Produto', filters.product]].filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`)

export function asaasCashText(cash) {
  if (!cash) return null
  if (cash.value === null) return 'Recebimentos do Asaas indisponíveis neste período.'
  return `Recebimentos do Asaas no extrato: ${format(cash.value)} em ${cash.count} ${cash.count === 1 ? 'pagamento' : 'pagamentos'}${cash.partial ? ' (parcial)' : ''}. Não são vendas.`
}

function snapshotTime(value) {
  const at = Date.parse(value)
  return Number.isFinite(at) ? new Date(at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null
}
// As on the Monthly screen: the history rests on its snapshots, and today has its own time.
export function snapshotText(dataSource) {
  const oldest = snapshotTime(dataSource?.oldestSnapshotAt), newest = snapshotTime(dataSource?.newestSnapshotAt), today = snapshotTime(dataSource?.todaySnapshotAt)
  const history = newest && `Histórico compartilhado coletado em ${oldest && oldest !== newest ? `${oldest} a ` : ''}${newest}.`
  const live = today && `Dados de hoje coletados em ${today}.`
  return [history, live].filter(Boolean).join(' ') || 'Dados do histórico compartilhado.'
}
export function comparedSnapshotText(a, b) {
  const textA = snapshotText(a), textB = snapshotText(b)
  return textA === textB ? textA : `Período A: ${textA} Período B: ${textB}`
}
// True only when nothing was left out of the totals on any side.
export const totalsNote = (...sides) => sides.every(side => !side.excludedUndated && !side.allocationMissing) ? 'Valores sem produto ou data permanecem nos totais e não são distribuídos por estimativa.' : ''
export const noticeMessage = notice => notice.side ? `Período ${notice.side.toUpperCase()}: ${notice.message}` : notice.message

const sides = (block, key, unit) => [
  { key: `a${key}`, label: `A · ${block.a.period.label}`, unit, color: COMPARISON_COLORS.a },
  { key: `b${key}`, label: `B · ${block.b.period.label}`, unit, color: COMPARISON_COLORS.b },
]

export function revenueChart(block) {
  if (block.kind === 'comparison') return { rows: block.series.rows, series: sides(block, 'Revenue', 'currency'), mode: 'line', daily: false, title: 'Comparação de receita operacional' }
  return { rows: block.series.rows, series: [{ key: 'revenue', label: 'Receita operacional', unit: 'currency', color: COMPARISON_COLORS.a }], mode: 'area', daily: block.series.kind === 'daily', title: 'Receita operacional do período' }
}

export function volumeChart(block) {
  if (block.kind === 'comparison') return { rows: block.series.rows, series: sides(block, 'Count', 'count'), mode: 'bar', daily: false, title: 'Comparação do volume de vendas' }
  return { rows: block.series.rows, series: [{ key: 'count', label: 'Vendas', unit: 'count', color: COMPARISON_COLORS.a }], mode: 'bar', daily: false, title: 'Volume de vendas do período' }
}

export function omittedText(block) {
  const { series } = block
  if (block.kind === 'comparison') return series.omittedA > 0 || series.omittedB > 0 ? `Fora deste gráfico por falta de ${axisText(series.kind)}: ${series.omittedA} em A e ${series.omittedB} em B. Eles permanecem nos totais.` : null
  return series.omitted > 0 ? `Fora deste gráfico por falta de ${axisText(series.kind)}: ${series.omitted}. Eles permanecem nos totais.` : null
}

export function topGroupsChart(block) {
  return { rows: block.groups.rows.slice(0, 5).map(row => ({ label: shortName(row.name), aValue: row.a.revenue.value, bValue: row.b.revenue.value })), series: sides(block, 'Value', 'currency'), mode: 'bar', daily: false, rotateDates: true, title: 'Comparação dos cinco maiores grupos' }
}

export const rankedItems = block => block.groups.rows.map(row => ({ key: row.name, label: row.name, value: row.revenue.value, count: row.count.value ?? undefined, partial: row.revenue.partial }))
export const paymentMix = block => block.groups.rows.map(row => ({ key: row.name, label: row.name, value: row.count.value }))
// A share over the sources that answered is not a share of the sales.
export const mixIsPartial = block => block.metrics.count.partial || block.groups.rows.some(row => row.count.partial || row.revenue.partial)
/** With no rows, only known totals can say that nothing was sold. */
export function emptyGroupsText(block) {
  if (block.groups.rows.length) return null
  const sides = block.kind === 'comparison' ? [block.a, block.b] : [block]
  if (sides.some(side => side.metrics.count.value === null || side.metrics.count.partial)) return 'Distribuição indisponível até as fontes responderem.'
  return block.kind === 'comparison' ? 'Nenhum registro identificado nestes períodos.' : 'Nenhum registro neste recorte.'
}

export function sourceLabel(source) {
  return source?.kind === 'refund' ? `Estornos / contestações · ${source.platform}` : source?.label
}
export function comparedSources(block) {
  const ids = [...new Set([...block.a.sources, ...block.b.sources].map(source => source.id))]
  return ids.map(id => {
    const a = block.a.sources.find(source => source.id === id), b = block.b.sources.find(source => source.id === id)
    return { id, label: sourceLabel(a ?? b), a, b }
  })
}
