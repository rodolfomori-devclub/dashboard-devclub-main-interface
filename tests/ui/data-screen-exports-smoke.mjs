// Every API response is a local fixture; downloads never query a provider.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import * as XLSX from 'xlsx'
import { emptyProviderPayload } from './period-cache-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = process.env.UI_ARTIFACTS_DIR || await fs.mkdtemp(join(tmpdir(), 'data-screen-exports-'))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`, day = '2026-11-23'
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'data-exports-fixture', VITE_VAULT_REDIRECT_URI: `${base}/callback` }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = '', browser, page
server.stdout.on('data', chunk => { output = (output + chunk).slice(-3000) })
server.stderr.on('data', chunk => { output = (output + chunk).slice(-3000) })
const errors = [], calls = []
const sellers = [{ id: 'ana', name: 'Ana' }, { id: 'bia', name: 'Bia' }]
const mappings = sellers.map(seller => ({ utmSource: `comercial-${seller.id}`, sellerId: seller.id, sellerName: seller.name, enabled: true, revision: 1 }))
const ledger = { attributions: [], manualSales: [], utmMappings: mappings, attributionMappingsStatus: 'ready' }
const refunds = Array.from({ length: 44 }, (_, index) => ({ id: `refund-${index}`, name: `Cliente ${index}`, email: `cliente${index}@example.test`, contact: '+5511999990000', product: index < 42 ? 'MBA' : 'DevClub', platform: 'guru', sources: ['guru'], kind: 'confirmed', status: 'refunded', referenceDate: day, dateBasis: 'refund', saleAmount: index ? 90 : 0, saleNetAmount: index ? 90 : 0, refundAmount: index ? null : 0, currency: 'BRL' }))
const overview = { data: refunds, sources: [{ id: 'guru', status: 'partial', recordCount: 44, message: 'Cobertura parcial de teste.' }], incomplete: true, deduplication: { removed: 0 }, excludedUndated: 2, generatedAt: `${day}T15:00:00Z` }
const guruSales = Array.from({ length: 56 }, (_, index) => ({ hash: `sale-${index}`, status: 'approved', product: { name: 'MBA' }, contact: { name: `Comprador ${index}`, email: `buyer${index}@example.test` }, payment: { method: 'pix', total: 100 + index, currency: 'BRL' }, calculation_details: { total_amount: 100 + index, net_amount: 90 + index }, dates: { created_at: Date.parse(`${day}T15:00:00Z`) / 1000 }, trackings: { utm_source: index < 30 ? 'comercial-ana' : 'comercial-bia' } }))
const providerPaths = { '/api/refunds': 'guruRefunds', '/api/hotmart/vendas': 'hotmart', '/api/hotmart/reembolsos': 'hotmartRefunds', '/api/hubla/vendas': 'hubla', '/api/hubla/reembolsos': 'hublaRefunds', '/api/boleto/vendas/data': 'tmb', '/api/boleto/asaas/vendas': 'asaas', '/api/boleto/boletex/vendas': 'boletex' }

try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base)).ok } catch { /* The local Vite server is starting. */ }
    if (ready) break
    if (server.exitCode !== null) throw new Error(output)
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, output)
  await fs.mkdir(out, { recursive: true })
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256' })}.${encode({ sub: 'fixture', exp: 4102444800 })}.fixture`)
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== base) { errors.push(`External request: ${url.origin}`); await route.abort(); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    calls.push(url.pathname)
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', name: 'Exportações de teste', permissions: ['refunds', 'attribution'], isAdmin: false } }
    else if (url.pathname === '/api/refunds/overview') body = overview
    else if (url.pathname === '/api/transactions') body = { data: guruSales }
    else if (providerPaths[url.pathname]) body = emptyProviderPayload(providerPaths[url.pathname])
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: ledger }
    else if (url.pathname === '/api/sales-ops/sellers') body = { data: sellers }
    else if (url.pathname === '/api/sales-ops/utm-mappings') body = { data: { available: true, mappings } }
    else { errors.push(`Unexpected API: ${request.method()} ${url.pathname}`); await route.abort(); return }
    assert.ok(request.method() === 'GET' || ['/api/transactions', '/api/refunds'].includes(url.pathname), 'Only read operations are allowed')
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) })
  })
  page = await context.newPage()
  await page.clock.setFixedTime(new Date(`${day}T16:00:00-03:00`))
  page.on('pageerror', error => errors.push(error.message))
  async function downloads({ prefix, sheet, count, first, last, excluded }) {
    const requestsBefore = calls.length
    for (const [label, extension] of [['Excel (.xlsx)', 'xlsx'], ['CSV', 'csv'], ['PDF', 'pdf']]) {
      await page.getByRole('button', { name: 'Exportar', exact: true }).click()
      const pending = page.waitForEvent('download')
      await page.getByRole('group', { name: 'Formatos de exportação' }).getByRole('button', { name: label, exact: true }).click()
      const download = await pending
      assert.match(download.suggestedFilename(), new RegExp(`^${prefix}.*\\.${extension}$`))
      const bytes = await fs.readFile(await download.path())
      if (extension === 'xlsx') {
        const workbook = XLSX.read(bytes, { type: 'buffer' })
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { defval: null })
        assert.equal(rows.length, count)
        assert.equal(rows[0]['ID do registro'], first)
        assert.equal(rows.at(-1)['ID do registro'], last)
        assert.equal(rows.some(row => row['ID do registro'] === excluded), false)
        if (sheet === 'Registros') {
          assert.equal(rows[0]['Valor da venda'], 0)
          assert.equal(rows[1]['Valor efetivamente devolvido'], null)
          assert.match(JSON.stringify(XLSX.utils.sheet_to_json(workbook.Sheets.Contexto, { header: 1 })), /Dados parciais/)
        } else assert.ok(rows.every(row => row.Vendedor === 'Ana'))
      } else if (extension === 'csv') {
        assert.deepEqual([...bytes.subarray(0, 3)], [239, 187, 191])
        assert.ok(bytes.toString('utf8').includes(`"${first}"`))
        assert.ok(bytes.toString('utf8').includes(`"${last}"`))
        assert.ok(!bytes.toString('utf8').includes(`"${excluded}"`))
      } else {
        assert.equal(bytes.subarray(0, 5).toString(), '%PDF-')
        assert.ok(bytes.toString('latin1').includes(first))
        assert.ok(bytes.toString('latin1').includes(last))
        assert.ok(!bytes.toString('latin1').includes(excluded))
      }
    }
    assert.equal(calls.length, requestsBefore, 'Downloads use exactly the filtered snapshot already loaded')
  }
  async function captureMenu(name) {
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.getByRole('button', { name: 'Exportar', exact: true }).click()
      const box = await page.getByRole('group', { name: 'Formatos de exportação' }).boundingBox()
      assert.ok(box.x >= 0 && box.x + box.width <= width, `${name}: menu fits ${width}px`)
      await page.screenshot({ path: `${out}/${name}-${width}.png`, animations: 'disabled' })
      await page.keyboard.press('Escape')
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
  await page.goto(`${base}/reembolsos?startDate=${day}&endDate=${day}`, { waitUntil: 'networkidle' })
  await page.getByLabel('Produto', { exact: true }).selectOption('MBA')
  await expect(page.getByText('42 registros encontrados', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click()
  await page.getByRole('button', { name: 'Próxima página', exact: true }).click()
  await page.getByLabel('De', { exact: true }).fill('2026-10-01')
  await captureMenu('reembolsos')
  await downloads({ prefix: `reembolsos-${day}-${day}`, sheet: 'Registros', count: 42, first: 'refund-0', last: 'refund-41', excluded: 'refund-42' })
  await page.getByLabel('Buscar', { exact: true }).fill('inexistente')
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeDisabled()

  await page.goto(`${base}/atribuicao`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Atribuição e conciliação', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'Vendedor', exact: true }).selectOption('ana')
  await expect(page.getByText('30 registros', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Próxima', exact: true }).click()
  await captureMenu('atribuicao')
  await downloads({ prefix: `atribuicao-${day}-${day}`, sheet: 'Vendas para atribuição', count: 30, first: 'guru:sale-0', last: 'guru:sale-29', excluded: 'guru:sale-30' })
  await page.getByLabel('Buscar venda', { exact: true }).fill('inexistente')
  await expect(page.getByRole('button', { name: 'Exportar', exact: true })).toBeDisabled()
  assert.deepEqual(errors, [])
  process.stdout.write(`${JSON.stringify({ result: 'passed', checks: ['Refunds: applied period, filtered 42 rows across 3 pages, partial coverage and missing values', 'Attribution: seller-filtered 30 rows across 2 pages, all three formats', 'Disabled empty exports and menus at 360/1440px'], artifacts: out })}\n`)
} catch (error) {
  if (page) { await page.screenshot({ path: `${out}/failure.png`, animations: 'disabled' }); process.stderr.write(`${JSON.stringify({ errors, page: await page.locator('body').innerText(), artifacts: out })}\n`) }
  throw error
} finally { await browser?.close(); server.kill('SIGTERM') }
