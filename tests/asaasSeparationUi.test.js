import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'

const project = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../package.json', import.meta.url))
let runtime, directory
const range = { startDate: '2026-10-01', endDate: '2026-10-31' }
const receipt = (saleDate, received, receiptDate = '2026-10-10', count = 1) => ({ saleDate, received, receiptDate, count })
const source = (rows, extra = {}) => {
  const gross = rows.reduce((sum, row) => sum + row.received, 0)
  return { id: 'asaas', kind: 'sale', platform: 'Asaas', status: 'partial', salesAvailable: false, reason: 'checkout_disabled',
    cash: { gross, net: gross - 10, fees: 10, count: rows.reduce((sum, row) => sum + row.count, 0), availablePeriods: 1, periods: 1 },
    cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: 'ready', rows }, ...extra }
}
before(async () => {
  directory = await mkdtemp(join(tmpdir(), 'asaas-separation-ui-'))
  const contents = `import React from'react';import{renderToStaticMarkup}from'react-dom/server';import Panel from '${project}src/components/daily/AsaasCashPanel.jsx';export{React,renderToStaticMarkup,Panel};`
  const result = await build({ stdin: { contents, resolveDir: project, sourcefile: 'asaas-separation-test.jsx', loader: 'jsx' }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'external-package-paths', setup(builder) {
    builder.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('node:') ? undefined : ({ path: require.resolve(args.path), external: true }))
  } }] })
  const entry = join(directory, 'entry.mjs')
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})
after(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
function render(sources, props = {}) {
  const html = runtime.renderToStaticMarkup(runtime.React.createElement(runtime.Panel, { sources, ...range, monthlyHighlight: true, ...props }))
  const dom = new JSDOM(html)
  const highlight = dom.window.document.querySelector('[data-testid="monthly-asaas-invoices"]')
  const value = id => highlight?.querySelector(`[data-metric="monthly-${id}"] .financial-value-content`)?.textContent.replace(/\s/g, ' ')
  return { dom, highlight, value }
}

test('monthly highlight shows only confirmed older-sale receipts before fees and separates the statement and unknown origins', () => {
  const data = source([receipt('2026-09-20', 100), receipt('2026-10-01', 200), receipt(null, 50)])
  const original = JSON.stringify(data)
  const { dom, highlight, value } = render([data])
  assert.ok(highlight)
  assert.match(highlight.textContent, /Recebimentos de faturas Asaas/)
  assert.match(highlight.textContent, /antes das taxas/)
  assert.match(highlight.textContent, /Subtotal parcial/)
  assert.equal(value('previous-receipts'), 'R$ 100,00')
  assert.equal(value('previous-count'), '1')
  assert.equal(value('receipts-gross'), 'R$ 350,00')
  assert.equal(value('receipts-count'), '3')
  assert.equal(value('unclassified-receipts'), 'R$ 50,00')
  assert.equal(value('unclassified-count'), '1')
  assert.match(highlight.textContent, /separado.*cash collected principal.*metas/)
  assert.equal(JSON.stringify(data), original, 'The existing financial sources are not mutated')
  assert.match(dom.window.document.querySelector('[data-metric="receipts-gross"]').textContent, /350,00/, 'The existing statement total is preserved')
  dom.window.close()
})
test('checkout-disabled or legacy origins cannot present unknown old invoices as a known zero', () => {
  for (const origins of [undefined, { schemaVersion: 1, basis: 'checkout_created_at', status: 'unavailable', reason: 'checkout_disabled', rows: [receipt(null, 1255.36, '2026-10-15', 6)] }]) {
    const { dom, highlight, value } = render([source([receipt(null, 1255.36, '2026-10-15', 6)], { cashReceiptOrigins: origins })])
    assert.equal(value('previous-receipts'), 'Não informado')
    assert.equal(value('previous-count'), 'Não informado')
    assert.equal(value('receipts-gross'), 'R$ 1.255,36')
    assert.equal(value('unclassified-receipts'), 'R$ 1.255,36')
    assert.equal(value('unclassified-count'), '6')
    assert.match(highlight.textContent, /Não foi possível confirmar quais recebimentos/)
    assert.equal(dom.window.document.querySelector('[data-metric="receipts-previousPeriods"] .financial-value-content').textContent, 'Não informado', 'The monthly breakdown cannot contradict the highlighted unknown origin')
    dom.window.close()
  }
})
test('confirmed current-sale receipts plus unknown invoices do not establish zero old-sale invoices', () => {
  const { dom, value } = render([source([receipt('2026-10-01', 200), receipt(null, 50)])])
  assert.equal(value('previous-receipts'), 'Não informado')
  assert.equal(value('previous-count'), 'Não informado')
  assert.equal(value('unclassified-receipts'), 'R$ 50,00')
  dom.window.close()
})
test('an authoritative empty statement is a real zero, while an unavailable source remains unknown', () => {
  const empty = render([source([])])
  assert.equal(empty.value('previous-receipts'), 'R$ 0,00')
  assert.equal(empty.value('previous-count'), '0')
  assert.equal(empty.value('unclassified-receipts'), 'R$ 0,00')
  empty.dom.window.close()
  const unavailable = render([{ id: 'asaas', kind: 'sale', status: 'unavailable', salesAvailable: false }])
  assert.equal(unavailable.value('previous-receipts'), 'Não informado')
  assert.equal(unavailable.value('receipts-gross'), 'Não informado')
  unavailable.dom.window.close()
})
test('the selected calendar month uses payment dates and distinguishes a sale made on the previous month boundary', () => {
  const { dom, value } = render([source([receipt('2026-10-31', 175, '2026-11-01'), receipt('2026-11-01', 225, '2026-11-01')])], { startDate: '2026-11-01', endDate: '2026-11-30' })
  assert.equal(value('previous-receipts'), 'R$ 175,00')
  assert.equal(value('previous-count'), '1')
  assert.equal(value('receipts-gross'), 'R$ 400,00')
  dom.window.close()
  const outside = render([source([receipt('2026-09-01', 175, '2026-11-01')])])
  assert.equal(outside.value('previous-receipts'), 'Não informado', 'A payment outside the selected month cannot be classified as its prior-sale cash')
  outside.dom.window.close()
})
test('product and campaign filters hide unallocated statement values and other platforms hide the highlight', () => {
  for (const filters of [{ family: 'MBA' }, { product: 'DevClub' }, { payment: 'Boleto' }, { source: 'campanha' }, { offer: 'oferta' }]) {
    const { dom, highlight, value } = render([source([receipt('2026-09-01', 350)])], { filters })
    assert.equal(value('previous-receipts'), 'Não informado')
    assert.equal(value('receipts-gross'), 'Não informado')
    assert.equal(value('unclassified-receipts'), 'Não informado')
    assert.match(highlight.textContent, /sem distribuição para estes filtros/)
    dom.window.close()
  }
  const other = render([source([receipt('2026-09-01', 350)])], { filters: { platform: 'Guru' } })
  assert.equal(other.highlight, null)
  other.dom.window.close()
})
test('the highlight is monthly-only and loading never creates a visible zero', () => {
  const ordinary = render([source([])], { monthlyHighlight: false })
  assert.equal(ordinary.highlight, null)
  ordinary.dom.window.close()
  const pending = render([], { ready: false, loading: true })
  assert.ok(pending.highlight)
  assert.equal(pending.highlight.querySelector('[data-metric="monthly-previous-receipts"] .financial-value').getAttribute('data-state'), 'loading')
  assert.doesNotMatch(pending.highlight.textContent, /R\$\s*0,00/)
  pending.dom.window.close()
})

test('the monthly panel explains original Asaas installment provenance and keeps unsupported origins unknown', () => {
  const rows = [{ ...receipt('2026-09-01', 350), saleDateBasis: 'asaas_installment_created_at' }, { ...receipt('2026-09-01', 50), saleDateBasis: 'invoice_created_at' }]
  const { dom, highlight, value } = render([source(rows, { cashReceiptOrigins: { schemaVersion: 2, basis: 'sale_created_at', status: 'partial', rows } })])
  assert.equal(value('previous-receipts'), 'R$ 350,00')
  assert.equal(value('previous-count'), '1')
  assert.equal(value('unclassified-receipts'), 'R$ 50,00')
  assert.match(highlight.textContent, /Subtotal parcial/)
  const criteria = dom.window.document.querySelector('.asaas-cash-details').textContent
  assert.match(criteria, /data de criação do parcelamento original no Asaas/)
  assert.match(criteria, /checkout confirmado/)
  assert.match(criteria, /emissão ou vencimento da fatura não é tratada como data da venda/)
  dom.window.close()
  const unknownRows = [{ ...receipt('2026-09-01', 350), saleDateBasis: null }]
  const unknown = render([source(unknownRows, { cashReceiptOrigins: { schemaVersion: 2, basis: 'sale_created_at', status: 'unavailable', rows: unknownRows } })])
  assert.equal(unknown.value('previous-receipts'), 'Não informado')
  assert.equal(unknown.value('unclassified-receipts'), 'R$ 350,00')
  unknown.dom.window.close()
})
