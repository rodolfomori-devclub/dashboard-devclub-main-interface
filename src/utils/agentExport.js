import * as XLSX from 'xlsx'
import { DETAIL_METRICS, PRIMARY_METRICS, deltaParts, sourceStatus } from '../components/charts/comparisonFormat.js'
import { CASH_METRIC, GROUP_LABELS, REFUND_METRICS, asaasCashText, comparedSnapshotText, filterChips, isKnownBlock, noticeMessage, omittedText, snapshotText, sourceLabel, statusText } from '../components/agent/agentBlocks.js'
import { buildBuyerContactsWorkbook, exportBuyerContacts } from './periodSalesExport.js'
import { buildReportWorkbook, exportWorkbook } from './reportExport.js'

const METRICS = [...PRIMARY_METRICS, CASH_METRIC, ...DETAIL_METRICS, ...REFUND_METRICS]
const MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const metricValue = (metric, unit = 'currency') => metric?.value == null ? null
  : unit === 'currency' ? { t: 'n', v: metric.value, z: MONEY_FORMAT } : metric.value
const coverage = metric => metric?.value == null ? 'Não informado' : metric.partial ? 'Parcial' : 'Disponível'
const metricCells = (metric, unit) => [metricValue(metric, unit), coverage(metric)]
const deltaCells = (delta, unit = 'currency') => delta?.absolute == null
  ? [null, null, deltaParts(delta, unit).suspended]
  : [metricValue({ value: delta.absolute }, unit), delta.percent ?? null, delta.percent == null ? 'Base B igual a zero · % indisponível' : 'Disponível']

function blockContext(block) {
  const comparison = block.kind === 'comparison'
  const sides = comparison ? [['A', block.a], ['B · base', block.b]] : [['', block]]
  return [
    ['Bloco', block.blockId],
    ['Origem', 'Dados calculados pelo servidor. Valores ausentes não são substituídos por zero.'],
    ['Filtros aplicados', filterChips(block.filters).join(' · ') || 'Sem filtros adicionais'],
    ...sides.flatMap(([label, side]) => [
      [`Período ${label}`.trim(), `${side.period.startDate} a ${side.period.endDate}`],
      [`Cobertura ${label}`.trim(), statusText(side.status, side.period.inProgress)],
      [`Registros sem data excluídos ${label}`.trim(), side.excludedUndated || 0],
      ...(side.allocationMissing ? [[`Distribuição ${label}`.trim(), 'Há valores sem distribuição por produto ou data.']] : []),
      ...(side.asaasCash ? [[`Extrato Asaas ${label}`.trim(), asaasCashText(side.asaasCash)]] : []),
    ]),
    ['Coleta', comparison ? comparedSnapshotText(block.a.dataSource, block.b.dataSource) : snapshotText(block.dataSource)],
    ...(comparison ? [['Variações', 'Período A menos B; percentuais usam B como base. Variações indisponíveis permanecem vazias.']] : []),
    ...(block.groups.truncated ? [['Limite dos grupos', `Consulta limitada aos ${block.groups.rows.length} grupos recebidos.`]] : []),
    ...(omittedText(block) ? [['Série temporal', omittedText(block)]] : []),
    ...(block.notices || []).map(notice => [notice.title, noticeMessage(notice)]),
  ]
}

function summarySheets(block) {
  return [
    { name: 'Indicadores', headers: ['Indicador', 'Valor', 'Cobertura'], rows: METRICS.filter(([key]) => block.metrics[key]).map(([key, label, unit]) => [label, ...metricCells(block.metrics[key], unit)]) },
    { name: 'Distribuição', headers: [GROUP_LABELS[block.groups.dimension] || 'Grupo', 'Vendas', 'Cobertura das vendas', 'Receita operacional', 'Cobertura da receita'], rows: block.groups.rows.map(row => [row.name, ...metricCells(row.count, 'count'), ...metricCells(row.revenue)]) },
    { name: 'Série temporal', headers: ['Período', 'Data', 'Receita operacional', 'Vendas'], rows: block.series.rows.map(row => [row.label, row.date, metricValue({ value: row.revenue }), row.count]) },
    { name: 'Fontes', headers: ['Fonte', 'Estado', 'Registros', 'Cobertura dos registros', 'Receita operacional', 'Cobertura da receita'], rows: block.sources.map(source => [sourceLabel(source), sourceStatus(source.status), ...metricCells(source.count, 'count'), ...metricCells(source.revenue)]) },
  ]
}

function comparisonSheets(block) {
  const { a, b } = block
  const groupValues = (row, key, unit) => [...metricCells(row.a[key], unit), ...metricCells(row.b[key], unit), ...deltaCells(row[`${key}Delta`], unit)]
  const head = ['Valor A', 'Cobertura A', 'Valor B · base', 'Cobertura B', 'Variação A − B', 'Variação (%)', 'Estado da variação']
  return [
    { name: 'Indicadores', headers: ['Indicador', ...head], rows: METRICS.filter(([key]) => a.metrics[key] || b.metrics[key]).map(([key, label, unit]) => [label, ...metricCells(a.metrics[key], unit), ...metricCells(b.metrics[key], unit), ...deltaCells(block.deltas[key], unit)]) },
    ...[['revenue', 'Receita por grupo', 'currency'], ['count', 'Vendas por grupo', 'count']].map(([key, name, unit]) => ({ name, headers: [GROUP_LABELS[block.groups.dimension] || 'Grupo', ...head], rows: block.groups.rows.map(row => [row.name, ...groupValues(row, key, unit)]) })),
    { name: 'Série temporal', headers: ['Período', 'Data A', 'Data B', 'Receita A', 'Receita B', 'Vendas A', 'Vendas B'], rows: block.series.rows.map(row => [row.label, row.aDate, row.bDate, metricValue({ value: row.aRevenue }), metricValue({ value: row.bRevenue }), row.aCount, row.bCount]) },
    { name: 'Fontes', headers: ['Período', 'Fonte', 'Estado', 'Registros', 'Cobertura dos registros', 'Receita operacional', 'Cobertura da receita'], rows: [['A', a], ['B · base', b]].flatMap(([label, side]) => side.sources.map(source => [label, sourceLabel(source), sourceStatus(source.status), ...metricCells(source.count, 'count'), ...metricCells(source.revenue)])) },
  ]
}

export function buildAgentBlockWorkbook(block) {
  if (!isKnownBlock(block)) throw new Error('Este resultado não pode ser exportado.')
  if (block.kind === 'buyers') return buildBuyerContactsWorkbook(block)
  return buildReportWorkbook({
    title: block.kind === 'comparison' ? 'Comparação de períodos · Agente' : 'Resumo do período · Agente',
    context: blockContext(block),
    sheets: block.kind === 'comparison' ? comparisonSheets(block) : summarySheets(block),
  })
}

export function buildAgentResponseWorkbook(turn) {
  const context = [
    ['Pergunta', turn.question],
    ['Estado da resposta', turn.status === 'done' ? 'Concluída' : 'Resposta incompleta'],
    ['Leitura', 'O texto do agente é um comentário. Os blocos contêm os dados calculados pelo servidor.'],
    ...(turn.pending ? [['Coleta', 'Histórico ainda carregando no servidor. Os resultados podem estar parciais.']] : []),
    ...(turn.truncated ? [['Comentário', 'O comentário foi cortado antes do fim.']] : []),
    ...(turn.error?.message ? [['Erro', turn.error.message]] : []),
    ...(turn.unverifiedNumbers?.length ? [['Números não verificados', turn.unverifiedNumbers.join(', ')]] : []),
  ]
  const rows = turn.parts.filter(part => part.type !== 'block').map(part => [part.type === 'text' ? 'Comentário do agente' : 'Consulta recusada', part.text || part.message])
  const workbook = buildReportWorkbook({ title: 'Resposta do agente', context, sheets: [{ name: 'Comentário', headers: ['Tipo', 'Texto'], rows }] })
  let index = 0
  for (const part of turn.parts) {
    if (part.type !== 'block') continue
    // An unknown block must not silently disappear from an exported answer.
    const blockWorkbook = buildAgentBlockWorkbook(part.block)
    index += 1
    for (const name of blockWorkbook.SheetNames) XLSX.utils.book_append_sheet(workbook, blockWorkbook.Sheets[name], `${index} ${name}`.slice(0, 31))
  }
  return workbook
}

export async function exportAgentBlock(block, format) {
  if (block.kind === 'buyers' && format !== 'pdf') return exportBuyerContacts(block, format)
  const period = block.kind === 'comparison' ? block.a.period : block.period
  const partial = block.kind === 'comparison' ? [block.a, block.b].some(side => side.status !== 'ready') : block.status !== 'ready' || block.truncated
  const prefix = block.kind === 'buyers' ? 'compradores' : block.kind === 'comparison' ? 'agente-comparacao' : 'agente-resumo'
  return exportWorkbook(buildAgentBlockWorkbook(block), format, { filename: `${prefix}-${period.startDate}-${period.endDate}${partial ? '-parcial' : ''}`, title: block.kind === 'buyers' ? 'Contatos dos compradores' : 'Consulta do agente' })
}

export async function exportAgentResponse(turn, format) {
  return exportWorkbook(buildAgentResponseWorkbook(turn), format, { filename: 'agente-resposta', title: 'Resposta do agente' })
}
