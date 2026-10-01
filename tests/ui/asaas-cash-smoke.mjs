// Standalone fixture-only smoke: no production API, credentials or database.
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../../', import.meta.url))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
let browser
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(serverOutput)
    try { ready = (await fetch(base)).ok } catch { /* startup */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.equal(ready, true, serverOutput)
  const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  const calls = []
  let failedProviders = false
  let cashPause = false, activeCash = 0, peakCash = 0, failCashDate = null
  const cashIntervals = []
  await context.route('**/*', async route => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin !== base) return route.abort()
    if (!url.pathname.startsWith('/api/')) return route.continue()
    calls.push(url.pathname)
    const date = req.method() === 'POST' ? req.postDataJSON()?.ordered_at_ini : url.searchParams.get('date') || url.searchParams.get('data_inicio') || '2026-09-15'
    const timestamp = `${date}T12:00:00-03:00`
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture-user', email: 'qa@example.test', name: 'QA', permissions: ['admin'], isAdmin: true } }
    else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 30000, superMeta: 35000, ultraMeta: 40000 } }
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: { attributions: [], manualSales: [] } }
    else if (url.pathname === '/api/boleto/asaas/vendas') {
      if (cashPause) {
        const start = url.searchParams.get('data_inicio'), end = url.searchParams.get('data_final')
        assert.ok((Date.parse(end) - Date.parse(start)) / 86400000 <= 6, 'cash query exceeds seven inclusive days')
        cashIntervals.push({ start, end }); activeCash++; peakCash = Math.max(peakCash, activeCash)
        await new Promise(resolve => setTimeout(resolve, 60)); activeCash--
        if (start === failCashDate) { failCashDate = null; return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) }) }
      }
      body = { success: true, data: { totalGross: 500, totalNet: 495, totalFees: 5, count: 2, sales: null, totalPurchaseValue: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } }
    }
    else if (failedProviders) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false }) })
    else if (url.pathname === '/api/transactions') body = { data: [{ id: `g-${date}`, product: { name: 'DevClub' }, calculation_details: { net_amount: 100, total_amount: 120 }, dates: { created_at: timestamp } }] }
    else if (url.pathname === '/api/refunds') body = { data: [] }
    else if (url.pathname === '/api/hotmart/vendas') body = { success: true, data: { count: 0, totalGross: 0, totalNet: 0, totalFees: 0, transactions: [] } }
    else if (url.pathname === '/api/hotmart/reembolsos') body = { success: true, data: { count: 0, totalRefundAmount: 0, transactions: [] } }
    else if (url.pathname.startsWith('/api/boleto/vendas/')) body = { success: true, data: [{ id: 'tmb-1', value: 200, product: 'MBA', timestamp }] }
    else if (url.pathname === '/api/boleto/boletex/vendas') body = { success: true, data: { sales: { count: 1, totalValue: 300, confirmedValue: 30, entries: [{ id: 'b1', productDescription: 'IAClub', totalValue: 300, entryValue: 30, createdAt: timestamp }] } } }
    else body = { data: [], plans: [] }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date('2026-09-15T15:00:00-03:00'))
  page.setDefaultTimeout(12000)
  const cash = () => page.getByRole('region', { name: 'Caixa Asaas do período' })
  const card = title => page.locator('article').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  const visit = async path => {
    await page.goto(base + path, { waitUntil: 'networkidle' })
    await cash().waitFor()
    assert.deepEqual(errors, [])
  }
  for (const [path, title, annual] of [['/diario', 'Valor das vendas', false], ['/global', 'Receita operacional', false], ['/mensal', 'Receita operacional', false], ['/anual', 'Receita operacional', true]]) {
    await page.setViewportSize({ width: 1440, height: 1000 })
    const beforeAsaas = calls.filter(path => path === '/api/boleto/asaas/vendas').length
    cashPause = annual
    await visit(path)
    if (annual) {
      assert.equal(calls.filter(path => path === '/api/boleto/asaas/vendas').length, beforeAsaas, 'annual operations must not request Asaas')
      assert.match(await card(title).innerText(), /5\.400,00/)
      assert.match(await cash().innerText(), /ainda não consultado/)
      await page.getByRole('button', { name: 'Consultar caixa Asaas', exact: true }).click()
      await page.getByRole('progressbar', { name: 'Progresso da consulta Asaas' }).waitFor()
      assert.doesNotMatch(await cash().innerText(), /R\$/)
      await cash().getByText('Todos os intervalos foram consultados.', { exact: true }).waitFor()
      assert.equal(cashIntervals.length, 37)
      assert.equal(peakCash, 2)
    }
    assert.match(await card(title).innerText(), annual ? /5\.400,00/ : /600,00/)
    assert.match(await cash().innerText(), annual ? /18\.315,00/ : /495,00/)
    assert.match(await card(title).innerText(), /parcial/i)
    const platform = path === '/diario' ? page.getByLabel('Plataforma', { exact: true }) : page.locator('#period-platform')
    const before = calls.length
    await platform.selectOption('Asaas')
    assert.doesNotMatch(await card(title).innerText(), /R\$/)
    assert.match(await card(title).innerText(), /indispon|Aguardando/i)
    assert.equal(await cash().count(), 1)
    await platform.selectOption('Guru')
    assert.match(await card(title).innerText(), annual ? /900,00/ : /100,00/)
    assert.doesNotMatch(await card(title).innerText(), /parcial/i)
    assert.equal(await cash().count(), 0)
    await platform.selectOption('')
    const product = path === '/diario' ? page.getByLabel('Produto original', { exact: true }) : page.locator('#period-product')
    await product.selectOption('DevClub')
    assert.match(await cash().innerText(), /Caixa sem distribuição/)
    assert.doesNotMatch(await cash().innerText(), /495,00|18\.315,00/)
    await product.selectOption('')
    assert.equal(calls.length, before, `${path}: filters must be local`)
    for (const dark of [false, true]) {
      await page.setViewportSize({ width: 360, height: 1000 })
      if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) await page.getByRole('button', { name: dark ? 'Usar tema escuro' : 'Usar tema claro' }).click()
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, `${path}: mobile overflow`)
    }
    if (annual) {
      failCashDate = '2026-01-01'
      await page.getByRole('button', { name: 'Atualizar caixa Asaas', exact: true }).click()
      await cash().getByText(/Subtotal parcial:/).waitFor()
      assert.match(await cash().innerText(), /36 de 37/)
      const beforeRetry = cashIntervals.length
      await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
      await cash().getByText('Todos os intervalos foram consultados.', { exact: true }).waitFor()
      assert.equal(cashIntervals.length, beforeRetry + 1, 'retry must query only the failed interval')
    }
    console.log(`PASS ${path}: cash preserved, sales partial, Asaas unknown, Guru unaffected, filters no allocation, mobile themes`)
  }
  cashPause = false
  const beforeOptionCache = calls.filter(path => path === '/api/boleto/asaas/vendas').length
  const optionCache = await page.evaluate(async () => {
    const { loadSalesRange } = await import('/src/components/daily/dailyData.js')
    const omitted = await loadSalesRange('2026-08-20', '2026-08-20', { includeAsaas: false })
    const included = await loadSalesRange('2026-08-20', '2026-08-20')
    return [omitted.sources.find(source => source.id === 'asaas').status, included.sources.find(source => source.id === 'asaas').status]
  })
  assert.deepEqual(optionCache, ['not_requested', 'partial'])
  assert.equal(calls.filter(path => path === '/api/boleto/asaas/vendas').length, beforeOptionCache + 1, 'includeAsaas must be part of the cache key')
  failedProviders = true
  await visit('/diario')
  assert.match(await card('Valor das vendas').innerText(), /Indisponível/)
  assert.match(await card('Vendas realizadas').innerText(), /Indisponível/)
  assert.match(await cash().innerText(), /495,00/)
  assert.deepEqual(errors, [])
  console.log('PASS only Asaas cash available with empty manual ledger never becomes zero sales')
} finally {
  if (browser) await browser.close()
  server.kill('SIGTERM')
}
