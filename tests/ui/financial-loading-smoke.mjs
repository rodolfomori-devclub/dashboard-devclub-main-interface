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
  if (mode.startsWith('daily-')) {
    if (id === 'guru') return { success: true, data: [{ id: 'incident-guru', status: 'approved', product: { name: 'DevClub' }, payment: { method: 'credit_card', total: 171000, currency: 'BRL' }, calculation_details: { total_amount: 171000, net_amount: 171000 }, dates: { created_at: timestamp, ordered_at: timestamp } }] }
    if (id === 'hotmart') {
      if (mode === 'daily-hotmart-malformed') return { success: true, data: { count: 1, transactions: 'invalid' } }
      const net = mode === 'daily-corrected' ? 28000 : mode === 'daily-hotmart-partial' ? null : 29000
      const coverage = complete => ({ known: complete ? 1 : 0, missing: complete ? 0 : 1, foreign: 0, complete, currencies: complete ? ['BRL'] : [] })
      return { success: true, data: { financialSchemaVersion: 2, reportingCurrency: 'BRL', count: 1, totalGross: 29000, totalNet: net, totalFees: 0,
        financialCoverage: { gross: coverage(true), net: coverage(net !== null), fees: coverage(true) },
        transactions: [{ transaction: 'incident-hotmart', product: 'DevClub', status: 'APPROVED', paymentMethod: 'CREDIT_CARD', orderDate: new Date(timestamp * 1000).toISOString(), grossValue: 29000, netValue: net, fee: 0, currency: 'BRL', netCurrency: net === null ? null : 'BRL', feeCurrency: 'BRL', netSource: net === null ? 'unavailable' : 'producer_commission' }] } }
    }
    return emptyProviderPayload(id)
  }
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
  const sourceId = url.pathname === '/api/transactions' ? 'guru' : url.pathname === '/api/refunds' ? 'guruRefunds' : url.pathname === '/api/hotmart/vendas' ? 'hotmart' : url.pathname === '/api/hotmart/reembolsos' ? 'hotmartRefunds' : url.pathname === '/api/hubla/vendas' ? 'hubla' : url.pathname === '/api/hubla/reembolsos' ? 'hublaRefunds' : url.pathname === '/api/boleto/asaas/vendas' ? 'asaas' : url.pathname === '/api/boleto/boletex/vendas' ? 'boletex' : url.pathname.startsWith('/api/boleto/vendas/') ? 'tmb' : null
  if (sourceId && (mode === 'unavailable' || (sourceId === 'hotmart' && mode === 'daily-hotmart-down'))) { await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) }); return }
  let body
  if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly', 'refunds'], isAdmin: true } }
  else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today: date, payloadForSource: payload, statusForSource: () => mode === 'unavailable' ? 'unavailable' : 'ready' })
  else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
  else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
  else if (sourceId) {
    const posted = route.request().method() === 'POST' ? route.request().postDataJSON() : null
    const startDate = posted?.ordered_at_ini || url.searchParams.get('date') || url.searchParams.get('data_inicio')
    const endDate = posted?.ordered_at_end || url.searchParams.get('date') || url.searchParams.get('data_final')
    body = payload(sourceId, startDate && endDate ? { startDate, endDate } : undefined)
  }
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
    assert.match(await refund.locator('.refund-summary-amount').innerText(), /R\$\s*315,00/)
    assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
    assert.equal(await revenue.locator('.revenue-card-value .financial-value[data-state="ready"]').count(), 4)
    assert.match(await revenue.getByTestId('revenue-gross-value').innerText(), /R\$\s*900,00/)
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
  assert.match(await refund.locator('.refund-summary-amount').innerText(), /R\$\s*315,00\s+Atualizando/)
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-skeleton').count(), 0)
  assert.equal(await revenue.locator('.revenue-card-value .financial-value[data-state="refreshing"]').count(), 4)
  for (const value of await revenue.locator('.revenue-card-value').all()) {
    assert.match(await value.innerText(), /R\$\s*(?:900|0),00\s+Atualizando/)
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

  const waitDailyReady = () => page.waitForFunction(() => {
    const button = document.querySelector('.daily-refresh button')
    return button && !button.disabled && button.textContent === 'Atualizar dados'
  })
  async function refreshDaily(nextMode) {
    mode = nextMode
    await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
    await waitDailyReady()
  }
  async function unknownValues() {
    assert.equal((await refund.locator('.refund-summary-amount').innerText()).trim(), 'Não informado')
    assert.equal(await refund.locator('.refund-summary-amount .financial-value-skeleton').count(), 0)
    assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
    for (const value of await revenue.locator('.revenue-card-value').all()) {
      assert.match(await value.innerText(), /Não informado|Indisponível/)
      assert.doesNotMatch(await value.innerText(), /R\$/)
      assert.equal(await value.locator('.financial-value-skeleton').count(), 0)
      assert.equal(await value.locator('.financial-value-status').count(), 0)
    }
  }
  await refreshDaily('unavailable')
  assert.match(await refund.locator('.refund-summary-amount').innerText(), /R\$\s*0,00/)
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-skeleton').count(), 0)
  assert.equal(await refund.locator('.refund-summary-amount .financial-value-status').count(), 0)
  for (const value of await revenue.locator('.revenue-card-value').all()) {
    assert.match(await value.innerText(), /R\$\s*0,00/)
    assert.equal(await value.locator('.financial-value-skeleton').count(), 0)
    assert.equal(await value.locator('.financial-value-status').count(), 0)
  }
  assert.match(await page.getByTestId('daily-source-warning').innerText(), /últim|preservad|mantid|anterior/i)
  assert.match(await revenue.locator('.revenue-card--card .revenue-coverage').innerText(), /Parcial/)
  checks.push('failed refresh preserves a previously confirmed zero, labels its source as stale and stops loading')

  // A hard reload has no in-memory source baseline. Unknown must never become
  // a fabricated zero, and a date change must not borrow another day's cache.
  await page.reload({ waitUntil: 'networkidle' })
  await waitDailyReady()
  await unknownValues()
  await page.getByLabel('Data', { exact: true }).fill('2026-09-30')
  await waitDailyReady()
  await unknownValues()
  checks.push('unavailable sources without a baseline remain unknown after reload and across dates, without endless loading')

  mode = 'daily-full'
  await page.reload({ waitUntil: 'networkidle' })
  await waitDailyReady()
  const cardValue = revenue.locator('.revenue-card--card .revenue-card-value')
  const normalizedCard = async () => (await cardValue.innerText()).replace(/\s+/g, ' ').trim()
  assert.equal(await normalizedCard(), 'R$ 200.000,00')
  await revenue.locator('.revenue-card--card summary').click()
  assert.match(await revenue.locator('.revenue-card--card [data-provider="guru"]').innerText(), /171\.000,00/)
  assert.match(await revenue.locator('.revenue-card--card [data-provider="hotmart"]').innerText(), /29\.000,00/)
  await page.clock.setFixedTime(new Date('2026-10-01T16:05:00-03:00'))
  for (const broken of ['daily-hotmart-down', 'daily-hotmart-malformed', 'daily-hotmart-partial']) {
    await refreshDaily(broken)
    assert.equal(await normalizedCard(), 'R$ 200.000,00', `${broken}: failed or incomplete Hotmart cannot silently reduce the card total to Guru alone`)
    const warning = await page.getByTestId('daily-source-warning').innerText()
    assert.match(warning, /Hotmart/)
    assert.match(warning, /últim|preservad|mantid|anterior/i)
    assert.match(warning, /16:00/, 'Retained Hotmart values must show the time of the last successful reading')
    assert.match(await revenue.locator('.revenue-card--card .revenue-coverage').innerText(), /Parcial/)
    assert.match(await revenue.locator('.revenue-card--card [data-provider="hotmart"]').innerText(), /29\.000,00/)
    assert.equal(await cardValue.locator('.financial-value-skeleton').count(), 0)
    await page.getByTestId('daily-source-warning').screenshot({ path: `${out}/${broken}-warning.png` })
  }
  checks.push('Guru 171k + Hotmart 29k stays 200k through Hotmart HTTP 503, malformed HTTP 200 and missing producer commission; source warning retains its original timestamp')

  await refreshDaily('daily-corrected')
  assert.equal(await normalizedCard(), 'R$ 199.000,00', 'A confirmed lower provider amount must replace the previous total')
  assert.equal(await page.getByTestId('daily-source-warning').count(), 0, 'A healthy recovery clears the stale warning')
  assert.match(await revenue.locator('.revenue-card--card [data-provider="hotmart"]').innerText(), /28\.000,00/)
  checks.push('healthy recovery accepts a genuine lower total of 199k instead of applying a monotonic maximum')

  // Changing date during a delayed refresh must discard the previous response,
  // even though the source request is allowed to finish in the shared cache.
  mode = 'daily-full'
  hold()
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await page.getByLabel('Data', { exact: true }).fill('2026-09-30')
  await page.waitForFunction(() => document.querySelectorAll('.revenue-card-value .financial-value[data-state="loading"]').length === 4)
  for (const value of await revenue.locator('.revenue-card-value').all()) assert.doesNotMatch(await value.innerText(), /199\.000|200\.000/)
  release()
  await waitDailyReady()
  assert.equal(await normalizedCard(), 'R$ 0,00', 'A completed prior-day request must not overwrite the newly selected day')
  checks.push('switching dates during an in-flight refresh does not display or restore financial values from another day')
  assert.deepEqual(errors, []); assert.deepEqual(external, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, checks, fixtureApiCalls: calls.length, errors, external }, null, 2))
  console.log(JSON.stringify({ passed: true, checks: checks.length, fixtureApiCalls: calls.length, errors, external }))
} finally { release?.(); await browser.close() }
