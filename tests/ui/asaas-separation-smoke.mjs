// Fixture-only regression for new Asaas sales vs invoice receipts.
// Published mode allows only public application assets; all API calls are mocked.
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
import { readPublishedVault } from './published-vault.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/asaas-separation', import.meta.url))
await fs.mkdir(out, { recursive: true })
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
    env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
  server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
}
const today = '2026-10-02'
let scenario = 'linked', financialBarrier = null, releaseFinancial = null
const calls = [], checks = [], errors = [], blocked = [], unexpected = [], applicationAssets = new Map()
const holdFinancial = () => { financialBarrier = new Promise(resolve => { releaseFinancial = resolve }) }
const finishFinancial = () => { releaseFinancial?.(); financialBarrier = null; releaseFinancial = null }
const includes = (range, date) => range.startDate <= date && range.endDate >= date
function asaasPayload(range) {
  const saleDate = scenario === 'earlier-month' ? '2026-10-01' : scenario === 'annual-later-week' ? '2026-01-01' : today
  const receiptKnown = includes(range, today)
  const checkout = scenario !== 'cash-only'
  const saleKnown = checkout && includes(range, saleDate)
  const rows = receiptKnown ? [
    { receiptDate: today, saleDate: checkout ? saleDate : null, received: 200, count: 1 },
    { receiptDate: today, saleDate: checkout ? '2025-12-31' : null, received: 100, count: 1 },
    { receiptDate: today, saleDate: null, received: 50, count: 1 },
  ] : []
  return { success: true, data: {
    count: receiptKnown ? 3 : 0,
    totalGross: receiptKnown ? 350 : 0,
    totalNet: receiptKnown ? 340 : 0,
    totalFees: receiptKnown ? 10 : 0,
    cashReceipts: receiptKnown ? [{ date: today, received: 350, count: 3 }] : [],
    cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: checkout ? 'ready' : 'unavailable', rows },
    sales: checkout ? {
      count: saleKnown ? 1 : 0,
      totalValue: saleKnown ? 2000 : 0,
      entryValue: saleKnown ? 200 : 0,
      entries: saleKnown ? [{ id: 'asaas-new-contract', productDescription: 'DevClub', totalValue: 2000, entryValue: 200, createdAt: `${saleDate}T10:00:00-03:00` }] : [],
    } : null,
    availability: { cash: 'ready', sales: checkout ? 'ready' : 'unavailable', ...(!checkout ? { reason: 'checkout_disabled' } : {}) },
  } }
}
function payload(id, range = { startDate: today, endDate: today }) {
  if (id === 'asaas') return asaasPayload(range)
  return emptyProviderPayload(id)
}
let assets = null
try {
  if (server) {
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(base)).ok } catch { /* Vite startup */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  let vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) {
    const htmlResponse = await fetch(`${base}/diario`)
    assert.equal(htmlResponse.status, 200)
    const html = await htmlResponse.text()
    const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Published entry asset exists')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
    const config = await readPublishedVault({ base, main })
    vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
    assets = { main, publicVaultConfigured: true }
  }
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
  await context.addInitScript(({ vaultUrl, clientId }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'ui-fixture-only' })}.${encode({ sub: 'fixture', iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
  }, vault)
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (!url.pathname.startsWith('/api/')) {
      const publicPath = ['/diario', '/global', '/mensal', '/anual'].includes(url.pathname) || url.pathname.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
      if (url.origin !== base || req.method() !== 'GET' || (published && !publicPath)) {
        blocked.push({ external: url.origin !== base, method: req.method(), resource: req.resourceType(), opaqueScript: /^\/[A-Za-z0-9_-]{80,}$/.test(url.pathname) })
        await route.abort(); return
      }
      await route.continue(); return
    }
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }); return
    }
    calls.push({ path: url.pathname, method: req.method(), query: url.searchParams.toString() })
    if (financialBarrier && url.pathname !== '/api/access' && !url.pathname.startsWith('/api/goals/')) await financialBarrier
    const requestedDate = (url.searchParams.get('date') || today).slice(0, 10)
    const range = { startDate: url.searchParams.get('data_inicio') || requestedDate, endDate: url.searchParams.get('data_final') || requestedDate }
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly'], isAdmin: true } }
    else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today, payloadForSource: payload })
    else if (url.pathname === '/api/transactions') body = payload('guru', range)
    else if (url.pathname === '/api/refunds') body = payload('guruRefunds', range)
    else if (url.pathname === '/api/hotmart/vendas') body = payload('hotmart', range)
    else if (url.pathname === '/api/hotmart/reembolsos') body = payload('hotmartRefunds', range)
    else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payload('tmb', range)
    else if (url.pathname === '/api/boleto/asaas/vendas') body = payload('asaas', range)
    else if (url.pathname === '/api/boleto/boletex/vendas') body = payload('boletex', range)
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
    else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
    else { unexpected.push(`${req.method()} ${url.pathname}`); await route.abort(); return }
    const method = ['/api/transactions', '/api/refunds'].includes(url.pathname) ? 'POST' : 'GET'
    if (req.method() !== method) { unexpected.push(`${req.method()} ${url.pathname}`); await route.abort(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base }, body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await page.clock.setFixedTime(new Date(`${today}T16:00:00-03:00`))
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() })
  })
  const panel = () => page.getByRole('region', { name: 'Caixa Asaas do período', exact: true })
  const revenue = () => page.locator('.revenue-card--total .revenue-card-value')
  const cash = () => page.locator('.revenue-card--cash .revenue-card-value')
  const metricIds = { 'Vendas novas Asaas': 'sales-gross', 'Recebimentos de faturas': 'receipts-gross', 'Vendas do período': 'receipts-currentPeriod', 'Vendas anteriores': 'receipts-previousPeriods', 'Origem não identificada': 'receipts-unclassified' }
  const metric = label => panel().locator(`[data-metric="${metricIds[label]}"]`)
  const assertMoney = async (locator, value) => assert.match(await locator.innerText(), new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  async function navigate(path, width = 1440, theme = 'light', pending = false) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/${path}`, { waitUntil: pending ? 'domcontentloaded' : 'networkidle' })
    await panel().waitFor()
    if (!pending && path !== 'anual') await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
  }
  async function assertSplit({ current = '200,00', previous = '100,00', unknown = '50,00', newSales = '2.000,00' } = {}) {
    if (newSales === null) assert.match(await metric('Vendas novas Asaas').innerText(), /Não informado|Indisponível/)
    else await assertMoney(metric('Vendas novas Asaas'), newSales)
    await assertMoney(metric('Recebimentos de faturas'), '350,00')
    await assertMoney(metric('Vendas do período'), current)
    await assertMoney(metric('Vendas anteriores'), previous)
    await assertMoney(metric('Origem não identificada'), unknown)
  }
  // Initial and refresh loading must not masquerade as a known zero or lose valid data.
  scenario = 'linked'
  holdFinancial()
  await navigate('diario', 1440, 'light', true)
  await panel().locator('.financial-value[data-state="loading"]').first().waitFor()
  assert.match(await panel().innerText(), /Carregando valor/)
  assert.doesNotMatch(await panel().innerText(), /R\$/)
  await panel().screenshot({ path: `${out}/loading-initial.png`, animations: 'disabled' })
  finishFinancial()
  await page.waitForLoadState('networkidle')
  await assertSplit()
  checks.push('Explicit loading before financial responses; no invented zero')
  holdFinancial()
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await panel().locator('.financial-value[data-state="refreshing"]').first().waitFor()
  await assertSplit()
  assert.match(await panel().innerText(), /Atualizando/)
  finishFinancial()
  await page.waitForLoadState('networkidle')
  checks.push('Refresh preserves known sales and receipts with an updating status')

  for (const [path, width, theme] of [['diario', 1440, 'light'], ['diario', 360, 'dark'], ['global', 1440, 'dark'], ['mensal', 360, 'light']]) {
    scenario = 'linked'
    await navigate(path, width, theme)
    await assertSplit()
    await assertMoney(revenue(), '2.000,00')
    assert.equal((await panel().locator('[data-metric="sales-count"]').innerText()).trim(), '1')
    await assertMoney(panel().locator('[data-metric="sales-entry"]'), '200,00')
    await assertMoney(cash(), '200,00')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} ${width} overflow`)
    await panel().getByRole('heading', { name: 'Asaas: vendas e recebimentos', exact: true }).click()
    await panel().screenshot({ path: `${out}/${path}-${width}-${theme}.png`, animations: 'disabled' })
    checks.push(`${path}/${width}/${theme}: R$ 2,000 one-sale contract and R$ 200 new-sale cash are separate from R$ 350 invoice receipts`)
    const before = calls.length
    const product = path === 'diario' ? page.getByLabel('Família de produto', { exact: true }) : page.locator('#period-product')
    if (path === 'global') {
      await product.click()
      const products = page.getByRole('dialog', { name: 'Selecionar produtos', exact: true })
      await products.getByRole('checkbox', { name: 'DevClub', exact: true }).check()
      await products.getByRole('button', { name: 'Concluir', exact: true }).click()
    } else await product.selectOption('DevClub')
    assert.match(await metric('Recebimentos de faturas').innerText(), /Não informado|Sem atribuição/)
    assert.doesNotMatch(await metric('Recebimentos de faturas').innerText(), /350,00/)
    await assertMoney(metric('Vendas novas Asaas'), '2.000,00')
    assert.equal(calls.length, before, 'Product filters must stay local and not allocate unlinked statement receipts')
    checks.push(`${path}/${width}/${theme}: product filter retains matching contract and does not allocate general receipts`)
  }
  scenario = 'earlier-month'
  await navigate('diario')
  await assertSplit({ current: '0,00', previous: '300,00', newSales: '0,00' })
  await navigate('mensal')
  await assertSplit()
  checks.push('An October 1 sale received October 2 is previous in a daily view and current in the monthly view')

  scenario = 'cash-only'
  await navigate('diario')
  assert.match(await metric('Vendas novas Asaas').innerText(), /Não informado|Indisponível/)
  assert.doesNotMatch(await metric('Vendas novas Asaas').innerText(), /R\$/)
  await assertMoney(metric('Recebimentos de faturas'), '350,00')
  await assertMoney(metric('Origem não identificada'), '350,00')
  assert.doesNotMatch(await revenue().innerText(), /350,00|2\.000,00/)
  assert.doesNotMatch(await cash().innerText(), /350,00/, 'Invoice receipts must not become new-sales cash')
  checks.push('Cash-only source is unknown new sales and unknown origin, never R$ 350 of invented sales')

  scenario = 'annual-later-week'
  const beforeAnnual = calls.filter(call => call.path === '/api/boleto/asaas/vendas').length
  await navigate('anual', 1440, 'light')
  assert.equal(calls.filter(call => call.path === '/api/boleto/asaas/vendas').length, beforeAnnual, 'Annual Asaas remains an explicit, on-demand query')
  await page.getByRole('button', { name: 'Consultar caixa Asaas', exact: true }).click()
  await panel().getByText('Todos os intervalos foram consultados.', { exact: true }).waitFor()
  await assertSplit({ newSales: null })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await panel().getByRole('heading', { name: 'Asaas: vendas e recebimentos', exact: true }).click()
  await panel().screenshot({ path: `${out}/anual-1440-light.png`, animations: 'disabled' })
  checks.push('Annual January sale paid in October remains current-year receipts across independently fetched weekly chunks')
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript), 'Only non-application optional opaque scripts may be blocked')
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200), 'All requested application assets succeeded')
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, published, assets, checks, apiCalls: calls.length, realApiRequests: 0, realWrites: 0, applicationAssets: [...applicationAssets.values()], errors, blocked, unexpected }, null, 2))
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, errors, blocked, unexpected }))
} finally {
  finishFinancial()
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
