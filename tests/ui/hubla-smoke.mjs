// Synthetic Hubla data only: all API traffic is intercepted and no credentials are used.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import * as XLSX from 'xlsx'
import { emptyProviderPayload, periodCacheFixture } from './period-cache-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = fileURLToPath(new URL('./artifacts/hubla', import.meta.url))
await fs.mkdir(out, { recursive: true })
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = '', browser
server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-4000) })
server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-4000) })
const day = '2026-10-28'
const invoice = (transaction, product, netValue, paymentMethod = 'CREDIT_CARD') => ({ transaction, product, netValue,
  grossValue: netValue + 100, fee: 100, currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', paymentMethod,
  orderDate: `${day}T12:00:00-03:00`, buyer: 'Cliente sintético', utm_source: 'Comercial-Ana' })
const pack = transactions => ({ success: true, data: { financialSchemaVersion: 2, count: transactions.length,
  totalNet: transactions.reduce((sum, row) => sum + row.netValue, 0),
  totalFees: transactions.reduce((sum, row) => sum + row.fee, 0), transactions } })
const payload = (id, range) => {
  if (range && (range.startDate > day || range.endDate < day)) return emptyProviderPayload(id)
  if (id === 'hotmart') return pack([invoice('hotmart-1', 'Hotmart somente', 500)])
  if (id === 'hubla') return pack([invoice('hubla-1', 'DevClub Hubla', 900), invoice('hubla-2', 'IAClub Hubla', 200, 'PIX')])
  if (id === 'hublaRefunds') return pack([{ ...invoice('hubla-refund', 'Reembolso Hubla', 90), status: 'REFUNDED', refundAmount: 100, refundCurrency: 'BRL' }])
  return emptyProviderPayload(id)
}
const calls = [], errors = [], unexpected = [], checks = []
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    try { ready = (await fetch(base)).ok } catch { /* Vite starting */ }
    if (ready) break
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  assert.ok(ready, `Vite did not start: ${serverOutput}`)
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', acceptDownloads: true })
  await context.addInitScript(base => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture', iss: base, aud: 'local-fixture-client', token_use: 'access', exp: 4102444800 })}.synthetic`)
  }, base)
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) {
      if (url.origin !== base || request.method() !== 'GET') { unexpected.push(`${request.method()} ${url.origin}${url.pathname}`); await route.abort(); return }
      await route.continue(); return
    }
    calls.push(url.pathname)
    let body
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', name: 'Fixture', permissions: ['today', 'monthly', 'yearly'], isAdmin: true } }
    else if (url.pathname === '/api/period-cache') body = periodCacheFixture(url, { today: day, payloadForSource: payload })
    else if (url.pathname === '/api/sales-ops/ledger') body = { data: { manualSales: [], attributions: [], utmMappings: [] } }
    else if (url.pathname.startsWith('/api/goals/')) body = { success: true, data: { meta: 0, superMeta: 0, ultraMeta: 0 } }
    else {
      const id = ({ '/api/transactions': 'guru', '/api/refunds': 'guruRefunds', '/api/hotmart/vendas': 'hotmart',
        '/api/hotmart/reembolsos': 'hotmartRefunds', '/api/hubla/vendas': 'hubla', '/api/hubla/reembolsos': 'hublaRefunds',
        '/api/boleto/asaas/vendas': 'asaas', '/api/boleto/boletex/vendas': 'boletex' })[url.pathname]
        || (url.pathname.startsWith('/api/boleto/vendas/') ? 'tmb' : null)
      if (!id) { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
      body = payload(id)
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date(`${day}T16:00:00-03:00`))
  const card = title => page.locator('.revenue-card').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  const assertMoney = async (title, amount) => assert.ok((await card(title).locator('.revenue-card-value').innerText()).includes(amount), `${title} must show ${amount}`)
  for (const path of ['diario', 'mensal', 'anual']) {
    await page.setViewportSize({ width: 1440, height: 1050 })
    await page.goto(`${base}/${path}`, { waitUntil: 'networkidle' })
    await page.waitForFunction(() => document.querySelector('.revenue-highlights')?.getAttribute('aria-busy') === 'false')
    await assertMoney('Cartão', '1.600,00')
    await assertMoney('Cash collected', '1.600,00')
    await card('Cartão').locator('summary').click()
    assert.deepEqual(await card('Cartão').locator('[data-provider]').evaluateAll(nodes => nodes.map(node => node.dataset.provider)), ['hotmart', 'hubla'])
    await page.getByLabel('Plataforma', { exact: true }).selectOption('Hubla')
    await assertMoney('Valor das vendas', '1.100,00')
    await assertMoney('Cartão', '1.100,00')
    await assertMoney('Cash collected', '1.100,00')
    assert.equal(await page.locator('.refund-summary-provider[data-provider="hubla"]').count(), 1)
    assert.equal(await page.locator('.refund-summary-provider').count(), 1)
    await page.locator('.revenue-highlights').screenshot({ path: `${out}/${path}-hubla-financials.png`, animations: 'disabled' })
    checks.push(`${path}: Hubla appears separately, filters all totals, uses full net cash, and groups original Pix with Cartão.`)
    if (path === 'mensal') {
      await page.getByLabel('Produto', { exact: true }).selectOption('DevClub Hubla')
      await assertMoney('Cartão', '900,00')
      const downloading = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Exportar Excel', exact: true }).click()
      const download = await downloading
      const workbook = XLSX.read(await fs.readFile(await download.path()), { type: 'buffer' })
      const rows = XLSX.utils.sheet_to_json(workbook.Sheets.Vendas)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].Fonte, 'hubla')
      assert.equal(rows[0]['Categoria de pagamento'], 'Cartão')
      assert.equal(rows[0]['Valor das vendas'], 900)
      assert.equal(rows[0].Recebido, 900)
      assert.equal(rows[0]['UTM Source'], 'Comercial-Ana')
      checks.push('Monthly Excel exports the filtered Hubla invoice with net sale value, full net cash and preserved UTM.')
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await page.locator('.revenue-highlights').screenshot({ path: `${out}/${path}-hubla-mobile.png`, animations: 'disabled' })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} must not overflow horizontally`)
  }
  assert.ok(calls.includes('/api/hubla/vendas') && calls.includes('/api/hubla/reembolsos'))
  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ checks, calls, errors, unexpected }, null, 2))
  console.log(`Hubla UI smoke passed: ${checks.length} checks; screenshots in ${out}`)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
