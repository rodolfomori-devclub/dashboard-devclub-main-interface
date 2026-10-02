// Deterministic provider/payment segregation and financial detail checks.
// Local and published assets use synthetic auth; every API request is intercepted.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
import { readPublishedVault } from './published-vault.mjs'

const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317'
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const verifyLoading = published || process.env.DASHBOARD_SMOKE_VERIFY_LOADING === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/payment-cards', import.meta.url))
await fs.mkdir(out, { recursive: true })
const date = '2026-10-01', timestamp = Date.parse(`${date}T15:00:00Z`) / 1000
let scenario = 'mixed'
const guru = ([id, product, gross, net, method]) => ({ hash: id, product: { name: product }, payment: { method, total: gross, currency: 'BRL' }, calculation_details: { total_amount: gross, net_amount: net, discounts: { processing_fee: gross - net }, net_affiliate_value: 0 }, dates: { created_at: timestamp }, contact: { name: 'Pessoa fixture', email: 'fixture@example.test' } })
const hotmart = ([transaction, product, grossValue, netValue, paymentMethod]) => ({ transaction, product, grossValue, netValue, fee: grossValue - netValue, paymentMethod, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', orderDate: `${date}T12:00:00-03:00` })
function payload(id, range = { startDate: date, endDate: date }) {
 if (range.startDate > date || range.endDate < date || scenario === 'empty') return emptyProviderPayload(id)
 if (id === 'guru') return { data: [['g-card', 'DevClub', 1050, 1000, 'credit_card'], ...(scenario === 'mixed' ? [['g-boleto', 'MBA', 750, 700, 'billet']] : [])].map(guru) }
 if (id === 'hotmart') {
  const rows = [['h-card', 'DevClub', 300, 280, 'CREDIT_CARD'], ...(scenario === 'mixed' ? [['h-boleto', 'MBA', 1000, 940, 'BILLET']] : [])].map(hotmart)
  return { success: true, data: { financialSchemaVersion: 2, count: rows.length, totalGross: rows.reduce((sum, row) => sum + row.grossValue, 0), totalNet: rows.reduce((sum, row) => sum + row.netValue, 0), totalFees: rows.reduce((sum, row) => sum + row.fee, 0), transactions: rows } }
 }
 if (id === 'tmb') return { success: true, data: [{ id: 'tmb-1', raw: { pedido_id: 1, valor_entrada: 123 }, product: 'DevClub Vitalício', value: 800, timestamp: `${date}T10:00:00-03:00` }] }
 if (id === 'asaas') return { success: true, data: { count: 1, totalGross: 900, totalNet: 880, totalFees: 20, cashReceipts: [{ date, received: 900, count: 1 }], ...(scenario === 'mixed' ? { sales: { count: 1, totalValue: 1000, entryValue: 200, entries: [{ id: 'a-contract', productDescription: 'MBA', totalValue: 1000, entryValue: 200, createdAt: `${date}T11:00:00-03:00` }] } } : { sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } }) } }
 if (id === 'boletex') return { success: true, data: { sales: { count: 1, totalValue: 2000, confirmedValue: 400, pendingValue: 1600, entries: [{ id: 'b-contract', productDescription: 'IAClub', totalValue: 2000, entryValue: 400, pendingValue: 1600, createdAt: `${date}T11:00:00-03:00` }] } } }
 return emptyProviderPayload(id)
}
const calls = [], errors = [], blocked = [], unexpected = [], checks = []
let financialBarrier = null, releaseFinancial = null, initialLoadingChecked = false, refreshChecked = false
const holdFinancial = () => { financialBarrier = new Promise(resolve => { releaseFinancial = resolve }) }
const finishFinancial = () => { releaseFinancial?.(); financialBarrier = null; releaseFinancial = null }
let assets = null, vault = { vaultUrl: base, clientId: 'local-fixture-client' }
if (published) {
 const html = await (await fetch(`${base}/diario`)).text()
 const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
 assert.ok(main, 'Published main asset exists')
 if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
 const config = await readPublishedVault({ base, main })
 vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
 assets = { main, publicVaultConfigured: true }
}
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
await context.addInitScript(({ vaultUrl, clientId }) => {
 const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
 localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'ui-fixture-only' })}.${encode({ sub: 'fixture', iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
}, vault)
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
await context.route('**/*', async route => {
 const request = route.request(), url = new URL(request.url())
 if (!url.pathname.startsWith('/api/')) {
  if (url.origin !== base || request.method() !== 'GET') { blocked.push({ external: url.origin !== base, method: request.method() }); await route.abort(); return }
  await route.continue(); return
 }
 if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,OPTIONS' } }); return }
 calls.push({ path: url.pathname, method: request.method() })
 if (financialBarrier && !['/api/access'].includes(url.pathname) && !url.pathname.startsWith('/api/goals/')) await financialBarrier
 let body
 if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly'], isAdmin: true } }
 else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today: date, payloadForSource: payload })
 else if (url.pathname === '/api/transactions') body = payload('guru')
 else if (url.pathname === '/api/refunds') body = payload('guruRefunds')
 else if (url.pathname === '/api/hotmart/vendas') body = payload('hotmart')
 else if (url.pathname === '/api/hotmart/reembolsos') body = payload('hotmartRefunds')
 else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payload('tmb')
 else if (url.pathname === '/api/boleto/asaas/vendas') body = payload('asaas')
 else if (url.pathname === '/api/boleto/boletex/vendas') body = payload('boletex')
 else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
 else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
 else { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
 const expected = ['/api/transactions', '/api/refunds'].includes(url.pathname) ? 'POST' : 'GET'
 if (request.method() !== expected) { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
 await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': base }, body: JSON.stringify(body) })
})
const page = await context.newPage()
await page.clock.setFixedTime(new Date(`${date}T16:00:00-03:00`))
page.on('pageerror', error => errors.push(error.message))
const card = title => page.locator('.revenue-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
const providers = item => item.locator('.revenue-provider-row')
const providerIds = async item => providers(item).evaluateAll(rows => rows.map(row => row.dataset.provider))
const provider = (item, id) => item.locator(`.revenue-provider-row[data-provider="${id}"]`)
const metric = (row, title) => row.locator('dl > div').filter({ has: page.locator('dt').filter({ hasText: new RegExp(`^${title}$`) }) }).locator('dd')
const money = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
async function assertMoney(locator, expected, message) { assert.match(await locator.innerText(), money(expected), message) }
async function openCards() {
 for (const title of ['Cartão', 'Boleto']) {
  const detail = card(title).locator('details')
  if (await detail.getAttribute('open') === null) { await card(title).locator('summary').focus(); await page.keyboard.press('Enter') }
  assert.notEqual(await detail.getAttribute('open'), null)
 }
}
async function navigate(path, width, theme) {
 await page.setViewportSize({ width, height: 1000 })
 const checkInitialLoading = verifyLoading && !initialLoadingChecked
 if (checkInitialLoading) holdFinancial()
 await page.goto(`${base}/${path}`, { waitUntil: checkInitialLoading ? 'domcontentloaded' : 'networkidle' })
 await page.locator('.revenue-highlights').waitFor()
 if (checkInitialLoading) {
  await page.locator('.revenue-card-value .financial-value[data-state="loading"]').nth(3).waitFor()
  for (const value of await page.locator('.revenue-card-value').all()) { assert.match(await value.innerText(), /Carregando valor/); assert.doesNotMatch(await value.innerText(), /R\$/) }
  await page.locator('.revenue-highlights').screenshot({ path: `${out}/loading-initial.png`, animations: 'disabled' })
  checks.push('Initial card loading states are explicit and do not invent zeros')
  initialLoadingChecked = true
  finishFinancial()
  await page.waitForLoadState('networkidle')
 }
 await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
 if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
 await openCards()
}
try {
 const layouts = published ? [['diario', 1440, 'light'], ['diario', 360, 'dark'], ['mensal', 1440, 'dark'], ['anual', 360, 'light']] : ['diario', 'global', 'mensal', 'anual'].flatMap(path => [[path, 1440, 'light'], [path, 360, 'dark']])
 for (const [path, width, theme] of layouts) {
  scenario = 'mixed'
  await navigate(path, width, theme)
  assert.deepEqual(await providerIds(card('Cartão')), ['guru', 'hotmart'], 'Card providers require observed card sales')
  const expectedBoleto = path === 'anual' ? ['guru', 'hotmart', 'tmb', 'boletex'] : ['guru', 'hotmart', 'tmb', 'asaas', 'boletex']
  assert.deepEqual(await providerIds(card('Boleto')), expectedBoleto, 'Boleto providers require observed boleto sales, with Asaas annual loaded on demand')
  await assertMoney(card('Cartão').locator('.revenue-card-value'), '1.280,00', 'Card value contains net Guru and Hotmart only')
  for (const [id, gross, cash] of [['guru', '700,00', '700,00'], ['hotmart', '940,00', '940,00'], ['tmb', '800,00', '320,00'], ['boletex', '2.000,00', null]]) {
   const row = provider(card('Boleto'), id)
   await assertMoney(metric(row, ['guru', 'hotmart'].includes(id) ? 'Líquido após taxas' : 'Valor contratado'), gross)
   if (cash) await assertMoney(metric(row, 'Cash collected'), cash, `${id} cash must not deduct taxes a second time`)
   else assert.match(await metric(row, 'Cash collected').innerText(), /Não informado/)
   assert.match(await metric(row, 'Entrada recebida').innerText(), /Não informado/, `${id} unconfirmed entry must not be guessed`)
  }
  if (path !== 'anual') {
   const row = provider(card('Boleto'), 'asaas')
   await assertMoney(metric(row, 'Valor contratado'), '1.000,00')
   await assertMoney(metric(row, 'Entrada recebida'), '200,00')
   await assertMoney(metric(row, 'Cash collected'), '200,00', 'Only confirmed new-contract entry counts as Asaas sales cash')
   await assertMoney(page.locator('.revenue-card--cash .revenue-card-value'), '3.440,00')
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path}/${width}/${theme} overflow`)
  for (const row of await providers(card('Boleto')).all()) {
   const bounds = await row.boundingBox()
   assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'Provider financial rows fit viewport')
  }
  await page.locator('.revenue-payment-grid').screenshot({ path: `${out}/${path}-${width}-${theme}.png`, animations: 'disabled' })
  checks.push(`${path}/${width}/${theme}: payment providers, net digital sales/contracted others/cash/entry semantics, no overflow`)
  if (path === 'diario') {
   if (verifyLoading && !refreshChecked) {
    holdFinancial()
    await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
    await page.locator('.revenue-card-value .financial-value[data-state="refreshing"]').nth(3).waitFor()
    await assertMoney(card('Cartão').locator('.revenue-card-value'), '1.280,00')
    for (const value of await page.locator('.revenue-card-value').all()) assert.match(await value.innerText(), /Atualizando/)
    finishFinancial()
    await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    checks.push('Refresh preserves existing values and clearly indicates updating inside each card')
    refreshChecked = true
   }
   const before = calls.length
   await page.getByLabel('Família de produto', { exact: true }).selectOption('DevClub')
   assert.deepEqual(await providerIds(card('Boleto')), ['tmb'], 'Product filter removes other products and their providers')
   assert.deepEqual(await providerIds(card('Cartão')), ['guru', 'hotmart'])
   await assertMoney(metric(provider(card('Boleto'), 'tmb'), 'Cash collected'), '320,00')
   await page.getByLabel('Família de produto', { exact: true }).selectOption('IAClub')
   assert.equal(await providers(card('Cartão')).count(), 0, 'No unrelated card providers for an empty payment slice')
   assert.deepEqual(await providerIds(card('Boleto')), ['boletex'])
   assert.match(await metric(provider(card('Boleto'), 'boletex'), 'Entrada recebida').innerText(), /Não informado/)
   assert.equal(calls.length, before, 'Product filtering stays local')
   checks.push(`${width}/${theme}: local product filter and empty card details`)
  }
 }
 // A statement-only Asaas source cannot create a boleto provider or allocate its cash.
 scenario = 'receipts-only'
 await navigate('diario', 1440, 'light')
 assert.deepEqual(await providerIds(card('Boleto')), ['tmb', 'boletex'])
 assert.deepEqual(await providerIds(card('Cartão')), ['guru', 'hotmart'])
 await assertMoney(page.locator('.revenue-card--cash .revenue-card-value'), '1.600,00')
 assert.equal(await provider(card('Boleto'), 'asaas').count(), 0)
 checks.push('Statement-only Asaas stays outside new-sales cash and creates no boleto provider')
 assert.deepEqual(errors, []); assert.deepEqual(blocked, []); assert.deepEqual(unexpected, [])
 await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, published, assets, checks, apiCalls: calls.length, errors, blocked, unexpected }, null, 2))
 console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, errors, blocked, unexpected }))
} finally { finishFinancial(); await browser.close() }
