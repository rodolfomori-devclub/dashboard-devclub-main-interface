import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { buildAgentBlockWorkbook, buildAgentResponseWorkbook } from '../src/utils/agentExport.js'
import { buildWorkbookCsv, buildWorkbookPdf } from '../src/utils/reportExport.js'

const metric = (value, partial = false) => ({ value, partial })
const period = { startDate: '2026-10-01', endDate: '2026-10-02', label: '01/10/2026 a 02/10/2026', inProgress: false }
const metrics = { revenue: metric(123.45, true), count: metric(0), net: metric(null), cash: metric(50), refund: metric(15), refundCount: metric(1) }
const source = { id: 'hotmart', label: 'Hotmart', platform: 'Hotmart', kind: 'sale', status: 'partial', count: metric(0), revenue: metric(123.45, true) }
const summary = {
  blockId: 'b1', kind: 'summary', period, filters: { platform: 'Hotmart', product: 'Produto; "completo"' }, status: 'partial', metrics,
  sources: [source], excludedUndated: 1, allocationMissing: true,
  dataSource: { newestSnapshotAt: '2026-10-03T01:30:00Z' },
  asaasCash: { value: 30, count: 1, partial: false },
  groups: { dimension: 'product', truncated: true, rows: [{ name: 'Produto com nome completo e extenso', count: metric(0), revenue: metric(123.45, true) }] },
  series: { kind: 'daily', omitted: 1, rows: [{ label: '01/10', date: '2026-10-01', revenue: null, count: null }, { label: '02/10', date: '2026-10-02', revenue: 0, count: 0 }] },
  notices: [{ title: 'Fonte parcial', message: 'TMB não respondeu.', side: 'b' }],
}
const comparison = {
  blockId: 'b2', kind: 'comparison', filters: summary.filters,
  a: summary,
  b: { ...summary, period: { ...period, startDate: '2026-09-01', endDate: '2026-09-02' }, metrics: { ...metrics, revenue: metric(0) }, status: 'ready' },
  deltas: { revenue: { absolute: null, percent: null, reason: 'partial' }, count: { absolute: 0, percent: null, reason: 'zero-base' }, cash: { absolute: -5, percent: -10, reason: null } },
  groups: { dimension: 'product', truncated: false, rows: [{ name: '=produto', a: { revenue: metric(123.45, true), count: metric(0) }, b: { revenue: metric(null), count: metric(null) }, revenueDelta: { absolute: null, reason: 'unavailable' }, countDelta: { absolute: null, reason: 'partial' } }] },
  series: { kind: 'daily', omittedA: 1, omittedB: 0, rows: [{ label: 'Dia 1', aDate: '2026-10-01', bDate: '2026-09-01', aRevenue: 0, bRevenue: null, aCount: 0, bCount: null }] },
  notices: summary.notices,
}
const buyers = {
  blockId: 'b1', kind: 'buyers', period, filters: summary.filters, status: 'partial', totalRows: 40, truncated: true,
  rows: Array.from({ length: 26 }, (_, index) => ({ name: `Comprador ${index + 1}`, phone: '0012345', email: `cliente${index + 1}@example.test`, product: 'DevClub', platform: 'Hotmart', date: '2026-10-02T01:30:00Z' })),
}
const rows = sheet => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
const row = (sheet, label) => rows(sheet).find(cells => cells[0] === label)
const roundtrip = workbook => XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellNF: true })

test('agent summary exports server values, full group names and series without changing missing values into zero', () => {
  const workbook = roundtrip(buildAgentBlockWorkbook(summary))
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Receita operacional'), ['Receita operacional', 123.45, 'Parcial'])
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Vendas'), ['Vendas', 0, 'Disponível'])
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Líquido informado'), ['Líquido informado', null, 'Não informado'])
  assert.equal(workbook.Sheets.Indicadores.B2.t, 'n')
  assert.match(workbook.Sheets.Indicadores.B2.z, /R\$/)
  assert.deepEqual(row(workbook.Sheets.Distribuição, 'Produto com nome completo e extenso'), ['Produto com nome completo e extenso', 0, 'Disponível', 123.45, 'Parcial'])
  assert.deepEqual(rows(workbook.Sheets['Série temporal']).slice(1), [['01/10', '2026-10-01', null, null], ['02/10', '2026-10-02', 0, 0]])
  assert.ok(row(workbook.Sheets.Indicadores, 'Valor das vendas reembolsadas'))
  assert.ok(row(workbook.Sheets.Indicadores, 'Cash collected'))
})

test('agent context carries the consulted filters, limitations, snapshots and notices', () => {
  const workbook = buildAgentBlockWorkbook(summary)
  const context = workbook.Sheets.Contexto
  assert.match(row(context, 'Filtros aplicados')[1], /Hotmart.*Produto; "completo"/)
  assert.equal(row(context, 'Cobertura')[1], 'Dados parciais')
  assert.match(row(context, 'Limite dos grupos')[1], /1 grupos recebidos/)
  assert.match(row(context, 'Série temporal')[1], /1/)
  assert.match(row(context, 'Coleta')[1], /02\/10, 22:30/)
  assert.match(row(context, 'Fonte parcial')[1], /Período B: TMB não respondeu/)
  assert.match(row(context, 'Extrato Asaas')[1], /Não são vendas/)
})

test('agent comparisons preserve suspended deltas, zero bases, both periods and source coverage', () => {
  const workbook = roundtrip(buildAgentBlockWorkbook(comparison))
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Receita operacional'), ['Receita operacional', 123.45, 'Parcial', 0, 'Disponível', null, null, 'Dados parciais'])
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Vendas'), ['Vendas', 0, 'Disponível', 0, 'Disponível', 0, null, 'Base B igual a zero · % indisponível'])
  assert.deepEqual(row(workbook.Sheets.Indicadores, 'Cash collected').slice(5), [-5, -10, 'Disponível'])
  assert.deepEqual(rows(workbook.Sheets['Série temporal']).slice(1), [['Dia 1', '2026-10-01', '2026-09-01', 0, null, 0, null]])
  assert.deepEqual(rows(workbook.Sheets.Fontes).slice(1).map(cells => cells.slice(0, 3)), [['A', 'Hotmart', 'Parcial'], ['B · base', 'Hotmart', 'Parcial']])
  assert.equal(workbook.Sheets['Receita por grupo'].A2.v, '=produto')
  assert.equal(workbook.Sheets['Receita por grupo'].A2.f, undefined)
})

test('agent buyer export reuses all returned contacts and their original typed dates and text phones', () => {
  const workbook = roundtrip(buildAgentBlockWorkbook(buyers))
  assert.equal(rows(workbook.Sheets.Compradores).length, 27)
  assert.equal(workbook.Sheets.Compradores.C27.v, '0012345')
  assert.equal(workbook.Sheets.Compradores.F2.t, 'n')
  assert.equal(row(workbook.Sheets.Contexto, 'Registros encontrados')[1], 40)
  assert.match(row(workbook.Sheets.Contexto, 'Limite')[1], /26 de 40/)
})

test('a complete response exports every block with unique sheets and labels the commentary and unverified numbers', () => {
  const turn = { question: '=Comparar períodos', status: 'done', pending: true, truncated: true, unverifiedNumbers: ['R$ 999,99'], parts: [{ type: 'block', block: summary }, { type: 'text', text: 'Comentário; "do agente"\nLinha 2' }, { type: 'block', block: comparison }, { type: 'block', block: buyers }, { type: 'tool_error', message: 'Fonte recusada' }] }
  const workbook = roundtrip(buildAgentResponseWorkbook(turn))
  assert.ok(workbook.SheetNames.includes('1 Indicadores'))
  assert.ok(workbook.SheetNames.includes('2 Indicadores'))
  assert.ok(workbook.SheetNames.includes('3 Compradores'))
  assert.equal(new Set(workbook.SheetNames).size, workbook.SheetNames.length)
  assert.equal(row(workbook.Sheets.Contexto, 'Pergunta')[1], '=Comparar períodos')
  assert.equal(row(workbook.Sheets.Contexto, 'Números não verificados')[1], 'R$ 999,99')
  assert.match(row(workbook.Sheets.Contexto, 'Coleta')[1], /parciais/)
  assert.match(row(workbook.Sheets.Contexto, 'Comentário')[1], /cortado/)
  assert.deepEqual(rows(workbook.Sheets.Comentário).slice(1), [['Comentário do agente', 'Comentário; "do agente"\nLinha 2'], ['Consulta recusada', 'Fonte recusada']])
  for (const sheet of Object.values(workbook.Sheets)) for (const [key, cell] of Object.entries(sheet)) if (!key.startsWith('!')) assert.equal(cell.f, undefined)
})

test('unknown blocks cannot be silently omitted and incomplete responses remain identified', () => {
  assert.throws(() => buildAgentBlockWorkbook({ kind: 'unsupported' }), /não pode ser exportado/)
  assert.throws(() => buildAgentResponseWorkbook({ parts: [{ type: 'block', block: { kind: 'unsupported' } }] }), /não pode ser exportado/)
  const workbook = buildAgentResponseWorkbook({ status: 'cancelled', error: { message: 'Interrompido.' }, parts: [{ type: 'text', text: 'Comentário incompleto' }] })
  assert.equal(row(workbook.Sheets.Contexto, 'Estado da resposta')[1], 'Resposta incompleta')
  assert.equal(row(workbook.Sheets.Contexto, 'Erro')[1], 'Interrompido.')
})

test('CSV and PDF contain all response sections, including contacts beyond the visible page', async () => {
  const workbook = buildAgentResponseWorkbook({ question: 'Comparar e listar compradores', status: 'done', parts: [{ type: 'block', block: comparison }, { type: 'block', block: buyers }, { type: 'text', text: 'Comentário final' }] })
  const csv = buildWorkbookCsv(workbook)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.match(csv, /"'=produto"/)
  assert.match(csv, /"123,45"/)
  assert.match(csv, /"Comentário final"/)
  assert.match(csv, /cliente26@example\.test/)
  assert.match(csv, /26 de 40/)
  const pdf = await buildWorkbookPdf(workbook)
  const bytes = pdf.output()
  assert.ok(bytes.startsWith('%PDF-'))
  assert.match(bytes, /cliente26@example\.test/)
  assert.ok(pdf.getNumberOfPages() > 1)
})
