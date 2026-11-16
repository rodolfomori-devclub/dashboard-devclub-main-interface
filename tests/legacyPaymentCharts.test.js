import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { CHART_COLORS } from '../src/styles/designTokens.js'

const project = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../package.json', import.meta.url))
let directory, runtime, dom, root

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>')
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node']) globalThis[name] = dom.window[name]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  directory = await mkdtemp(join(tmpdir(), 'legacy-payment-charts-'))
  const contents = `import React,{act}from'react';import{createRoot}from'react-dom/client';import Payment from '${project}src/components/PaymentMethodAnalysis.jsx';import Refund from '${project}src/components/RefundDetailsModal.jsx';export{React,act,createRoot,Payment,Refund};`
  const result = await build({ stdin: { contents, resolveDir: project, sourcefile: 'legacy-payment-test.jsx', loader: 'jsx' }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', plugins: [{ name: 'chart-fixtures', setup(builder) {
    builder.onResolve({ filter: /^recharts$/ }, () => ({ path: 'charts', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `import React from 'react';const Chart=({children})=><div>{children}</div>;export const Cell=({fill})=><span data-cell-color={fill}/>;export const BarChart=Chart,Bar=Chart,PieChart=Chart,Pie=Chart,XAxis=Chart,YAxis=Chart,ScatterChart=Chart,Scatter=Chart,ZAxis=Chart,CartesianGrid=Chart,Tooltip=Chart,Legend=Chart,ResponsiveContainer=Chart;`, loader: 'jsx', resolveDir: project }))
    builder.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('node:') ? undefined : ({ path: require.resolve(args.path), external: true }))
  } }] })
  const entry = join(directory, 'entry.mjs')
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})

afterEach(async () => { if (root) { await runtime.act(async () => root.unmount()); root = null } })
after(async () => { dom?.window.close(); if (directory) await rm(directory, { recursive: true, force: true }) })

test('payment charts render populated categories and cycle through the shared palette', async () => {
  const salesData = Array.from({ length: CHART_COLORS.length + 1 }, (_, index) => ({ paymentMethod: `Método ${index}`, value: 100 }))
  root = runtime.createRoot(document.getElementById('root'))
  await runtime.act(async () => root.render(runtime.React.createElement(runtime.Payment, { salesData })))
  const colors = [...document.querySelectorAll('[data-cell-color]')].map(cell => cell.getAttribute('data-cell-color'))
  const expected = salesData.map((_, index) => CHART_COLORS[index % CHART_COLORS.length])
  assert.deepEqual(colors, [...expected, ...expected])
  assert.match(document.body.textContent, /Total de Vendas9/)
})

test('refund details open with populated products and preserve the close action', async () => {
  let closed = false
  const refundsData = [{ id: 'refund', product: { name: 'DevClub' }, calculation_details: { net_amount: 100 }, dates: { created_at: 1793876400 } }]
  root = runtime.createRoot(document.getElementById('root'))
  await runtime.act(async () => root.render(runtime.React.createElement(runtime.Refund, { isOpen: true, onClose: () => { closed = true }, refundsData })))
  assert.equal(document.querySelector('[data-cell-color]').getAttribute('data-cell-color'), CHART_COLORS[0])
  assert.match(document.body.textContent, /DevClub/)
  await runtime.act(async () => document.querySelector('button').click())
  assert.equal(closed, true)
})
