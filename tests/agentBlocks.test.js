import test from 'node:test'
import assert from 'node:assert/strict'
import { COMPARISON_COLORS, DETAIL_METRICS, deltaParts, format, sourceStatus } from '../src/components/charts/comparisonFormat.js'
import { REFUND_METRICS, asaasCashText, blockNumber, carriedMetrics, comparedSnapshotText, comparedSources, emptyGroupsText, filterChips, isKnownBlock, mixIsPartial, noticeMessage, omittedText, paymentMix, periodCaption, rankedItems, revenueChart, snapshotText, sourceLabel, statusText, topGroupsChart, totalsNote, volumeChart } from '../src/components/agent/agentBlocks.js'

const period = (label, overrides = {}) => ({ label, days: 30, inProgress: false, ...overrides })
const source = (id, overrides = {}) => ({ id, label: id, platform: id, kind: 'sale', status: 'ready', count: { value: 1, partial: false }, revenue: { value: 10, partial: false }, ...overrides })
const comparison = {
  blockId: 'b2', kind: 'comparison', a: { period: period('01/10 a 30/10'), sources: [source('hotmart'), source('guruRefunds', { kind: 'refund', platform: 'Guru' })] }, b: { period: period('01/09 a 30/09'), sources: [source('hotmart'), source('tmb', { status: 'unavailable' })] },
  groups: { dimension: 'product', rows: Array.from({ length: 7 }, (_, index) => ({ name: index ? `Produto ${index}` : 'Um nome de produto bem comprido', a: { revenue: { value: index ? 10 : null } }, b: { revenue: { value: 5 } } })) },
  series: { kind: 'daily', omittedA: 0, omittedB: 0, rows: [{ label: 'Dia 1', aRevenue: null, bRevenue: 5, aCount: null, bCount: 1 }] },
}
const summary = {
  blockId: 'b1', kind: 'summary',
  groups: { dimension: 'payment', rows: [{ name: 'Cartão', count: { value: 3, partial: false }, revenue: { value: 830, partial: true } }, { name: 'Boleto', count: { value: null, partial: false }, revenue: { value: null, partial: false } }] },
  series: { kind: 'daily', omitted: 0, rows: [{ label: '01/10', date: '2026-10-01', revenue: null, count: null }, { label: '02/10', date: '2026-10-02', revenue: 0, count: 0 }] },
}

test('a missing value stays missing: dash in the tables, gap in the charts, never zero', () => {
  assert.equal(format(null), '—')
  assert.equal(format(undefined, 'count'), '—')
  assert.match(format(0), /R\$\s0,00/, 'A confirmed zero is a zero')
  assert.equal(format(1833.64).replace(/\s/g, ' '), 'R$ 1.833,64')
  assert.equal(revenueChart(comparison).rows[0].aRevenue, null)
  assert.equal(revenueChart(summary).rows[0].revenue, null)
  assert.equal(revenueChart(summary).rows[1].revenue, 0)
  assert.equal(volumeChart(summary).rows[0].count, null)
  assert.equal(topGroupsChart(comparison).rows[0].aValue, null)
  assert.equal(paymentMix(summary)[1].value, null)
  assert.equal(rankedItems(summary)[1].value, null)
})

test('a suspended variation says why, and a zero base has no percentage', () => {
  assert.deepEqual(deltaParts({ absolute: null, percent: null, reason: 'partial' }), { suspended: 'Dados parciais' })
  assert.deepEqual(deltaParts({ absolute: null, percent: null, reason: 'unavailable' }), { suspended: 'Sem dados comparáveis' })
  assert.deepEqual(deltaParts(undefined), { suspended: 'Sem dados comparáveis' })
  const zeroBase = deltaParts({ absolute: 1833.64, percent: null, reason: 'zero-base' })
  assert.equal(zeroBase.value.replace(/\s/g, ' '), '+R$ 1.833,64')
  assert.equal(zeroBase.detail, 'Base B igual a zero · % indisponível')
  assert.deepEqual(deltaParts({ absolute: -5, percent: -12.5, reason: null }, 'count'), { value: '-5', detail: '-12,5%' })
})

test('comparison charts use the Comparativo keys and colors', () => {
  const chart = revenueChart(comparison)
  assert.deepEqual(chart.series.map(item => [item.key, item.color, item.unit]), [['aRevenue', COMPARISON_COLORS.a, 'currency'], ['bRevenue', COMPARISON_COLORS.b, 'currency']])
  assert.deepEqual(chart.series.map(item => item.label), ['A · 01/10 a 30/10', 'B · 01/09 a 30/09'])
  assert.deepEqual([chart.mode, chart.daily], ['line', false])
  assert.deepEqual(volumeChart(comparison).series.map(item => item.key), ['aCount', 'bCount'])
  assert.equal(volumeChart(comparison).mode, 'bar')
  const top = topGroupsChart(comparison)
  assert.equal(top.rows.length, 5)
  assert.equal(top.rows[0].label, 'Um nome de pro…')
  assert.deepEqual(top.series.map(item => item.key), ['aValue', 'bValue'])
})

test('only a daily single period draws on a date axis', () => {
  assert.deepEqual([revenueChart(summary).mode, revenueChart(summary).daily], ['area', true])
  assert.equal(revenueChart({ ...summary, series: { ...summary.series, kind: 'hourly' } }).daily, false)
  assert.equal(volumeChart(summary).daily, false)
})

test('records outside a chart are counted in words', () => {
  assert.equal(omittedText(comparison), null)
  assert.equal(omittedText(summary), null)
  assert.match(omittedText({ ...comparison, series: { ...comparison.series, omittedA: 2, omittedB: 0 } }), /data individual: 2 em A e 0 em B/)
  assert.match(omittedText({ ...summary, series: { kind: 'hourly', omitted: 3, rows: [] } }), /horário exato: 3/)
})

test('group rows reach the bars with their partial flag', () => {
  assert.deepEqual(rankedItems(summary)[0], { key: 'Cartão', label: 'Cartão', value: 830, count: 3, partial: true })
  assert.equal(rankedItems(summary)[1].count, undefined, 'An unknown count shows no "0 vendas"')
})

test('labels, statuses and captions', () => {
  assert.equal(blockNumber({ blockId: 'b12' }), 12)
  assert.equal(blockNumber({}), null)
  assert.equal(statusText('pending'), 'Ainda em coleta')
  assert.equal(statusText('ready'), 'Dados completos')
  assert.equal(statusText('ready', true), 'Dados até agora', 'A period still running is not complete')
  assert.equal(statusText('partial', true), 'Dados parciais')
  assert.equal(statusText('whatever'), 'Dados parciais', 'An unknown state never reads as complete')
  assert.equal(periodCaption(period('01/11/2026 a 02/11/2026', { days: 2, inProgress: true })), '01/11/2026 a 02/11/2026 · 2 dias · até hoje, em andamento')
  assert.equal(periodCaption(period('15/10/2026', { days: 1 })), '15/10/2026 · 1 dia')
  assert.deepEqual(filterChips({ platform: 'Hotmart', family: null, payment: 'Cartão', product: 'dev' }), ['Plataforma: Hotmart', 'Pagamento: Cartão', 'Produto: dev'])
  assert.deepEqual(filterChips(), [])
  assert.equal(sourceStatus('not_requested'), 'Indisponível')
})

test('unknown block kinds fall back instead of breaking the page', () => {
  assert.equal(isKnownBlock({ kind: 'comparison' }), true)
  assert.equal(isKnownBlock({ kind: 'summary' }), true)
  assert.equal(isKnownBlock({ kind: 'chart3d' }), false)
  assert.equal(isKnownBlock(null), false)
})

test('a block lists only the metrics it carries', () => {
  const metrics = { digital: { value: 1 }, dailyRevenue: { value: 2 } }
  assert.deepEqual(carriedMetrics(DETAIL_METRICS, metrics).map(([key]) => key), ['digital', 'dailyRevenue'])
  assert.deepEqual(carriedMetrics(DETAIL_METRICS, undefined), [])
})

test('Asaas receipts are never presented as sales', () => {
  assert.equal(asaasCashText(null), null)
  assert.match(asaasCashText({ value: null, count: null, partial: false }), /indisponíveis/)
  const text = asaasCashText({ value: 1255.36, count: 3, partial: false }).replace(/\s/g, ' ')
  assert.match(text, /R\$ 1\.255,36 em 3 pagamentos/)
  assert.match(text, /Não são vendas/)
  assert.match(asaasCashText({ value: 10, count: 1, partial: true }), /1 pagamento \(parcial\)/)
})

test('sources of both sides line up, and refunds say what they are', () => {
  const rows = comparedSources(comparison)
  assert.deepEqual(rows.map(row => row.id), ['hotmart', 'guruRefunds', 'tmb'])
  assert.equal(rows[1].label, 'Estornos / contestações · Guru')
  assert.equal(rows[1].b, undefined)
  assert.equal(rows[2].a, undefined)
  assert.equal(sourceLabel(source('hotmart')), 'hotmart')
})

test('the snapshot time reads in Brasília', () => {
  assert.equal(snapshotText({ newestSnapshotAt: '2026-11-02T07:00:00.000Z' }), 'Histórico compartilhado coletado em 02/11, 04:00.')
  assert.equal(snapshotText({ oldestSnapshotAt: '2026-10-02T07:00:00.000Z', newestSnapshotAt: '2026-11-02T07:00:00.000Z' }), 'Histórico compartilhado coletado em 02/10, 04:00 a 02/11, 04:00.', 'A long block rests on several snapshots')
  assert.equal(snapshotText({ newestSnapshotAt: null, todaySnapshotAt: '2026-11-02T14:59:00.000Z' }), 'Dados de hoje coletados em 02/11, 11:59.', 'Today alone owes nothing to the 04:00 history')
  assert.equal(snapshotText({ newestSnapshotAt: '2026-11-02T07:00:00.000Z', todaySnapshotAt: '2026-11-02T14:59:00.000Z' }), 'Histórico compartilhado coletado em 02/11, 04:00. Dados de hoje coletados em 02/11, 11:59.')
  assert.equal(snapshotText({ newestSnapshotAt: null }), 'Dados do histórico compartilhado.')
  assert.equal(snapshotText(undefined), 'Dados do histórico compartilhado.')
})

test('no rows only means no sales when the totals are known', () => {
  const metrics = (value, partial = false) => ({ count: { value, partial } })
  const summaryOf = count => ({ kind: 'summary', metrics: count, groups: { rows: [] } })
  assert.equal(emptyGroupsText(summaryOf(metrics(0))), 'Nenhum registro neste recorte.')
  assert.match(emptyGroupsText(summaryOf(metrics(null))), /indisponível até as fontes responderem/)
  assert.match(emptyGroupsText(summaryOf(metrics(0, true))), /indisponível/, 'A partial zero is not known')
  const compared = (a, b) => ({ kind: 'comparison', a: { metrics: a }, b: { metrics: b }, groups: { rows: [] } })
  assert.equal(emptyGroupsText(compared(metrics(0), metrics(0))), 'Nenhum registro identificado nestes períodos.')
  assert.match(emptyGroupsText(compared(metrics(0), metrics(null))), /indisponível/)
  assert.equal(emptyGroupsText({ ...summaryOf(metrics(null)), groups: { rows: [{}] } }), null)
})

test('a share over partial counts is not drawn as a share of the sales', () => {
  const row = partial => ({ name: 'Cartão', count: { value: 3, partial }, revenue: { value: 830, partial: false } })
  assert.equal(mixIsPartial({ metrics: { count: { partial: false } }, groups: { rows: [row(false)] } }), false)
  assert.equal(mixIsPartial({ metrics: { count: { partial: false } }, groups: { rows: [row(true)] } }), true)
  assert.equal(mixIsPartial({ metrics: { count: { partial: true } }, groups: { rows: [row(false)] } }), true)
})

test('the footer claims only what holds for every side', () => {
  assert.match(totalsNote({ excludedUndated: 0, allocationMissing: false }), /permanecem nos totais/)
  assert.equal(totalsNote({ excludedUndated: 1, allocationMissing: false }), '')
  assert.equal(totalsNote({ excludedUndated: 0, allocationMissing: true }), '')
  assert.equal(totalsNote({ excludedUndated: 0, allocationMissing: false }, { excludedUndated: 2, allocationMissing: false }), '')
})

test('each side of a comparison keeps its own snapshot time', () => {
  const at = iso => ({ newestSnapshotAt: iso })
  const same = at('2026-11-02T07:00:00.000Z')
  assert.equal(comparedSnapshotText(same, same), snapshotText(same))
  assert.equal(comparedSnapshotText(same, at('2026-08-02T07:00:00.000Z')), 'Período A: Histórico compartilhado coletado em 02/11, 04:00. Período B: Histórico compartilhado coletado em 02/08, 04:00.')
  assert.equal(comparedSnapshotText(at(null), same), 'Período A: Dados do histórico compartilhado. Período B: Histórico compartilhado coletado em 02/11, 04:00.')
})

test('a notice about one side says which', () => {
  assert.equal(noticeMessage({ message: 'TMB falhou.', side: 'b' }), 'Período B: TMB falhou.')
  assert.equal(noticeMessage({ message: 'Regra.', side: null }), 'Regra.')
  assert.equal(noticeMessage({ message: 'Resumo.' }), 'Resumo.')
})

test('refunds use the vocabulary of the refund card', () => {
  assert.deepEqual(REFUND_METRICS.map(([key]) => key), ['refund', 'refundCount', 'disputeCount', 'cancelledCount'])
  assert.match(REFUND_METRICS[1][1], /confirmados/)
})
