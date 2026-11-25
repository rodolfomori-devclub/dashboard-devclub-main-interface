import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { buildReportWorkbook, buildWorkbookCsv, buildWorkbookPdf, exportWorkbook } from '../src/utils/reportExport.js'

const report = {
  title: 'Vendas filtradas', context: [['Período', '2026-11-01 a 2026-11-23'], ['Produto', 'DevClub']],
  sheets: [{ name: 'Vendas', headers: ['Cliente', 'Valor', 'Telefone'], rows: [
    ['=HYPERLINK("https://example.test")', 125.35, '00123456789'],
    ['José; "Silva"\nLinha 2', null, '+5511999999999'], ['Zero confirmado', 0, null],
  ] }],
}

test('XLSX preserves filtered rows, numeric amounts, unknowns and inert source strings', () => {
  const book = buildReportWorkbook(report)
  const parsed = XLSX.read(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(parsed.Sheets.Vendas, { defval: null })
  assert.equal(rows.length, 3)
  assert.equal(rows[0].Valor, 125.35)
  assert.equal(rows[0].Telefone, '00123456789')
  assert.equal(rows[1].Valor, null)
  assert.equal(rows[2].Valor, 0)
  assert.equal(parsed.Sheets.Vendas.A2.f, undefined)
  assert.match(XLSX.utils.sheet_to_csv(parsed.Sheets.Contexto), /DevClub/)
})

test('CSV includes every sheet, escapes separators and neutralizes formula-like source text', () => {
  const csv = buildWorkbookCsv(buildReportWorkbook(report))
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes('"\'=HYPERLINK(""https://example.test"")";"125,35";"\'00123456789"'))
  assert.ok(csv.includes('"José; ""Silva""\nLinha 2";"";"\'+5511999999999"'))
  assert.ok(csv.includes('"Zero confirmado";"0";""'))
  assert.match(csv, /Contexto/)
  assert.match(csv, /2026-11-01 a 2026-11-23/)
})

test('PDF paginates long tables and wide columns without dropping final records', async () => {
  const headers = Array.from({ length: 12 }, (_, index) => `Coluna ${index}`)
  const rows = Array.from({ length: 45 }, (_, row) => headers.map((_, col) => `Registro ${row} campo ${col}`))
  rows[0][1] = 'texto longo '.repeat(450)
  const pdf = await buildWorkbookPdf(buildReportWorkbook({ title: 'Relatório', sheets: [{ name: 'Dados', headers, rows }] }))
  const source = pdf.output()
  assert.match(source, /^%PDF-/)
  assert.ok(pdf.getNumberOfPages() > 3)
  assert.ok(source.includes('Registro 44 campo 11'))
  assert.ok(source.includes('Coluna 11'))
})

test('export rejects unsupported formats before attempting a download', async () => {
  await assert.rejects(exportWorkbook(buildReportWorkbook(report), 'exe', { filename: 'vendas' }), /Formato/)
})

test('PDF keeps the subtraction meaning and Portuguese money formatting', async () => {
  const pdf = await buildWorkbookPdf(buildReportWorkbook({ title: 'Comparação', sheets: [{ name: 'Valores', headers: ['Variação A − B', 'Valor'], rows: [['Confirmada', { t: 'n', v: 1234.56, z: '"R$" #,##0.00' }]] }] }))
  assert.ok(pdf.output().includes('A - B'))
  assert.ok(pdf.output().includes('1.234,56'))
})
