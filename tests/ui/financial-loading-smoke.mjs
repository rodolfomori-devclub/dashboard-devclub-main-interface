// Hold actual page requests to verify loading, refresh and unknown values independently.
// All financial responses below are deterministic fixtures; no external APIs are contacted.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'

const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317'
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a local fixture server')
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/financial-loading', import.meta.url))
await fs.mkdir(out, { recursive: true })
const date = '2026-10-01', timestamp = Date.parse(`${date}T15:00:00Z`) / 1000
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: existsSync(localChrome) ? localChrome : undefined })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
await context.addInitScript(() => {
  const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture', exp: 4102444800 })}.fixture-not-valid`)
})
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
let mode = 'known', gate = null, release = null
const calls = [], errors = [], external = [], checks = []
const hold = () => { gate = new Promise(resolve => { release = () => { gate = null; resolve() } }) }
const payload = (id, range) => {
  if (range && (range.startDate > date || range.endDate < date)) return emptyProviderPayload(id)
  if (mode !== 'known') return emptyProviderPayload(id)
  if (id === 'guru' || id === 'guruRefunds') return { data: [{ id: id === 'guru' ? 'sale-1' : 'refund-1', status: id === 'guru' ? 'approved' : 'refunded', product: { name: 'DevClub' }, payment: { method: 'credit_card', total: id === 'guru' ? 1000 : 350, currency: 'BRL' }, calculation_details: { total_amount: id === 'guru' ? 1000 : 350, net_amount: id === 'guru' ? 900 : 315 }, dates: { created_at: timestamp, ordered_at: timestamp, canceled_at: timestamp } }] }
  return emptyProviderPayload(id)
}
await context.route('**/*', async route => {
  const url = new URL(route.request().url())
  if (url.origin !== base) { external.push(url.origin); await route.abort(); return }
  if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
  calls.push(url.pathname)
  if (url.pathname !== '/api/access' && gate) await gate
  const sourceId = url.pathname === '/api/transactions' ? 'guru' : url.pathname === '/api/refunds' ? 'guruRefunds' : url.pathname === '/api/hotmart/vendas' ? 'hotmart' : url.pathname === '/api/hotmart/reembolsos' ? 'hotmartRefunds' : url.pathname === '/api/boleto/asaas/vendas' ? 'asaas' : url.pathname === '/api/boleto/boletex/vendas' ? 'boletex' : url.pathname.startsWith('/api/boleto/vendas/') ? 'tmb' : null
  if (sourceId && mode === 'unavailable') { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) }); return }
  let body
  if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly', 'refunds'], isAdmin: true } }
  else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today: date, payloadForSource: payload, statusForSource: () => mode === 'unavailable' ? 'unavailable' : 'ready' })
  else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
  else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
  else if (sourceId) body = payload(sourceId)
  else body = { data: [] }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
})
const page = await context.newPage()
await page.clock.setFixedTime(new Date('2026-10-01T16:00:00-03:00'))
page.on('pageerror', error => errors.push(error.message))
try {
  for (const { path, width, theme } of [
    { path: 'diario', width: 1440, theme: 'light' },
    { path: 'global', width: 1440, theme: 'dark' },
    { path: 'mensal', width: 360, theme: 'light' },
    { path: 'anual', width: 360, theme: 'dark' },
  ]) {
    hold(); mode = 'known'
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/${path}`, { waitUntil: 'domcontentloaded' })
    const refund = page.getByRole('region', { name: 'Resumo de reembolsos' })
    const revenue = page.getByRole('region', { name: 'Resumo financeiro' })
    await refund.locator('.refund-summary-amount .financial-value[data-state="loading"]').waitFor()
    if (theme === 'dark' !== await page.evaluate(() => document.documentElement.classList.contains('dark'))) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
    assert.match(await refund.locator('.refund-summary-amount').innerText(), /Carregando valor/)
    assert.doesNotMatch(await refund.locator('.refund-summary-amount').innerText(), /R\$/)
    assert.equal(await revenue.locator('.revenue-card-value .financial-value[data-state="loading"]').count(), 4, 'Each of the four financial cards must show its pending state')
    for (const value of await revenue.locator('.revenue-card-value').all()) {
      assert.match(await value.innerText(), /Carregando valor/)
      assert.doesNotMatch(await value.innerText(), /R\$/)
    }
    assert.equal(await refund.locator('.financial-value-skeleton').first().evaluate(element => getComputedStyle(element).animationName), 'none', 'Reduced motion must disable skeleton animation')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} loading overflow`)
    await refund.screenshot({ path: `${out}/${path}-${width}-${theme}-loading.png`, animations: 'disabled' })
    await revenue.screenshot({ path: `${out}/${path}-${width}-${theme}-financial-loading.png`, animations: 'disabled' })
    release()
    await refund.locator('.refund-summary-amount .financial-value[data-state="ready"]').waitFor()
    assert.match(await refund.locator('.refund-summary-amount').innerText(), /R\$\s*350,00/)
    assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
    assert.equal(await revenue.locator('.revenue-card-value .financial-value[data-state="ready"]').count(), 4)
    assert.match(await revenue.getByTestId('revenue-gross-value').innerText(), /R\$\s*1\.000,00/)
    assert.match(await revenue.getByTestId('revenue-operational-value').innerText(), /R\$\s*900,00/)
    assert.match(await revenue.locator('.revenue-card--cash .revenue-card-value').innerText(), /R\$\s*900,00/)
    assert.match(await revenue.locator('.revenue-card--card .revenue-card-value').innerText(), /R\$\s*900,00/)
    assert.match(await revenue.locator('.revenue-card--boleto .revenue-card-value').innerText(), /R\$\s*0,00/)
    checks.push(`${path}/${width}/${theme}: all five card values pending, no premature zero, response shown, reduced motion`)
  }

  await page.goto(`${base}/diario`, { waitUntil: 'networkidle' })
  const refund = page.getByRole('region', { name: 'Resumo de reembolsos' })
  const revenue = page.getByRole('region', { name: 'Resumo financeiro' })
  hold()
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await refund.locator('.refund-summary-amount .financial-value[data-state="refreshing"]').waitFor()
  assert.match(await refund.locator('.refund-summary-amount').innerText(), /R\$\s*350,00\s+Atualizando/)
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-skeleton').count(), 0)
  assert.equal(await revenue.locator('.revenue-card-value .financial-value[data-state="refreshing"]').count(), 4)
  for (const value of await revenue.locator('.revenue-card-value').all()) {
    assert.match(await value.innerText(), /R\$\s*(?:1\.000|900|0),00\s+Atualizando/)
    assert.equal(await value.locator('.financial-value-skeleton').count(), 0)
  }
  release()
  await refund.locator('.refund-summary-amount .financial-value[data-state="ready"]').waitFor()
  checks.push('refresh preserves the previous amount and displays Atualizando')

  mode = 'zero'
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await page.waitForFunction(() => /R\$\s*0,00/.test(document.querySelector('.refund-summary-amount')?.textContent || ''))
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
  for (const value of await revenue.locator('.revenue-card-value').all()) assert.match(await value.innerText(), /R\$\s*0,00/)
  checks.push('successful empty period displays a known zero without loading')

  mode = 'unavailable'
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('.refund-summary-amount')?.textContent === 'Não informado')
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-skeleton').count(), 0)
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
  for (const value of await revenue.locator('.revenue-card-value').all()) {
    assert.match(await value.innerText(), /Não informado|Indisponível/)
    assert.equal(await value.locator('.financial-value-skeleton').count(), 0)
    assert.equal(await value.locator('.financial-value-status').count(), 0)
  }
  checks.push('unavailable sources stay unknown, never zero or endlessly loading')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, checks, fixtureApiCalls: calls.length, errors, external }, null, 2))
  console.log(JSON.stringify({ passed: true, checks: checks.length, fixtureApiCalls: calls.length, errors, external }))
} finally { release?.(); await browser.close() }
