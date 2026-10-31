// All business responses are synthetic. No production API or customer data is used.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { emptyProviderPayload } from './period-cache-fixture.mjs'
import { readPublishedVault } from './published-vault.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const output = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/commercial-export', import.meta.url))
await fs.mkdir(output, { recursive: true })
let base = process.env.DASHBOARD_SMOKE_URL
let server, browser, serverOutput = ''
if (!base) {
  assert.equal(published, false, 'Published mode requires an explicit URL')
  const socket = createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const port = socket.address().port
  await new Promise(resolve => socket.close(resolve))
  base = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: root,
    env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'commercial-fixture', VITE_VAULT_REDIRECT_URI: `${base}/callback` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  for (const stream of [server.stdout, server.stderr]) stream.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-4000) })
}
const today = '2026-10-27'
const date = `${today}T12:00:00-03:00`
let scenario = 'ready'
const calls = [], errors = [], unexpected = [], blocked = [], checks = []
const applicationAssets = new Map()
let publishedAssets = null
const mappings = [
  { utmSource: 'Comercial-Ana', sellerId: 'ana', sellerName: 'Ana Silva', enabled: true },
  { utmSource: 'parceiro-ana', sellerId: 'ana', sellerName: 'Ana Silva', enabled: true },
]
const guruSale = (id, value, source, product = 'DevClub Full Stack') => ({
  hash: id, product: { name: product }, contact: { name: `Cliente ${id}`, email: `${id}@example.test` },
  dates: { created_at: Date.parse(date) / 1000 }, payment: { method: 'credit_card', total: value + 10 },
  calculation_details: { net_amount: value, total_amount: value + 10, net_affiliate_value: 0, discounts: { fee: 10 } },
  trackings: { utm_source: source, utm_medium: 'whatsapp', utm_campaign: 'Turma outubro', utm_content: '=HYPERLINK("https://example.test")', utm_term: 'Termo da campanha' },
})
const guru = [
  ...Array.from({ length: 25 }, (_, index) => guruSale(`ana-${index + 1}`, 100, 'Comercial-Ana')),
  guruSale('override', 300, 'Comercial-Ana'),
  guruSale('unmapped', 400, 'Comercial-SemCadastro'),
  guruSale('organic', 200, 'youtube'),
  guruSale('alias', 500, 'parceiro-ana', 'MBA em Inteligência Artificial'),
]
function payload(id) {
  if (scenario === 'empty') return emptyProviderPayload(id)
  if (id === 'guru') return { data: guru }
  if (id === 'guruRefunds') return { data: [guruSale('refund', 50, 'Comercial-Ana')] }
  if (id === 'hotmart') return { success: true, data: { count: 1, totalNet: 600, totalGross: 610, totalFees: 10, transactions: [
    { transaction: 'hotmart-ana', product: 'DevClub Full Stack', buyer: 'Cliente Hotmart', buyerEmail: 'hotmart@example.test', netValue: 600, grossValue: 610, fee: 10, orderDate: date, paymentMethod: 'PIX', currency: 'BRL', utm: { source: 'Comercial-Ana', medium: 'whatsapp', campaign: 'Turma outubro', content: 'hotmart-content', term: 'hotmart-term' } },
  ] } }
  return emptyProviderPayload(id)
}
function ledger() {
  return { manualSales: [], attributionMappingsStatus: scenario === 'mappings-unavailable' ? 'unavailable' : 'ready', utmMappings: scenario === 'mappings-unavailable' ? [] : mappings,
    attributions: [{ id: 'override-assignment', source: 'guru', externalId: 'override', sellerId: 'bruno', sellerName: 'Bruno Souza', status: 'assigned' }] }
}
const sheetRows = sheet => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null })
const locateTable = (sheet, required) => {
  const rows = sheetRows(sheet)
  const index = rows.findIndex(row => required.every(label => row.includes(label)))
  assert.ok(index >= 0, `Workbook table must include ${required.join(', ')}`)
  const headers = rows[index]
  return { headers, rows: rows.slice(index + 1).filter(row => row.some(value => value !== null)), index }
}
try {
  if (server) {
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(base)).ok } catch { /* local startup */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  let vault = { vaultUrl: base, clientId: 'commercial-fixture' }
  if (published) {
    assert.equal(new URL(base).origin, base, 'Published URL must be an origin without a path')
    const health = await fetch(`${base}/health`, { credentials: 'omit', redirect: 'error', cache: 'no-store' })
    assert.equal(health.status, 200, 'Published frontend health must be available')
    const response = await fetch(`${base}/global`, { credentials: 'omit', redirect: 'error', cache: 'no-store' })
    assert.equal(response.status, 200, 'Published Global page must be available')
    const html = await response.text()
    const main = html.match(/src="([^" ]*\/assets\/(?:main|index)-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Published entry asset exists')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
    const config = await readPublishedVault({ base, main })
    vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
    publishedAssets = { main, healthStatus: health.status, publicVaultConfigured: true, callbackOrigin: new URL(config.redirectUri).origin }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined })
  if (published) {
    const anonymous = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', serviceWorkers: 'block' })
    if (anonymous.routeWebSocket) await anonymous.routeWebSocket('**/*', () => {})
    await anonymous.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url())
      const publicPath = url.pathname === '/global' || url.pathname.startsWith('/assets/')
        || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
      if (url.origin === base && request.method() === 'GET' && publicPath) await route.continue()
      else await route.abort()
    })
    const loginPage = await anonymous.newPage()
    await loginPage.goto(`${base}/global`, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await loginPage.getByRole('button', { name: 'Entrar pelo Vault', exact: true }).waitFor({ timeout: 30000 })
    assert.equal(await loginPage.evaluate(() => localStorage.getItem('vault_access_token')), null, 'Anonymous login check must not use a token')
    await loginPage.screenshot({ path: `${output}/global-anonymous.png`, animations: 'disabled' })
    checks.push({ check: 'published health and anonymous Vault entry', healthStatus: 200, callbackOrigin: publishedAssets.callbackOrigin, realLoginPerformed: false })
    await anonymous.close()
  }
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.addInitScript(({ vaultUrl, clientId }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture', iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
  }, vault)
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    // Published mode fetches public assets only. All business requests are
    // intercepted before origin checks because the API uses a separate host.
    if (!url.pathname.startsWith('/api/')) {
      const publicPath = url.pathname === '/global' || url.pathname.startsWith('/assets/')
        || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
      if (url.origin !== base || request.method() !== 'GET' || (published && !publicPath)) {
        blocked.push({ origin: url.origin, method: request.method(), resource: request.resourceType() })
        await route.abort(); return
      }
      await route.continue(); return
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }); return
    }
    calls.push(url.pathname)
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'qa@example.test', name: 'QA Comercial', permissions: ['daily'], isAdmin: true } }
    else if (url.pathname === '/api/transactions') body = payload('guru')
    else if (url.pathname === '/api/refunds') body = payload('guruRefunds')
    else if (url.pathname === '/api/hotmart/vendas') body = payload('hotmart')
    else if (['/api/hubla/vendas', '/api/hubla/reembolsos'].includes(url.pathname)) body = { success: true, data: { financialSchemaVersion: 2, count: 0, totalNet: 0, totalGross: 0, totalFees: 0, transactions: [] } }
    else if (url.pathname === '/api/hotmart/reembolsos') body = payload('hotmartRefunds')
    else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payload('tmb')
    else if (url.pathname === '/api/boleto/asaas/vendas') body = payload('asaas')
    else if (url.pathname === '/api/boleto/boletex/vendas') body = payload('boletex')
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: ledger() }
    else { unexpected.push(url.pathname); await route.abort(); return }
    const method = ['/api/transactions', '/api/refunds'].includes(url.pathname) ? 'POST' : 'GET'
    if (request.method() !== method) { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base }, body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30000)
  page.setDefaultNavigationTimeout(60000)
  await page.clock.setFixedTime(new Date(`${today}T16:00:00-03:00`))
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() })
  })
  const commercial = () => page.getByRole('region', { name: 'Resultado do Comercial', exact: true })
  const navigate = async (width = 1440) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/global`, { waitUntil: 'domcontentloaded' })
    await commercial().waitFor()
    await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
  }
  const exportBook = async (button, filename) => {
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: button, exact: true }).click()
    const download = await pending
    assert.match(download.suggestedFilename(), /\.xlsx$/)
    const path = `${output}/${filename}.xlsx`
    await download.saveAs(path)
    const bytes = await fs.readFile(path)
    assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'Real XLSX ZIP container')
    const book = XLSX.read(bytes, { type: 'buffer', cellDates: true })
    assert.deepEqual(book.SheetNames, ['Comercial', 'Vendas'])
    return book
  }
  const setProducts = async values => {
    const control = page.locator('#period-product')
    if (await control.evaluate(element => element.tagName) === 'SELECT') {
      assert.ok(values.length <= 1, 'Legacy product selector accepts one product')
      await control.selectOption(values[0] || '')
      return
    }
    await control.click()
    await page.getByRole('button', { name: 'Todos os produtos', exact: true }).click()
    for (const value of values) await page.getByRole('group', { name: 'Produtos disponíveis', exact: true }).getByRole('checkbox', { name: value, exact: true }).check()
    await page.getByRole('button', { name: 'Concluir', exact: true }).click()
  }
  await navigate()
  assert.match(await commercial().innerText(), /Ana Silva/)
  assert.match(await commercial().innerText(), /Bruno Souza/)
  assert.match(await commercial().innerText(), /Sem vendedor vinculado/)
  assert.match(await commercial().innerText(), /Comercial-SemCadastro/)
  assert.match((await commercial().innerText()).replace(/\s/g, ''), /4\.300,00/)
  const override = commercial().getByRole('row').filter({ hasText: 'Bruno Souza' })
  assert.match(await override.innerText(), /300,00/)
  const book = await exportBook('Exportar Excel', 'all-records')
  const detail = locateTable(book.Sheets.Vendas, ['UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term'])
  assert.equal(detail.rows.length, 31, 'All 30 sales plus refund, beyond the UI page size')
  const utmContent = detail.headers.indexOf('UTM Content')
  const formulaRow = detail.rows.findIndex(row => row[utmContent] === '=HYPERLINK("https://example.test")')
  assert.ok(formulaRow >= 0, 'Full original UTM content is retained')
  const formulaCell = book.Sheets.Vendas[XLSX.utils.encode_cell({ r: detail.index + formulaRow + 1, c: utmContent })]
  assert.equal(formulaCell.t, 's')
  assert.equal(formulaCell.f, undefined)
  const commercialBook = await exportBook('Exportar Comercial', 'commercial-only')
  const commercialDetail = locateTable(commercialBook.Sheets.Vendas, ['UTM Source', 'Receita operacional'])
  assert.equal(commercialDetail.rows.length, 29, 'Commercial export excludes organic sale and refund')
  assert.equal(commercialDetail.rows.reduce((sum, row) => sum + row[commercialDetail.headers.indexOf('Receita operacional')], 0), 4300, 'Commercial detail reconciles with dashboard')
  const commercialSummary = locateTable(commercialBook.Sheets.Comercial, ['Vendedor', 'UTM Source', 'Receita operacional'])
  const total = commercialSummary.rows.find(row => row[0] === 'TOTAL DO COMERCIAL')
  assert.equal(total[commercialSummary.headers.indexOf('Receita operacional')], 4300, 'Workbook summary reconciles with transaction rows')
  checks.push({ check: 'desktop and XLSX downloads', records: 31, commercialSales: 29, commercialRevenue: 4300, formulaLikeUtmIsText: true })
  const beforeFilterCalls = calls.length
  await page.getByRole('combobox', { name: 'Vendedor', exact: true }).selectOption('bruno')
  assert.match((await commercial().innerText()).replace(/\s/g, ''), /300,00/)
  const filteredBook = await exportBook('Exportar Excel', 'seller-filtered')
  const filteredDetail = locateTable(filteredBook.Sheets.Vendas, ['UTM Source'])
  assert.equal(filteredDetail.rows.length, 1)
  assert.ok(filteredDetail.rows[0].includes('Bruno Souza'))
  assert.equal(calls.length, beforeFilterCalls, 'Seller filter and export reuse the loaded records')
  await page.getByRole('combobox', { name: 'Vendedor', exact: true }).selectOption('')
  await setProducts(['MBA em Inteligência Artificial'])
  const productBook = await exportBook('Exportar Comercial', 'product-filtered')
  assert.equal(locateTable(productBook.Sheets.Vendas, ['UTM Source']).rows.length, 1)
  await setProducts([])
  const multiProductFilter = await page.locator('#period-product').evaluate(element => element.tagName === 'BUTTON')
  if (multiProductFilter) {
    await setProducts(['MBA em Inteligência Artificial', 'DevClub Full Stack'])
    const multiProductBook = await exportBook('Exportar Comercial', 'product-multi-filtered')
    assert.equal(locateTable(multiProductBook.Sheets.Vendas, ['UTM Source']).rows.length, 29, 'Existing multi-product selector remains compatible with the commercial export')
    assert.match(multiProductBook.Sheets.Comercial.B5.v, /MBA em Inteligência Artificial/)
    assert.match(multiProductBook.Sheets.Comercial.B5.v, /DevClub Full Stack/)
    await setProducts([])
  }
  await page.screenshot({ path: `${output}/global-desktop.png`, fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No mobile page overflow')
  await commercial().scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${output}/global-mobile.png`, animations: 'disabled' })
  checks.push({ check: 'seller/product filters and mobile', multiProductFilter, width: 390, overflow: false })
  await page.getByRole('combobox', { name: 'Vendedor', exact: true }).selectOption('ana')
  scenario = 'mappings-unavailable'
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await commercial().getByText(/Vínculos de vendedores indisponíveis/).waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Vendedor', exact: true }).inputValue(), 'ana', 'Refresh preserves the selected seller even when its mapping disappears')
  assert.equal(await page.getByRole('option', { name: 'Vendedor selecionado (sem dados disponíveis)', exact: true }).count(), 1)
  await page.getByRole('combobox', { name: 'Vendedor', exact: true }).selectOption('')
  assert.match(await commercial().innerText(), /indispon[ií]ve|n[aã]o foi poss[ií]vel/i, 'Missing mappings are disclosed')
  assert.match(await commercial().innerText(), /Sem vendedor vinculado/)
  await page.screenshot({ path: `${output}/global-mappings-unavailable.png`, fullPage: true, animations: 'disabled' })
  scenario = 'empty'
  await navigate()
  assert.equal(await page.getByRole('button', { name: 'Exportar Excel', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('button', { name: 'Exportar Comercial', exact: true }).isDisabled(), true)
  assert.match(await commercial().innerText(), /nenhuma|sem vendas/i)
  checks.push({ check: 'unavailable mappings and empty states', passed: true })
  assert.deepEqual(errors, [], 'No browser errors')
  assert.deepEqual(unexpected, [], 'Only expected API routes')
  const assets = [...applicationAssets.values()]
  if (published) {
    assert.ok(assets.some(asset => /\/PeriodDashboard-/.test(asset.path)), 'Published PeriodDashboard asset must load')
    assert.ok(assets.some(asset => /\/periodSalesExport-/.test(asset.path)), 'Published Excel export asset must load')
    assert.ok(assets.every(asset => asset.status === 200), 'Published assets must all load successfully')
  }
  await fs.writeFile(`${output}/result.json`, JSON.stringify({ mode: published ? 'published-assets-synthetic-api' : 'local-synthetic-api', base, publishedAssets, applicationAssets: assets, checks, errors, unexpected, blockedExternalRequests: blocked.length }, null, 2))
  console.log(JSON.stringify({ passed: true, mode: published ? 'published-assets-synthetic-api' : 'local-synthetic-api', publishedAssets, checks, output }, null, 2))
} finally {
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
