import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { buildBuyerContactsCsv, buildBuyerContactsWorkbook, buildPeriodSalesWorkbook } from '../src/utils/periodSalesExport.js'

const options = { startDate: '2026-10-01', endDate: '2026-10-27', generatedAt: new Date('2026-10-28T01:00:00Z'), operationsStatus: 'ready', sources: [{ id: 'guru', label: 'Guru', kind: 'sale', status: 'ready' }] }
const sale = {
  id: 'guru:0001', externalId: '0001', sourceId: 'guru', platform: 'Guru', kind: 'sale', quantity: 1,
  date: '2026-10-02T01:30:00Z', buyerName: 'Cliente', buyerEmail: 'cliente@example.test', product: 'DevClub', family: 'DevClub', offer: 'Oferta outubro', payment: 'Pix',
  gross: 1200, net: 900.25, revenue: 1200, received: 1200, pending: null,
  sellerId: 's1', sellerName: 'Ana', attributionMethod: 'utm', attributionUtmSource: 'Comercial-Ana',
  utm: { source: 'Comercial-Ana', medium: 'WhatsApp', campaign: 'Outubro', content: 'video', term: 'convite' },
}
function roundtrip(records, changes = {}) {
  return XLSX.read(XLSX.write(buildPeriodSalesWorkbook(records, { ...options, ...changes }), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true, cellNF: true, UTC: true })
}
function table(sheet, range = 0) {
  return XLSX.utils.sheet_to_json(sheet, { range, defval: null, UTC: true })
}

test('Excel keeps all filtered records, every UTM, IDs, typed money and the São Paulo date', () => {
  const records = Array.from({ length: 25 }, (_, index) => ({ ...sale, id: `guru:${index}`, externalId: String(index).padStart(4, '0') }))
  records.push({ ...sale, id: 'refund:1', kind: 'refund', net: 50, revenue: 50, gross: 60, attributionMethod: 'unassigned', sellerId: null, sellerName: null })
  records.push({ ...sale, id: 'aggregate', isAggregate: true, quantity: 4, date: null })
  const workbook = roundtrip(records)
  assert.deepEqual(workbook.SheetNames, ['Comercial', 'Vendas'])
  const rows = table(workbook.Sheets.Vendas)
  assert.equal(rows.length, 27)
  assert.equal(rows[0]['ID na plataforma'], '0000')
  assert.equal(rows[0]['Receita operacional'], 900.25)
  assert.equal(rows[0]['Valor das vendas'], 900.25)
  assert.equal(rows[0].Recebido, 900.25)
  assert.equal(rows[0]['Categoria de pagamento'], 'Cartão')
  assert.equal(rows[0]['Pagamento original'], 'Pix')
  assert.equal(rows[0]['Data (Brasília)'].toISOString(), '2026-10-01T22:30:00.000Z')
  assert.equal(rows[0]['UTM Source'], 'Comercial-Ana')
  assert.equal(rows[0]['UTM Medium'], 'WhatsApp')
  assert.equal(rows[0]['UTM Campaign'], 'Outubro')
  assert.equal(rows[0]['UTM Content'], 'video')
  assert.equal(rows[0]['UTM Term'], 'convite')
  assert.equal(rows[25].Tipo, 'Reembolso')
  assert.equal(rows[25].Comercial, 'Não')
  assert.equal(rows[26]['Registro agregado'], 'Sim')
  assert.equal(rows[26].Quantidade, 4)
  assert.equal(rows[26].Comercial, 'Não')
  assert.equal(workbook.Sheets.Vendas['!autofilter'].ref, 'A1:AD28')
  assert.match(workbook.Sheets.Vendas.U2.z, /R\$/)
})

test('commercial totals reconcile with eligible details and preserve missing amounts', () => {
  const missing = { ...sale, id: 'guru:2', sellerId: null, sellerName: null, attributionMethod: 'unassigned', utm: { source: 'Comercial-SemVinculo' }, net: null }
  const workbook = roundtrip([sale, missing, { ...sale, id: 'guru:3', attributionMethod: 'unassigned', attributionUtmSource: null, utm: { source: 'organico' } }])
  const rows = table(workbook.Sheets.Comercial, 10)
  assert.equal(rows[0].Vendedor, 'TOTAL DO COMERCIAL')
  assert.equal(rows[0].Vendas, 2)
  assert.equal(rows[0]['Receita operacional'], 900.25)
  assert.match(rows[0]['Cobertura dos valores'], /Registros sem valor: receita 1/)
  const known = rows.find(row => row.Vendedor === 'Ana')
  assert.equal(known.Vendas, 1)
  assert.equal(known['Receita operacional'], 900.25)
  const unknown = rows.find(row => row.Vendedor === 'Sem vendedor vinculado')
  assert.equal(unknown['UTM Source'], 'Comercial-SemVinculo')
  assert.equal(unknown['Receita operacional'], null)
  assert.equal(unknown.Recebido, null)
  assert.equal(table(workbook.Sheets.Vendas)[1]['Receita operacional'], null)
  assert.equal(rows.slice(1).reduce((sum, row) => sum + (row['Receita operacional'] || 0), 0), rows[0]['Receita operacional'])
})

test('source strings that resemble formulas are preserved as inert text', () => {
  const values = ['=HYPERLINK("https://example.test","teste")', '+SUM(A1:A5)', '-100', '@SUM(A1:A5)', '\t=1+1']
  const workbook = roundtrip(values.map((value, index) => ({ ...sale, id: value, externalId: value, buyerName: value, buyerEmail: value, sellerName: value, utm: { source: 'Comercial-Ana', medium: value, campaign: value, content: value, term: value }, quantity: index + 1 })))
  const rows = table(workbook.Sheets.Vendas)
  for (let index = 0; index < values.length; index++) {
    assert.equal(rows[index].Cliente, values[index])
    assert.equal(rows[index]['UTM Campaign'], values[index])
    assert.equal(rows[index]['ID na plataforma'], values[index])
  }
  for (const sheet of Object.values(workbook.Sheets)) {
    for (const [key, cell] of Object.entries(sheet)) {
      if (!key.startsWith('!')) assert.equal(cell.f, undefined)
    }
  }
})

test('metadata records the applied scope, filters, date and unavailable attribution', () => {
  const workbook = roundtrip([sale], { scope: 'commercial', filters: { sellerId: 's1', source: 'Comercial-Ana', medium: '__not_informed__' }, offer: 'Oferta outubro', operationsStatus: 'unavailable', sources: [{ label: 'Guru', status: 'partial' }] })
  const sheet = workbook.Sheets.Comercial
  assert.equal(sheet.B2.v.toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(sheet.D2.v.toISOString(), '2026-10-27T00:00:00.000Z')
  assert.equal(sheet.B3.v.toISOString(), '2026-10-27T22:00:00.000Z')
  assert.equal(sheet.B4.v, 'Somente vendas do Comercial')
  assert.match(sheet.B5.v, /Vendedor: Ana/)
  assert.match(sheet.B5.v, /UTM Source: Comercial-Ana/)
  assert.match(sheet.B5.v, /UTM Medium: Não informado/)
  assert.match(sheet.B5.v, /Oferta: Oferta outubro/)
  assert.match(sheet.B6.v, /Resultado parcial/)
  assert.match(sheet.B6.v, /Guru: Parcial/)
  assert.match(sheet.B7.v, /Indisponíveis/)
})

test('metadata names every selected product, keeps commas inside names and labels the unknown product', () => {
  const workbook = roundtrip([sale], { filters: { product: ['DevClub', 'DevClub, Full Stack', '__not_informed__'] } })
  assert.match(workbook.Sheets.Comercial.B5.v, /Produto: DevClub; DevClub, Full Stack; Não informado/)
})

test('empty exports have headers and a true zero commercial count', () => {
  const workbook = roundtrip([])
  assert.equal(table(workbook.Sheets.Vendas).length, 0)
  const summary = table(workbook.Sheets.Comercial, 10)[0]
  assert.equal(summary.Vendas, 0)
  assert.equal(summary['Receita operacional'], 0)
  assert.equal(workbook.Sheets.Vendas.A1.v, 'Data (Brasília)')
})

test('refund-only exports cannot claim zero commercial sales when sales sources are unavailable', () => {
  const sources = [
    { id: 'guru', label: 'Guru', kind: 'sale', status: 'unavailable' },
    { id: 'guruRefunds', label: 'Reembolsos Guru', kind: 'refund', status: 'ready' },
    { id: 'manual', label: 'Vendas manuais', kind: 'sale', status: 'ready' },
    { id: 'asaas', label: 'Asaas', kind: 'sale', status: 'partial', salesAvailable: false },
  ]
  const workbook = roundtrip([{ ...sale, kind: 'refund', sourceId: 'guruRefunds' }], { sources })
  const summary = table(workbook.Sheets.Comercial, 10)[0]
  assert.equal(summary.Vendas, null)
  assert.equal(summary['Receita operacional'], null)
  assert.equal(summary['Valor das vendas'], null)
  assert.equal(summary.Líquido, null)
  assert.equal(summary.Recebido, null)
  assert.equal(summary['Cobertura dos valores'], 'Fontes de vendas indisponíveis')
  assert.match(workbook.Sheets.Comercial.A13.v, /indisponível/)
  assert.equal(table(workbook.Sheets.Vendas).length, 1)
})

test('missing UTM mappings mark an observed zero as partial and known sale rows establish availability', () => {
  const organic = { ...sale, attributionMethod: 'unassigned', attributionUtmSource: null, sellerId: null, sellerName: null, utm: { source: 'organico' } }
  const workbook = roundtrip([organic], { sources: [], attributionMappingsStatus: 'unavailable' })
  const summary = table(workbook.Sheets.Comercial, 10)[0]
  assert.equal(summary.Vendas, 0)
  assert.match(summary['Cobertura dos valores'], /Resultado parcial/)
  assert.match(workbook.Sheets.Comercial.A13.v, /Resultado parcial/)
  const explicitlyUnavailable = roundtrip([], { availableSales: false })
  assert.equal(table(explicitlyUnavailable.Sheets.Comercial, 10)[0].Vendas, null)
})

const buyers = {
  kind: 'buyers', period: { startDate: '2026-10-01', endDate: '2026-10-27' },
  filters: { platform: 'Guru', product: 'DevClub' }, status: 'ready', totalRows: 2,
  truncated: false, omittedAggregateRows: 0,
  rows: [
    { name: 'Ana', email: 'ana@example.test', phone: '+55011999990000', product: 'DevClub', platform: 'Guru', date: '2026-10-02T01:30:00Z' },
    { name: 'Bia', email: null, phone: '0012345', product: 'DevClub', platform: 'Guru', date: '2026-10-03' },
  ],
}

test('buyer Excel exports the displayed rows with text contacts and dates in Brasília', () => {
  const workbook = XLSX.read(XLSX.write(buildBuyerContactsWorkbook(buyers), { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer', cellDates: true, UTC: true })
  assert.deepEqual(workbook.SheetNames, ['Compradores', 'Contexto'])
  const rows = table(workbook.Sheets.Compradores)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].Nome, 'Ana')
  assert.equal(rows[0]['E-mail'], 'ana@example.test')
  assert.equal(rows[0].Telefone, '+55011999990000')
  assert.equal(rows[1].Telefone, '0012345')
  assert.equal(rows[1]['E-mail'], 'Não informado')
  assert.equal(rows[0]['Data (Brasília)'].toISOString(), '2026-10-01T22:30:00.000Z')
  assert.equal(rows[1]['Data (Brasília)'].toISOString(), '2026-10-03T00:00:00.000Z')
  assert.equal(workbook.Sheets.Compradores.C2.t, 's')
  assert.equal(workbook.Sheets.Compradores.C3.t, 's')
})

test('buyer workbook preserves incomplete coverage, truncation and the exact row count', () => {
  const workbook = buildBuyerContactsWorkbook({ ...buyers, status: 'partial', totalRows: 20, truncated: true, omittedAggregateRows: 3, notices: [{ title: 'Fonte com falha', message: 'Hotmart indisponível.' }] })
  assert.equal(table(workbook.Sheets.Compradores).length, 2)
  const context = XLSX.utils.sheet_to_json(workbook.Sheets.Contexto, { header: 1 })
  assert.ok(context.some(row => row[0] === 'Cobertura' && /parcial/i.test(row[1])))
  assert.ok(context.some(row => row[0] === 'Registros exportados' && row[1] === 2))
  assert.ok(context.some(row => row[0] === 'Registros encontrados' && row[1] === 20))
  assert.ok(context.some(row => row[0] === 'Limite' && /2 de 20/.test(row[1])))
  assert.ok(context.some(row => row[0] === 'Registros agregados excluídos' && row[1] === 3))
  assert.ok(context.some(row => row[0] === 'Filtros aplicados' && /Guru.*DevClub/.test(row[1])))
  assert.ok(context.some(row => row[0] === 'Fonte com falha' && row[1] === 'Hotmart indisponível.'))
})

test('buyer exports retain missing fields and write formula-like content as inert cells', () => {
  const rows = ['=1+1', '+SUM(A1)', '-SUM(A1)', '@SUM(A1)', '\t=1+1', '\r=1+1', ' \n=1+1'].map(value => ({ name: value, email: value, phone: value, product: value, platform: value, date: null }))
  const workbook = buildBuyerContactsWorkbook({ ...buyers, rows })
  for (const sheet of Object.values(workbook.Sheets)) {
    for (const [key, cell] of Object.entries(sheet)) if (!key.startsWith('!')) assert.equal(cell.f, undefined)
  }
  assert.equal(workbook.Sheets.Compradores.A2.v, '=1+1')
  assert.equal(workbook.Sheets.Compradores.F2.v, 'Não informado')
  const csv = buildBuyerContactsCsv({ ...buyers, rows })
  for (const value of rows) assert.ok(csv.includes(`"'${value.name.replaceAll('"', '""')}"`))
})

test('buyer CSV uses UTF-8 BOM, semicolons, CRLF, quoted values and safe text phones', () => {
  const csv = buildBuyerContactsCsv({ ...buyers, rows: [{ ...buyers.rows[0], name: 'Ana; "Clube"\nSilva' }, buyers.rows[1]] })
  assert.ok(csv.startsWith('\uFEFF"Nome";"E-mail";"Telefone";"Produto";"Plataforma";"Data (Brasília)"\r\n'))
  assert.ok(csv.includes('"Ana; ""Clube""\nSilva";"ana@example.test";"\'+55011999990000"'))
  assert.ok(csv.includes('"Bia";"Não informado";"\'0012345"'))
  assert.ok(csv.includes('"01/10/2026 22:30:00"'))
  assert.ok(csv.includes('"03/10/2026"'))
})

test('empty buyer exports retain headers without inventing contacts', () => {
  const block = { ...buyers, rows: [], totalRows: 0 }
  assert.equal(table(buildBuyerContactsWorkbook(block).Sheets.Compradores).length, 0)
  assert.equal(buildBuyerContactsCsv(block).split('\r\n').length, 2)
})
