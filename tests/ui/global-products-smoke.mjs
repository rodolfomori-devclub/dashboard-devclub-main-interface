// Product selection regression: every API response is a fixture, and external traffic is blocked.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'

const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4317'
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'This suite only runs against a local app')
const out = fileURLToPath(new URL('./artifacts/global-products', import.meta.url))
await fs.mkdir(out, { recursive: true })
const today = '2026-10-06'
const productA = 'DevClub Full Stack'
const productB = 'MBA em Inteligência Artificial — Formação completa para desenvolvimento de soluções'
const sales = [
  { id: 'guru-devclub', platform: 'Guru', product: productA, value: 100, payment: 'pix', source: 'meta' },
  { id: 'guru-mba', platform: 'Guru', product: productB, value: 200, payment: 'credit_card', source: 'comercial' },
  { id: 'guru-iaclub', platform: 'Guru', product: 'IAClub', value: 400, payment: 'pix', source: 'youtube' },
  { id: 'guru-unknown', platform: 'Guru', product: null, value: 50, payment: 'pix', source: 'meta' },
  { id: 'hotmart-devclub', platform: 'Hotmart', product: productA, value: 300, payment: 'CREDIT_CARD', source: 'meta' },
  { id: 'hotmart-mba', platform: 'Hotmart', product: productB, value: 500, payment: 'PIX', source: 'comercial' },
]
const bothProducts = sales.filter(row => [productA, productB].includes(row.product))
const errors = [], calls = [], unexpected = [], external = [], checks = []
const inRange = range => range.startDate <= today && range.endDate >= today
function payloadForSource(id, range) {
  if (!inRange(range)) return emptyProviderPayload(id)
  if (id === 'guru') return { success: true, data: sales.filter(row => row.platform === 'Guru').map(row => ({
    hash: row.id, product: { name: row.product }, payment: { method: row.payment, total: row.value + 10 },
    calculation_details: { net_amount: row.value, total_amount: row.value + 10, discounts: { processing_fee: 10 }, net_affiliate_value: 0 },
    dates: { created_at: Math.floor(Date.parse(`${today}T12:00:00-03:00`) / 1000) },
    contact: { name: row.id, email: `${row.id}@example.test` }, trackings: { utm_source: row.source },
  })) }
  if (id === 'hotmart') return { success: true, data: {
    financialSchemaVersion: 2, count: 2, totalGross: 820, totalNet: 800, totalFees: 20,
    transactions: sales.filter(row => row.platform === 'Hotmart').map(row => ({
      transaction: row.id, product: row.product, buyer: row.id, buyerEmail: `${row.id}@example.test`,
      grossValue: row.value + 10, netValue: row.value, fee: 10, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL',
      paymentMethod: row.payment, orderDate: `${today}T12:00:00-03:00`, trackings: { utm_source: row.source },
    })),
  } }
  return emptyProviderPayload(id)
}

const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) })
try {
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
  await context.addInitScript(({ vaultUrl }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'ui-fixture-only' })}.${encode({ sub: 'fixture', iss: vaultUrl, aud: 'local-fixture-client', token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
  }, { vaultUrl: base })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.origin !== base) { external.push(url.origin); await route.abort(); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    calls.push(`${request.method()} ${url.pathname}`)
    const range = request.method() === 'POST'
      ? { startDate: request.postDataJSON().ordered_at_ini, endDate: request.postDataJSON().ordered_at_end }
      : { startDate: url.searchParams.get('data_inicio') || today, endDate: url.searchParams.get('data_final') || today }
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: 'fixture@example.test', name: 'Fixture', permissions: ['today', 'daily', 'monthly', 'yearly', 'goals'], isAdmin: true } }
    else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today, payloadForSource })
    else if (url.pathname === '/api/transactions') body = payloadForSource('guru', range)
    else if (url.pathname === '/api/refunds') body = payloadForSource('guruRefunds', range)
    else if (url.pathname === '/api/hotmart/vendas') body = payloadForSource('hotmart', range)
    else if (url.pathname === '/api/hotmart/reembolsos') body = payloadForSource('hotmartRefunds', range)
    else if (url.pathname.startsWith('/api/boleto/vendas/')) body = payloadForSource('tmb', range)
    else if (url.pathname === '/api/boleto/asaas/vendas') body = payloadForSource('asaas', range)
    else if (url.pathname === '/api/boleto/boletex/vendas') body = payloadForSource('boletex', range)
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
    else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
    else { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
    const method = ['/api/transactions', '/api/refunds'].includes(url.pathname) ? 'POST' : 'GET'
    if (request.method() !== method) { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  await page.clock.setFixedTime(new Date(`${today}T16:00:00-03:00`))
  page.on('pageerror', error => errors.push(error.message))
  const trigger = page.locator('#period-product')
  const menu = page.getByRole('dialog', { name: 'Selecionar produtos', exact: true })
  const search = menu.getByRole('searchbox', { name: 'Buscar produtos', exact: true })
  const checkbox = name => menu.getByRole('checkbox', { name, exact: true })
  const detailSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Detalhamento', exact: true }) })
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\s/g, '')

  async function assertResults(expected) {
    const total = expected.reduce((sum, row) => sum + row.value, 0)
    await page.waitForFunction(expectedText => document.querySelector('[data-testid="revenue-gross-value"]')?.textContent.replace(/\s/g, '') === expectedText, money(total))
    assert.equal((await page.getByTestId('revenue-operational-value').innerText()).replace(/\s/g, ''), money(total))
    const count = page.locator('.revenue-total-details > div').filter({ has: page.locator('dt').filter({ hasText: /^Vendas realizadas$/ }) }).locator('dd')
    assert.equal((await count.innerText()).trim(), String(expected.length))
    assert.deepEqual((await detailSection.locator('tbody tr td:first-child p:first-child').allTextContents()).sort(), expected.map(row => row.id).sort())
    const groups = [...new Set(expected.map(row => row.product || 'Não informado'))].sort()
    assert.deepEqual((await page.locator('.period-distribution-table tbody tr td:first-child button').allTextContents()).sort(), groups)
    assert.equal(await page.getByRole('button', { name: 'Exportar', exact: true }).isEnabled(), expected.length > 0)
  }
  async function assertExport(expected) {
    const downloaded = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exportar', exact: true }).click()
    const download = await downloaded
    const csv = await fs.readFile(await download.path(), 'utf8')
    const rows = csv.replace(/^\uFEFF/, '').trim().split('\r\n').slice(1).map(line => line.split(';').map(cell => cell.slice(1, -1).replaceAll('""', '"')))
    assert.deepEqual(rows.map(row => row[2]).sort(), expected.map(row => row.id).sort(), 'CSV exports the same filtered transactions')
    assert.deepEqual(rows.map(row => row[4]).sort(), expected.map(row => row.product || '').sort(), 'CSV preserves products, including unidentified rows')
    assert.equal(rows.reduce((sum, row) => sum + Number(row[8]), 0), expected.reduce((sum, row) => sum + row.value, 0), 'CSV and financial cards agree')
  }
  async function openProducts() { await trigger.click(); await menu.waitFor() }
  async function closeProducts() { await menu.getByRole('button', { name: 'Concluir', exact: true }).click(); await menu.waitFor({ state: 'hidden' }) }
  async function selectBoth() {
    await openProducts()
    await checkbox(productA).check()
    await checkbox(productB).check()
    await closeProducts()
  }
  async function clearProducts() {
    await openProducts()
    await menu.getByRole('button', { name: 'Todos os produtos', exact: true }).click()
    assert.equal(await menu.getByRole('checkbox', { checked: true }).count(), 0)
    await closeProducts()
  }

  for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto(`${base}/global`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: 'Visão global', exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
    await assertResults(sales)
    assert.equal(await trigger.evaluate(node => node.tagName), 'BUTTON')
    const beforeFilters = calls.length

    await trigger.focus()
    await page.keyboard.press('Enter')
    await menu.waitFor()
    assert.equal(await search.evaluate(node => node === document.activeElement), true, 'Opening with the keyboard focuses product search')
    await search.fill('INTELIGENCIA')
    assert.equal(await menu.getByRole('checkbox').count(), 1, 'Search ignores case and accents')
    await checkbox(productB).focus()
    await page.keyboard.press('Space')
    assert.equal(await checkbox(productB).isChecked(), true)
    await search.fill('')
    await checkbox(productA).check()
    assert.equal(await checkbox(productB).isChecked(), true, 'Selecting another product retains the first selection')
    await assertResults(bothProducts)
    assert.match(await trigger.innerText(), /2 produtos selecionados/)
    const bounds = await menu.boundingBox()
    assert.ok(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, `Product menu fits ${width}px viewport`)
    assert.equal(await menu.evaluate(node => node.scrollWidth <= node.clientWidth), true, 'Long product names stay within the menu')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Open product menu causes no horizontal page overflow')
    await page.screenshot({ path: `${out}/products-${width}-${theme}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Escape restores focus to the product button')
    await assertExport(bothProducts)

    await openProducts()
    assert.equal(await search.inputValue(), '', 'Reopening resets search')
    await checkbox(productA).uncheck()
    assert.equal(await checkbox(productB).isChecked(), true)
    await closeProducts()
    await assertResults(sales.filter(row => row.product === productB))
    await clearProducts()
    await assertResults(sales)
    assert.equal(await page.getByRole('button', { name: 'Limpar filtros', exact: true }).count(), 0, 'All-products mode is an inactive filter')

    await openProducts()
    await checkbox('Não informado').check()
    await checkbox(productA).check()
    await closeProducts()
    const unidentifiedAndA = sales.filter(row => !row.product || row.product === productA)
    await assertResults(unidentifiedAndA)
    await assertExport(unidentifiedAndA)
    await clearProducts()

    await selectBoth()
    await page.locator('#period-platform').selectOption('Guru')
    await assertResults(bothProducts.filter(row => row.platform === 'Guru'))
    await page.locator('#period-payment').selectOption('Pix')
    await assertResults([sales[0]])
    await page.getByText('Origem e campanhas', { exact: true }).click()
    await page.locator('#period-utm-source').selectOption('comercial')
    await assertResults([])
    await page.locator('#period-utm-source').selectOption('meta')
    await assertResults([sales[0]])
    await assertExport([sales[0]])
    await page.getByRole('button', { name: 'Limpar filtros', exact: true }).click()
    await assertResults(sales)
    assert.match(await trigger.innerText(), /Todos os produtos/)
    for (const id of ['period-platform', 'period-payment', 'period-utm-source']) assert.equal(await page.locator(`#${id}`).inputValue(), '')
    assert.equal(calls.length, beforeFilters, 'Product selection, export, and combined filters must never refetch APIs')
    checks.push({ width, theme, multipleProducts: true, keyboard: true, unknownProduct: true, csv: true, combinedFilters: true, localFilters: true, overflow: false })
  }

  for (const [path, title] of [['mensal', 'Visão mensal'], ['anual', 'Visão anual']]) {
    await page.goto(`${base}/${path}`, { waitUntil: 'networkidle' })
    await page.getByRole('heading', { name: title, exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    assert.equal(await trigger.evaluate(node => node.tagName), 'SELECT', `${path} retains its existing single-product filter`)
    assert.equal(await trigger.evaluate(node => node.multiple), false)
    await assertResults(sales)
    const beforeFilter = calls.length
    await trigger.selectOption(productA)
    await assertResults(sales.filter(row => row.product === productA))
    assert.equal(calls.length, beforeFilter, `${path} filtering remains local`)
    checks.push({ path, singleProduct: true, localFilters: true })
  }
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  assert.deepEqual(external, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, checks, apiCalls: calls.length, errors, unexpected, external }, null, 2))
  console.log(JSON.stringify({ passed: true, checks: checks.length, apiCalls: calls.length, errors, unexpected, external, out }))
} finally { await browser.close() }
