// Financial refund semantics and layout; every API is a local fixture.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317'
const out = fileURLToPath(new URL('./artifacts/refund-summary', import.meta.url))
await fs.mkdir(out, { recursive: true })
const date = '2026-10-01', timestamp = Date.parse(`${date}T15:00:00Z`) / 1000
const guruRefunds = [['refunded', 100], ['partially_refunded', 250], ['chargeback', 400], ['rejected', 600]].map(([status, value], index) => ({ id: `refund-${index}`, status, product: { name: 'DevClub' }, payment: { method: 'credit_card', total: value, currency: 'BRL' }, calculation_details: { total_amount: value, net_amount: value * .9 }, dates: { created_at: timestamp, canceled_at: timestamp }, contact: { name: 'Fixture reembolso', email: 'fixture@example.test' } }))
const hotmartRefunds = { success: true, data: { count: 1, totalRefundAmount: 1997, transactions: [{ transaction: 'hotmart-refund', status: 'PARTIALLY_REFUNDED', product: 'DevClub', paymentMethod: 'CREDIT_CARD', value: 1997, currency: 'BRL', orderDate: timestamp * 1000 }] } }
function payload(id, range = { startDate: date, endDate: date }) {
 if (range.startDate > date || range.endDate < date) return emptyProviderPayload(id)
 if (id === 'guruRefunds') return { data: guruRefunds }
 if (id === 'hotmartRefunds') return hotmartRefunds
 return emptyProviderPayload(id)
}
const overview = { data: [...guruRefunds.map(row => ({ id: row.id, platform: 'guru', sources: ['guru'], kind: ['refunded','partially_refunded'].includes(row.status) ? 'confirmed' : row.status === 'chargeback' ? 'dispute' : 'cancelled', status: row.status, product: 'DevClub', name: 'Fixture reembolso', referenceDate: date, dateBasis: 'refund', saleAmount: row.payment.total, refundAmount: null, currency: 'BRL' })), { id: 'hotmart-refund', platform: 'hotmart', sources: ['hotmart'], kind: 'confirmed', status: 'partially_refunded', product: 'DevClub', referenceDate: date, dateBasis: 'purchase', saleAmount: 1997, refundAmount: null, currency: 'BRL' }, { id: 'tmb-cancelled', platform: 'tmb', sources: ['tmb'], kind: 'cancelled', status: 'cancelled', product: 'DevClub', referenceDate: date, dateBasis: 'purchase', saleAmount: 9999, refundAmount: null, currency: 'BRL' }], sources: [{ id: 'guru', status: 'available', recordCount: 4 }, { id: 'hotmart', status: 'available', recordCount: 1 }, { id: 'tmb', status: 'limited', recordCount: 1 }], incomplete: false, deduplication: { removed: 0 }, excludedUndated: 0, generatedAt: `${date}T15:00:00Z` }
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: existsSync(localChrome) ? localChrome : undefined })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
await context.addInitScript(() => {
 const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
 localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture', exp: 4102444800 })}.fixture-not-valid`)
})
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
const calls = [], errors = [], external = [], checks = []
await context.route('**/*', async route => {
 const request = route.request(), url = new URL(request.url())
 if (url.origin !== base) { external.push(url.origin); await route.abort(); return }
 if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
 calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams) })
 let body
 if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today','daily','monthly','yearly','refunds','comparativo'], isAdmin: true } }
 else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today: date, payloadForSource: payload })
 else if (url.pathname === '/api/refunds') { const query = request.postDataJSON(); body = payload('guruRefunds', { startDate: query.ordered_at_ini, endDate: query.ordered_at_end }) }
 else if (url.pathname === '/api/hotmart/reembolsos') body = payload('hotmartRefunds', { startDate: url.searchParams.get('date') || url.searchParams.get('data_inicio'), endDate: url.searchParams.get('date') || url.searchParams.get('data_final') })
 else if (url.pathname === '/api/refunds/overview') body = overview
 else if (url.pathname === '/api/transactions') body = payload('guru')
 else if (url.pathname === '/api/hotmart/vendas') body = payload('hotmart')
 else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payload('tmb')
 else if (url.pathname === '/api/boleto/asaas/vendas') body = payload('asaas')
 else if (url.pathname === '/api/boleto/boletex/vendas') body = payload('boletex')
 else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
 else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
 else body = { data: [] }
 await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
const page = await context.newPage()
await page.clock.setFixedTime(new Date('2026-10-01T16:00:00-03:00'))
page.on('pageerror', error => errors.push(error.message))
try {
 for (const width of [1440, 360]) for (const path of ['diario','global','mensal','anual','reembolsos']) {
  await page.setViewportSize({ width, height: 1000 })
  await page.goto(`${base}/${path}`, { waitUntil: 'networkidle' })
  const card = page.getByRole('region', { name: 'Resumo de reembolsos' })
  await card.waitFor()
  await page.waitForFunction(() => document.querySelector('.refund-summary-amount')?.textContent.includes('2.347,00'))
  assert.match(await card.locator('.refund-summary-metrics > div').nth(0).innerText(), /Confirmados\s+3\s+2 parciais incluídos/)
  assert.match(await card.locator('.refund-summary-metrics > div').nth(1).innerText(), /Contestações\s+1/)
  assert.match(await card.locator('.refund-summary-metrics > div').nth(2).innerText(), new RegExp(`Cancelamentos\\s+${path === 'reembolsos' ? 2 : 1}`))
  const before = calls.length
  await card.locator('summary').focus(); await page.keyboard.press('Enter')
  const guru = card.locator('[data-provider="guru"]'), hotmart = card.locator('[data-provider="hotmart"]')
  assert.match(await guru.innerText(), /R\$\s*350,00/)
  assert.match(await hotmart.innerText(), /R\$\s*1.997,00/)
  assert.match(await hotmart.innerText(), /Valor devolvido\s+Não informado/)
  assert.match(await card.locator('[data-provider="tmb"]').innerText(), /Reembolsos confirmados\s+—/)
  assert.match(await card.locator('[data-provider="asaas"]').innerText(), /Reembolsos confirmados\s+—/)
  assert.equal(calls.length, before, 'refund expansion must stay local')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path}/${width} overflow`)
  if (path === 'diario') {
   assert.equal(await card.getByRole('link').getAttribute('href'), `/reembolsos?startDate=${date}&endDate=${date}`)
   await page.getByRole('combobox', { name: 'Plataforma', exact: true }).selectOption('Hotmart')
   assert.match(await card.locator('.refund-summary-amount').innerText(), /1.997,00/)
   assert.equal(await card.locator('.refund-summary-provider').count(), 1)
   assert.equal(calls.length, before, 'platform filter must stay local')
   await page.getByRole('combobox', { name: 'Plataforma', exact: true }).selectOption('')
  }
  if (width === 360 && !await page.evaluate(() => document.documentElement.classList.contains('dark'))) await page.getByRole('button', { name: 'Usar tema escuro', exact: true }).click()
  if (width === 1440 && await page.evaluate(() => document.documentElement.classList.contains('dark'))) await page.getByRole('button', { name: 'Usar tema claro', exact: true }).click()
  await card.getByRole('heading').first().click()
  await card.screenshot({ path: `${out}/${path}-${width}.png`, animations: 'disabled' })
  checks.push(`${path}/${width}: confirmed, partial, dispute, cancelled, unknown amounts, no extra APIs, no overflow`)
 }
 await page.goto(`${base}/reembolsos?startDate=2026-09-10&endDate=2026-09-12`, { waitUntil: 'networkidle' })
 assert.equal(await page.locator('#refund-start').inputValue(), '2026-09-10')
 assert.equal(await page.locator('#refund-end').inputValue(), '2026-09-12')
 assert.ok(calls.some(call => call.path === '/api/refunds/overview' && call.query.startDate === '2026-09-10' && call.query.endDate === '2026-09-12'))
 checks.push('central preserves dashboard period')
 await page.goto(`${base}/comparativo`, { waitUntil: 'networkidle' })
 const comparisonCards = page.getByRole('region', { name: 'Resumo de reembolsos' })
 assert.equal(await comparisonCards.count(), 2)
 assert.match(await comparisonCards.nth(0).locator('.refund-summary-amount').innerText(), /2.347,00/)
 assert.match(await comparisonCards.nth(1).locator('.refund-summary-amount').innerText(), /R\$\s*0,00/)
 assert.equal(await comparisonCards.nth(1).getByRole('link').getAttribute('href'), '/reembolsos?startDate=2026-09-30&endDate=2026-09-30')
 checks.push('comparison keeps A/B refunds and links separate')
 assert.deepEqual(errors, []); assert.deepEqual(external, [])
 await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, checks, apiCalls: calls.length, errors, external }, null, 2))
 console.log(JSON.stringify({ passed: true, checks: checks.length, apiCalls: calls.length, errors, external }))
} finally { await browser.close() }
