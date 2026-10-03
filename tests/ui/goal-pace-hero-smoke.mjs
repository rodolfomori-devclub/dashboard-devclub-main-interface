import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { createServer } from 'node:net'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

// Actual application, synthetic identity and provider payloads. No live API access.
const root = fileURLToPath(new URL('../../', import.meta.url))
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/goal-pace-hero', import.meta.url))
await fs.mkdir(out, { recursive: true })
let server, browser, base = process.env.DASHBOARD_SMOKE_URL
const results = [], errors = [], unexpected = [], calls = []
let scenario = 'normal'
let gate = null, release = null
const hold = () => { gate = new Promise(resolve => { release = () => { gate = null; resolve() } }) }
const today = '2026-09-15'
const plans = ['gross', 'cash'].flatMap(metric => [
  { scope: 'overall', scopeId: '', scopeName: 'Geral', product: 'all' },
  { scope: 'product', scopeId: 'DevClub', scopeName: 'DevClub', product: 'DevClub' },
  { scope: 'team', scopeId: 'team-commercial', scopeName: 'Comercial', product: 'all' },
  { scope: 'individual', scopeId: 'seller-ana', scopeName: 'Ana', product: 'all' },
].map((scope, index) => ({ ...scope, id: `${metric}-${index}`, metric, target: metric === 'gross' ? 30000 : 12000, superTarget: 35000, ultraTarget: 40000, paceBasis: 'calendar' })))
const receipt = (id, day, product, gross) => ({ hash: id, product: { name: product }, payment: { method: 'credit_card', total: gross }, calculation_details: { total_amount: gross, net_amount: gross }, dates: { created_at: Math.floor(new Date(`2026-09-${day}T12:00:00-03:00`).getTime() / 1000) }, contact: { name: 'Pessoa fixture', email: 'fixture@example.test' } })
const providerResponse = path => {
  const unknown = scenario === 'unknown'
  if (path === '/api/access') return { user: { sub: 'fixture-user', email: 'fixture@example.test', name: 'QA fixture', permissions: ['goal-pace', 'goals'], isAdmin: true } }
  if (path === '/api/goal-plans/options') return { teams: [{ id: 'team-commercial', name: 'Comercial', active: true }], individuals: [{ id: 'seller-ana', name: 'Ana', teamId: 'team-commercial', active: true }] }
  if (/^\/api\/goal-plans\/\d{4}\/\d{1,2}$/.test(path)) return { plans }
  if (path === '/api/transactions') return { data: unknown ? [receipt('unknown', '07', 'DevClub', null)] : [receipt('guru-1', '01', 'DevClub', 1000), receipt('guru-2', '07', 'MBA em IA', 2000), receipt('guru-3', '15', 'IAClub', 500)] }
  if (path === '/api/refunds') return { data: [] }
  if (path === '/api/hotmart/vendas') return { success: true, data: { count: 0, transactions: [] } }
  if (path === '/api/hotmart/reembolsos') return { success: true, data: { count: 0, transactions: [] } }
  if (path.startsWith('/api/boleto/vendas/')) return { success: true, data: unknown ? [] : [{ id: 'tmb-1-0', raw: { pedido_id: 1 }, product: 'DevClub Vitalício', value: 800, timestamp: '2026-09-10T12:00:00-03:00' }] }
  if (path === '/api/boleto/asaas/vendas') return { success: true, data: { sales: null, totalGross: unknown ? 0 : 900, totalNet: unknown ? 0 : 850, totalFees: unknown ? 0 : 50, count: unknown ? 0 : 1, availability: { sales: 'unavailable', cash: 'ready', reason: 'checkout_disabled' }, cashReceipts: unknown ? [] : [{ date: '2026-09-08', received: 900, count: 1 }] } }
  if (path === '/api/boleto/boletex/vendas') return { success: true, data: { sales: { count: 0, totalValue: 0, entries: [] } } }
  if (path === '/api/sales-ops/ledger') return { data: { attributions: unknown ? [] : [{ source: 'guru', externalId: 'guru-1', sellerId: 'seller-ana', sellerName: 'Ana' }, { source: 'tmb', externalId: '1', sellerId: 'seller-ana', sellerName: 'Ana' }], manualSales: unknown ? [] : [{ id: 1, date: '2026-09-11', product: 'DevClub renovação', family: 'DevClub', gross: 600, net: 600, cashCollected: 600, buyerName: 'Fixture manual', buyerEmail: 'manual@example.test', sellerId: 'seller-ana', sellerName: 'Ana', platform: 'Manual', status: 'pending', syncPending: false }] } }
  return null
}
const record = (name, details = {}) => results.push({ name, passed: true, ...details })

try {
  if (!base) {
    const socket = createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: 'ignore' })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error('Fixture Vite server exited')
      try { ready = (await fetch(base)).ok } catch { /* Starting local server. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, 'Local fixture server started')
  }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'This runner only targets a local application')
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce' })
  await context.addInitScript(() => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'ui-fixture-only' })}.${encode({ sub: 'fixture-user', iss: 'fixture-vault', aud: 'local-fixture-client', token_use: 'access', exp: 4102444800 })}.fixture-signature-not-valid`)
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.startsWith('/api/')) {
      calls.push({ path: url.pathname, method: request.method() })
      if (url.pathname !== '/api/access' && gate) await gate
      if (scenario === 'plans-unavailable' && /^\/api\/goal-plans\/\d{4}\/\d{1,2}$/.test(url.pathname)) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'fixture_unavailable' }) }); return
      }
      const body = providerResponse(url.pathname)
      const expectedMethod = ['/api/transactions', '/api/refunds'].includes(url.pathname) ? 'POST' : 'GET'
      if (!body || request.method() !== expectedMethod) { unexpected.push(`${request.method()} ${url.pathname}`); await route.abort(); return }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) }); return
    }
    if (url.origin !== base || request.method() !== 'GET') { await route.abort(); return }
    await route.continue()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.clock.setFixedTime(new Date(`${today}T15:00:00-03:00`))
  const stage = () => page.locator('.pace-stage').first()
  const chart = () => stage().getByRole('group', { name: 'Explorar Evolução acumulada da meta', exact: true })
  const settled = async () => { await page.getByRole('heading', { name: 'Metas e ritmo de vendas', exact: true }).waitFor(); await page.getByRole('button', { name: 'Atualizar dados', exact: true }).waitFor(); await stage().waitFor() }
  const openMonth = async (month = 9) => { await page.goto(`${base}/pace?year=2026&month=${month}`, { waitUntil: 'networkidle' }); await settled() }
  const noOverflow = async () => {
    await page.waitForFunction(() => document.documentElement.scrollWidth <= window.innerWidth, null, { timeout: 2000 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'No horizontal viewport overflow')
  }
  const tooltip = async key => { await chart().focus(); await page.keyboard.press(key); return chart().locator('.rr-chart-tooltip').innerText() }
  const selectedTotal = () => page.locator('.pace-stat').first().innerText()
  const pending = () => page.getByRole('status', { name: 'Carregando metas e vendas', exact: true })
  const assertPending = async label => {
    await pending().waitFor()
    assert.doesNotMatch(await page.locator('.pace-page').innerText(), /R\$|Sem meta|Não definida|Meta não definida|Nenhum cadastro disponível/i, `${label}: no premature value or empty-state diagnosis`)
    assert.equal(await chart().count(), 0, `${label}: the pending period has no interactive plot`)
    assert.equal(await page.locator('.pace-financial-grid').count(), 0, `${label}: calculated cards wait for the response`)
  }

  hold()
  await page.goto(`${base}/pace?year=2026&month=9`, { waitUntil: 'domcontentloaded' })
  await assertPending('First load')
  for (const width of [1440, 360]) {
    await page.setViewportSize({ width, height: 1000 })
    await noOverflow()
    await pending().screenshot({ path: `${out}/pace-loading-${width}.png`, animations: 'disabled' })
  }
  await page.getByRole('group', { name: 'Escopo da meta' }).getByRole('button', { name: 'Time', exact: true }).click()
  assert.equal(await page.getByLabel('Time', { exact: true }).isDisabled(), true, 'Directory-dependent selection waits for its response')
  await assertPending('Scope selection during first load')
  await page.getByRole('group', { name: 'Escopo da meta' }).getByRole('button', { name: 'Geral', exact: true }).click()
  release()
  await settled()
  assert.equal(await pending().count(), 0)
  assert.match(await selectedTotal(), /4\.900,00/)
  record('First response gates financial results and charts, including mobile and scope selection')

  hold()
  await page.getByRole('button', { name: 'Atualizar dados', exact: true }).click()
  await page.locator('.pace-page').getByRole('status').filter({ hasText: /Atualizando metas e vendas/ }).waitFor()
  assert.equal(await pending().count(), 0, 'Refreshing the same period does not replace known results with skeletons')
  assert.match(await selectedTotal(), /4\.900,00/, 'Refresh retains the last loaded amount')
  assert.equal(await chart().count(), 1, 'Refresh keeps the known chart usable')
  release()
  await settled()
  record('Same-period refresh retains values and graph with an accessible update notice')

  hold()
  await page.getByLabel('Mês', { exact: true }).selectOption('8')
  await assertPending('Month change')
  release()
  await settled()
  assert.equal(await pending().count(), 0, 'The new month leaves loading after its response')
  assert.match(await stage().locator('.pace-stage-heading').innerText(), /Agosto de 2026/)
  record('Changing month hides the prior period until the new response arrives')

  scenario = 'plans-unavailable'
  hold()
  await page.getByLabel('Mês', { exact: true }).selectOption('9')
  await assertPending('Failing month query')
  release()
  await settled()
  assert.equal(await pending().count(), 0, 'A failed plan response ends loading')
  assert.match(await stage().locator('.pace-target').innerText(), /Indisponível/i)
  assert.match(await selectedTotal(), /4\.900,00/, 'A failed plan query preserves available sales')
  assert.match(await page.locator('.daily-feedback').innerText(), /Metas indisponíveis/)
  record('A failed month query terminates pending state and exposes the real error')
  scenario = 'normal'

  for (const width of [1440, 360]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: 1000 })
    await openMonth()
    if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== (theme === 'dark')) await page.getByRole('button', { name: theme === 'dark' ? 'Usar tema escuro' : 'Usar tema claro', exact: true }).click()
    const stageBox = await stage().boundingBox(), pageBox = await page.locator('.pace-page').boundingBox(), chartBox = await chart().boundingBox()
    assert.ok(stageBox.width >= pageBox.width * .95, 'Pace is a full-width composition')
    assert.ok(chartBox.width >= stageBox.width * .85, 'No long summary beside the primary chart')
    assert.ok(chartBox.height >= (width > 600 ? 500 : 340), 'Primary chart has a dominant plot area')
    assert.ok(await stage().evaluate(node => { const other = document.querySelector('.pace-financial-grid'); return !other || Boolean(node.compareDocumentPosition(other) & Node.DOCUMENT_POSITION_FOLLOWING) }), 'Primary chart precedes secondary financial cards')
    assert.equal(await stage().locator(`[data-reference-date="${today}"]`).count(), 1, 'Today is positioned on the calendar')
    assert.match(await selectedTotal(), /4\.900,00/)
    assert.match(await tooltip('Home'), /1\.000,00/)
    const future = await tooltip('End')
    assert.match(future, /30\.000,00/)
    assert.match(future, /Não informado|Não observado|Não iniciado|—/i, 'Future realized remains unknown')
    await page.keyboard.press('Escape')
    await noOverflow()
    for (const selector of ['.pace-stage-actual > strong', '.pace-stage-target > strong']) assert.ok(await stage().locator(selector).evaluate(node => node.getBoundingClientRect().height < Number.parseFloat(getComputedStyle(node).lineHeight) * 1.5), 'Displayed financial values do not wrap a digit onto another line')
    await stage().locator('.pace-stage-heading h2').click()
    await stage().screenshot({ path: `${out}/pace-${theme}-${width}.png`, animations: 'disabled' })
    const before = calls.length
    const expand = stage().getByRole('button', { name: 'Ampliar gráfico', exact: true })
    await expand.click()
    const dialog = page.getByRole('dialog', { name: 'Ritmo da meta em tela ampliada', exact: true })
    await dialog.waitFor()
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Dialog receives keyboard focus')
    for (let n = 0; n < 12; n++) { await page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), `Focus remains inside expanded chart after Tab ${n + 1}; active=${await page.evaluate(() => document.activeElement?.tagName)}`) }
    for (let n = 0; n < 12; n++) { await page.keyboard.press('Shift+Tab'); assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), `Reverse focus remains inside expanded chart after Shift+Tab ${n + 1}`) }
    const expandedChart = dialog.getByRole('group', { name: 'Explorar Evolução acumulada da meta', exact: true })
    await expandedChart.focus(); await page.keyboard.press('Home')
    assert.match(await expandedChart.locator('.rr-chart-tooltip').innerText(), /1\.000,00/)
    await dialog.getByRole('button', { name: 'Recolher gráfico', exact: true }).focus()
    await page.screenshot({ path: `${out}/pace-expanded-${theme}-${width}.png`, animations: 'disabled' })
    await page.keyboard.press('Escape')
    assert.equal(await dialog.isVisible(), false)
    assert.ok(await expand.evaluate(node => node === document.activeElement), 'Closing restores focus to the trigger')
    await expand.click(); await dialog.waitFor()
    await expandedChart.focus(); await page.keyboard.press('Home'); await page.keyboard.press('Escape')
    if (await dialog.isVisible()) {
      assert.equal(await expandedChart.locator('.rr-chart-tooltip').isVisible(), false, 'First Escape dismisses the chart selection')
      await page.keyboard.press('Escape')
    }
    assert.equal(await dialog.isVisible(), false, 'Escape can close the dialog while the plot has focus')
    assert.ok(await expand.evaluate(node => node === document.activeElement))
    assert.equal(calls.length, before, 'Chart exploration and expansion never refetch sales')
    await noOverflow()
    record(`Composition, tooltip, expanded keyboard, ${theme}, ${width}`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openMonth()
  const beforeFilters = calls.length
  await page.getByLabel('Base financeira', { exact: true }).selectOption('cash')
  assert.match(await selectedTotal(), /4\.420,00/, 'Cash includes full Guru net, TMB 40% and manual cash; invoice receipts do not advance new-sales goals')
  for (const scope of ['Time', 'Indivíduo', 'Produto']) {
    await page.getByRole('group', { name: 'Escopo da meta' }).getByRole('button', { name: scope, exact: true }).click()
    if (scope === 'Produto') await page.getByLabel('Família de produto', { exact: true }).selectOption('DevClub')
    assert.match(await selectedTotal(), /1\.920,00/, `${scope} cash uses attributed Guru net 1,000, TMB 320 and manual 600`)
    await page.getByLabel('Base financeira', { exact: true }).selectOption('gross')
    assert.match(await selectedTotal(), /2\.400,00/, `${scope} gross is independent of cash`)
    await page.getByLabel('Base financeira', { exact: true }).selectOption('cash')
    record(`Scope ${scope}: gross and cash`)
  }
  assert.equal(calls.length, beforeFilters, 'Local financial and scope filters do not refetch')
  await openMonth(8)
  assert.equal(await stage().locator('[data-reference-date]').count(), 0, 'Closed month does not show today outside its range')
  assert.match(await tooltip('End'), /30\.000,00/)
  record('Closed month retains full monthly planning')
  const beforeFuture = calls.length
  await openMonth(10)
  assert.equal(await stage().locator('[data-reference-date]').count(), 0)
  assert.match(await selectedTotal(), /Não iniciado/)
  assert.match(await tooltip('End'), /30\.000,00/)
  assert.equal(calls.slice(beforeFuture).filter(call => !/^\/api\/(access|goal-plans)/.test(call.path)).length, 0, 'Future month never asks sales providers')
  record('Future month: planning only, no provider requests')
  scenario = 'unknown'
  await openMonth()
  assert.match(await selectedTotal(), /Não informado/)
  const unknown = await tooltip('Home')
  assert.match(unknown, /Não informado|Não observado|—/i)
  assert.match(unknown, /1\.000,00/, 'Known planning is retained when all gross values are unknown')
  assert.match(await page.locator('.daily-feedback').innerText(), /Leitura parcial/)
  record('Unavailable realized stays absent while planning remains visible')
  scenario = 'plans-unavailable'
  await openMonth()
  assert.match(await stage().locator('.pace-target').innerText(), /Indisponível/i)
  assert.match(await stage().locator('.pace-stage-status').innerText(), /Meta indisponível/)
  assert.match(await page.locator('.daily-feedback').innerText(), /Metas indisponíveis/)
  assert.match(await selectedTotal(), /4\.900,00/, 'Failure of plan query does not erase observed sales')
  assert.match(await tooltip('End'), /Não informado|Não observado|—/i, 'Unknown plan is not plotted as a zero target')
  record('Plan API503: target unavailable, observed sales preserved')
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
} catch (error) {
  errors.push(error.stack || error.message)
  throw error
} finally {
  release?.()
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: errors.length === 0, cases: results, mockedApiRequests: calls.length, realApiRequests: 0, unexpectedRequests: unexpected, errors }, null, 2))
  await browser?.close()
  server?.kill('SIGTERM')
}
console.log(JSON.stringify({ out, passed: true, cases: results.length, mockedApiRequests: calls.length, realApiRequests: 0 }))
