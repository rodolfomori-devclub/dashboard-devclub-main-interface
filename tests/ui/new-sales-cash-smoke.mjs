// Regression for the reported R$ 833.64 sales plus R$ 1,255.36 legacy-invoice incident.
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
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/new-sales-cash', import.meta.url))
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
const today = '2026-10-01'
let scenario = 'legacy-only'
const calls = [], checks = [], errors = [], blocked = [], unexpected = [], applicationAssets = new Map()
const includes = (range, date) => range.startDate <= date && range.endDate >= date
const plans = ['gross', 'cash'].flatMap(metric => [
  { scope: 'overall', scopeId: '', scopeName: 'Geral', product: 'all' },
  { scope: 'product', scopeId: 'DevClub', scopeName: 'DevClub', product: 'DevClub' },
  { scope: 'team', scopeId: 'commercial', scopeName: 'Comercial', product: 'all' },
  { scope: 'individual', scopeId: 'ana', scopeName: 'Ana', product: 'all' },
].map((scope, index) => ({ ...scope, id: `${metric}-${index}`, metric, target: 10000, superTarget: 12000, ultraTarget: 15000, paceBasis: 'calendar' })))
function payload(id, range = { startDate: today, endDate: today }) {
  if (!includes(range, today)) return emptyProviderPayload(id)
  if (id === 'hotmart') return { success: true, data: {
    financialSchemaVersion: 2, count: 3, totalGross: 900, totalNet: 833.64, totalFees: 66.36,
    transactions: [1, 2, 3].map(index => ({ transaction: `h${index}`, product: 'DevClub', grossValue: 300, netValue: 277.88, fee: 22.12, paymentMethod: 'CREDIT_CARD', currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', orderDate: `${today}T12:00:00-03:00` })),
  } }
  if (id === 'asaas') {
    const newSale = scenario === 'new-sale'
    const linked = scenario === 'linked-invoice-only' || newSale
    return { success: true, data: {
      count: 3, totalGross: 1255.36, totalNet: 1255.36, totalFees: 0,
      cashReceipts: [{ date: today, received: 1255.36, count: 3 }],
      cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: linked ? 'ready' : 'unavailable', rows: [{ receiptDate: today, saleDate: linked ? today : null, received: 1255.36, count: 3 }] },
      sales: linked ? { count: newSale ? 1 : 0, totalValue: newSale ? 2000 : 0, entryValue: newSale ? 200 : 0, entries: newSale ? [{ id: 'asaas-new-sale', productDescription: 'DevClub', totalValue: 2000, entryValue: 200, createdAt: `${today}T10:00:00-03:00` }] : [] } : null,
      availability: { cash: 'ready', sales: linked ? 'ready' : 'unavailable', ...(!linked ? { reason: 'checkout_disabled' } : {}) },
    } }
  }
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
      const publicPath = ['/diario', '/global', '/mensal', '/anual', '/pace'].includes(url.pathname) || url.pathname.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
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
    const requestedDate = (url.searchParams.get('date') || today).slice(0, 10)
    const range = { startDate: url.searchParams.get('data_inicio') || requestedDate, endDate: url.searchParams.get('data_final') || requestedDate }
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly', 'goal-pace', 'goals'], isAdmin: true } }
    else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today, payloadForSource: payload })
    else if (url.pathname === '/api/transactions') body = payload('guru', range)
    else if (url.pathname === '/api/refunds') body = payload('guruRefunds', range)
    else if (url.pathname === '/api/hotmart/vendas') body = payload('hotmart', range)
    else if (url.pathname === '/api/hotmart/reembolsos') body = payload('hotmartRefunds', range)
    else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payload('tmb', range)
    else if (url.pathname === '/api/boleto/asaas/vendas') body = payload('asaas', range)
    else if (url.pathname === '/api/boleto/boletex/vendas') body = payload('boletex', range)
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [1, 2, 3].map(index => ({ source: 'hotmart', externalId: `h${index}`, sellerId: 'ana', sellerName: 'Ana' })), manualSales: [] } }
    else if (url.pathname === '/api/goal-plans/options') body = { teams: [{ id: 'commercial', name: 'Comercial', active: true }], individuals: [{ id: 'ana', name: 'Ana', teamId: 'commercial', active: true }] }
    else if (/^\/api\/goal-plans\/\d{4}\/\d{1,2}$/.test(url.pathname)) body = { plans }
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
  const revenueCard = () => page.locator('.revenue-card--total')
  const cashCard = () => page.locator('.revenue-card--cash')
  const assertMoney = async (locator, expected) => assert.equal((await locator.innerText()).replace(/\s/g, ''), `R$${expected}`)
  const detail = label => revenueCard().locator('.revenue-total-details > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).locator('dd')
  async function navigate(path, width = 1440, theme = 'light') {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/${path}`, { waitUntil: 'networkidle' })
    if (path.startsWith('pace')) await page.locator('.pace-stage').waitFor()
    else {
      await panel().waitFor()
      await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    }
    if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
  }
  async function assertNewSales({ sales = '833,64', cash = '833,64', count = '3', ticket = '277,88' } = {}) {
    await assertMoney(revenueCard().locator('.revenue-card-value'), sales)
    await assertMoney(cashCard().locator('.revenue-card-value'), cash)
    assert.equal((await detail('Vendas realizadas').innerText()).trim(), count)
    await assertMoney(detail('Ticket médio'), ticket)
    assert.doesNotMatch(await cashCard().locator('.revenue-cash-details').innerText(), /Asaas\s*·\s*faturas recebidas|1\.255,36|2\.089,00/, 'Invoice totals must never enter the new-sales cash card')
  }
  async function assertLedger() {
    await assertMoney(panel().locator('[data-metric="receipts-gross"]'), '1.255,36')
  }
  const layouts = published
    ? [['diario', 1440, 'light'], ['diario', 360, 'dark'], ['global', 1440, 'dark'], ['mensal', 360, 'light'], ['anual', 1440, 'light']]
    : ['diario', 'global', 'mensal', 'anual'].flatMap(path => [[path, 1440, 'light'], [path, 360, 'dark']])
  for (const [path, width, theme] of layouts) {
    scenario = 'legacy-only'
    await navigate(path, width, theme)
    await assertNewSales()
    if (path === 'anual') {
      await page.getByRole('button', { name: 'Consultar caixa Asaas', exact: true }).click()
      await panel().getByText('Todos os intervalos foram consultados.', { exact: true }).waitFor()
      await assertNewSales()
    }
    await assertLedger()
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path}/${width}/${theme} overflow`)
    await revenueCard().getByRole('heading').click()
    await page.screenshot({ path: `${out}/${path}-${width}-${theme}.png`, fullPage: true, animations: 'disabled' })
    checks.push(`${path}/${width}/${theme}: sales/cash833.64, count3, ticket277.88; separate invoice ledger1255.36; annual receipt query never inflates main totals`)
    const beforeFilter = calls.length
    const platform = path === 'diario' ? page.getByLabel('Plataforma', { exact: true }) : page.locator('#period-platform')
    await platform.selectOption('Hotmart')
    await assertNewSales()
    assert.equal(await panel().count(), 0, 'Hotmart filter cannot display Asaas receipts')
    assert.equal(calls.length, beforeFilter, 'Platform filtering remains local')
  }

  // Even a linked current-period invoice is a receipt, not a new sale or entry.
  scenario = 'linked-invoice-only'
  await navigate('diario')
  await assertNewSales()
  await assertLedger()
  await assertMoney(panel().locator('[data-metric="receipts-currentPeriod"]'), '1.255,36')
  checks.push('An invoice with a current-period sale date still cannot manufacture new sales or new-sales cash')

  // Confirmed entry attached to an actual new contract is eligible, exactly once.
  scenario = 'new-sale'
  await navigate('diario')
  await assertNewSales({ sales: '2.833,64', cash: '1.033,64', count: '4', ticket: '708,41' })
  await assertLedger()
  assert.match(await cashCard().locator('.revenue-cash-details').innerText(), /Asaas.*entradas.*novas vendas/s)
  const boleto = page.locator('.revenue-card--boleto')
  await boleto.locator('summary').click()
  const asaas = boleto.locator('[data-provider="asaas"]')
  const paymentMetric = label => asaas.locator('dl > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${label}$`) }) }).locator('dd')
  await assertMoney(paymentMetric('Cash collected'), '200,00')
  await assertMoney(paymentMetric('Entrada recebida'), '200,00')
  checks.push('A confirmed new Asaas contract adds gross2000 and cash entry200 once; its invoice ledger1255.36 remains separate')

  for (const origin of ['legacy-only', 'linked-invoice-only', 'new-sale']) {
    scenario = origin
    await navigate('pace?year=2026&month=10', origin === 'legacy-only' ? 1440 : 360, origin === 'linked-invoice-only' ? 'dark' : 'light')
    await page.getByLabel('Base financeira', { exact: true }).selectOption('cash')
    const expected = origin === 'new-sale' ? '1.033,64' : '833,64'
    await assertMoney(page.locator('.pace-stage-actual > strong'), expected)
    assert.doesNotMatch(await page.locator('.pace-stat').first().innerText(), /2\.089,00|2\.289,00/)
    const before = calls.length
    if (origin !== 'new-sale') {
      for (const scope of ['Time', 'Indivíduo', 'Produto']) {
        await page.getByRole('group', { name: 'Escopo da meta' }).getByRole('button', { name: scope, exact: true }).click()
        if (scope === 'Produto') await page.getByLabel('Família de produto', { exact: true }).selectOption('DevClub')
        await assertMoney(page.locator('.pace-stage-actual > strong'), '833,64')
      }
    }
    assert.equal(calls.length, before, 'Pace scope filtering remains local')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await page.locator('.pace-stage-heading h2').click()
    await page.locator('.pace-stage').screenshot({ path: `${out}/pace-${origin}.png`, animations: 'disabled' })
    checks.push(`Pace ${origin}: ${expected} eligible new-sales cash; invoice receipts excluded from actual and scoped goals`)
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript), 'Only non-application optional opaque scripts may be blocked')
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200), 'All requested application assets succeeded')
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, published, assets, checks, apiCalls: calls.length, realApiRequests: 0, realWrites: 0, applicationAssets: [...applicationAssets.values()], errors, blocked, unexpected }, null, 2))
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, errors, blocked, unexpected }))
} finally {
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
