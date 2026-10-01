// Exercise the real TV editor/player with synthetic sessions and isolated API fixtures.
// No production identity, provider requests or persisted production writes are used.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
import { readPublishedVault } from './published-vault.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/tv-mode', import.meta.url))
await fs.mkdir(out, { recursive: true })
const today = '2026-10-15'
const now = new Date(`${today}T15:00:00-03:00`)
let base = process.env.DASHBOARD_SMOKE_URL, server, browser, page, serverOutput = ''
let admin = true, permissions = ['ranking', 'monthly', 'goals'], scenario = 'normal'
const panelIds = ['monthly-goal', 'pace', 'team-goals', 'product-goals', 'sellers', 'products', 'daily', 'payment-mix']
let savedSettings = { version: 1, mode: 'rotate', fixedPanel: 'monthly-goal', metric: 'cash', monthMode: 'current', month: '', theme: 'system', paceScope: 'overall', paceScopeId: '', panels: panelIds.map(id => ({ id, enabled: !['daily', 'payment-mix'].includes(id), durationSeconds: 20 })) }
let settingsWrites = 0, revision = 0, completed = false
let share = { enabled: false, token: null, path: null, revision: 0, updatedAt: null }
const shareWrites = []
let controlledClock = false
const calls = [], checks = [], errors = [], unexpected = [], blocked = [], layoutIssues = []
const applicationAssets = new Map()
let assets = null
const profile = { id: 'fixture-admin', name: 'Admin TV', email: 'admin@example.test', role: 'gestor', active: true }
const directory = {
  teams: [{ id: 'commercial', name: 'Comercial', active: true }, { id: 'marketing', name: 'Marketing', active: true }],
  individuals: [{ id: 'ana', name: 'Ana', teamId: 'commercial', active: true }, { id: 'bruno', name: 'Bruno', teamId: 'marketing', active: true }],
}
const scopes = [
  { scope: 'overall', scopeId: '', scopeName: 'Geral', product: 'all' },
  ...directory.teams.map(team => ({ scope: 'team', scopeId: team.id, scopeName: team.name, product: 'all' })),
  ...['DevClub', 'MBA', 'IAClub'].map(product => ({ scope: 'product', scopeId: product, scopeName: product, product })),
  ...directory.individuals.map(person => ({ scope: 'individual', scopeId: person.id, scopeName: person.name, product: 'all' })),
]
const plans = ['gross', 'cash'].flatMap(metric => scopes.map((scope, index) => ({ ...scope, id: `${metric}-${index}`, metric, target: scope.scope === 'overall' ? 5000 : 2000, superTarget: 7000, ultraTarget: 9000, paceBasis: 'calendar' })))
const includes = (range, date) => range.startDate <= date && range.endDate >= date
function provider(id, range) {
  if (scenario === 'empty') return emptyProviderPayload(id)
  const month = range.startDate.slice(0, 7)
  if (!['2026-09', '2026-10'].includes(month)) return emptyProviderPayload(id)
  if (id === 'hotmart') {
    const transactions = [1, 7, 15].map((day, index) => ({ transaction: `h${index + 1}`, product: index === 2 ? 'MBA em Inteligência Artificial' : 'DevClub', grossValue: 300, netValue: 277.88, fee: 22.12, paymentMethod: index === 2 ? 'PIX' : 'CREDIT_CARD', currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', orderDate: `${month}-${String(day).padStart(2, '0')}T12:00:00-03:00` })).filter(row => includes(range, row.orderDate.slice(0, 10)))
    return { success: true, data: { financialSchemaVersion: 2, count: transactions.length, totalGross: transactions.length * 300, totalNet: transactions.length * 277.88, totalFees: transactions.length * 22.12, transactions } }
  }
  if (id === 'tmb') return { success: true, data: includes(range, `${month}-07`) ? [{ id: 'tmb-1-0', raw: { pedido_id: 1 }, product: 'IAClub', value: 1000, timestamp: `${month}-07T10:00:00-03:00` }] : [] }
  if (id === 'asaas' && includes(range, `${month}-15`)) return { success: true, data: { count: 3, totalGross: 1255.36, totalNet: 1255.36, totalFees: 0, cashReceipts: [{ date: `${month}-15`, received: 1255.36, count: 3 }], cashReceiptOrigins: { schemaVersion: 1, basis: 'checkout_created_at', status: 'unavailable', rows: [{ receiptDate: `${month}-15`, saleDate: null, received: 1255.36, count: 3 }] }, sales: null, availability: { cash: 'ready', sales: 'unavailable', reason: 'checkout_disabled' } } }
  return emptyProviderPayload(id)
}

async function fixture(route) {
  const req = route.request(), url = new URL(req.url())
  if (!url.pathname.startsWith('/api/')) {
    const publicPath = url.pathname === '/ranking' || url.pathname.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
    if (url.origin !== base || req.method() !== 'GET' || (published && !publicPath)) {
      blocked.push({ external: url.origin !== base, method: req.method(), resource: req.resourceType(), opaqueScript: /^\/[A-Za-z0-9_-]{80,}$/.test(url.pathname) })
      await route.abort(); return
    }
    await route.continue(); return
  }
  // Cross-origin production API URLs are intercepted as fixtures before network.
  if (req.method() === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type,x-client-info,prefer,range,range-unit', 'access-control-allow-methods': 'GET,PUT,POST,HEAD,OPTIONS' } }); return
  }
  const method = req.method(), path = url.pathname
  calls.push({ path, method, query: url.searchParams.toString(), scenario, admin, permissions: [...permissions] })
  let body, status = 200
  if (path === '/api/access') body = { user: { sub: profile.id, email: profile.email, name: profile.name, permissions, isAdmin: admin } }
  else if (path === '/api/hub/session') body = { user: { ...profile, role: admin ? 'gestor' : 'vendedor' } }
  else if (path === '/api/tv/share') {
    assert.equal(admin, true, 'Only administrators may read or manage the public TV capability')
    if (method === 'POST') {
      const input = req.postDataJSON()
      assert.ok(['create', 'rotate', 'disable'].includes(input.action))
      if (input.expectedRevision !== share.revision) { status = 409; body = { code: 'TV_SHARE_CONFLICT', error: 'O link foi alterado por outro administrador. Atualize antes de continuar.' } }
      else {
        shareWrites.push(input)
        const nextRevision = share.revision + 1
        const token = input.action === 'disable' ? null : `fixtureTv${String(nextRevision).padStart(7, '0')}`
        share = { enabled: Boolean(token), token, path: token ? `/tv/${token}` : null, revision: nextRevision, updatedAt: now.toISOString() }
        body = share
      }
    } else body = share
  }
  else if (path === '/api/tv/settings') {
    if (scenario === 'settings-error') { status = 503; body = { error: 'Configuração temporariamente indisponível' } }
    else if (method === 'PUT') {
      assert.equal(admin, true, 'Only an administrator can write TV settings')
      const input = req.postDataJSON()
      if (input.expectedRevision !== revision) { status = 409; body = { code: 'TV_SETTINGS_CONFLICT', error: 'A programação foi alterada por outro administrador. Recarregue antes de salvar.' } }
      else {
        settingsWrites++
        revision++
        savedSettings = input.settings
        body = { settings: savedSettings, revision, updatedAt: now.toISOString() }
      }
    } else body = { settings: savedSettings, revision, updatedAt: revision ? now.toISOString() : null }
  } else if (path.startsWith('/api/hub/rest/v1/')) {
    const table = path.split('/').pop()
    if (table === 'profiles') body = [profile, ...directory.individuals.map(person => ({ ...person, role: 'vendedor', team_id: person.teamId, individual_goal: 2000 }))]
    else if (table === 'teams') body = directory.teams
    else if (table === 'team_settings') body = { id: 'setting', team_goal: 5000, origins: [] }
    else if (table === 'monthly_goals') body = { month: 10, year: 2026, team_goal: 5000, monthly_hyper_goal: 7000 }
    else body = []
  } else if (path === '/api/period-cache') {
    if (scenario === 'data-error') { status = 503; body = { error: 'Fontes indisponíveis' } }
    else body = periodCacheFixture(url, { today, payloadForSource: provider })
  } else if (path === '/api/goal-plans/options') body = directory
  else if (/^\/api\/goal-plans\/\d{4}\/\d{1,2}$/.test(path)) body = { plans: scenario === 'empty' ? [] : plans }
  else if (path === '/api/sales-ops/ledger') body = { data: { manualSales: [], attributions: [1, 2, 3].map(index => ({ source: 'hotmart', externalId: `h${index}`, sellerId: index === 3 ? 'bruno' : 'ana', sellerName: index === 3 ? 'Bruno' : 'Ana' })).concat({ source: 'tmb', externalId: '1', sellerId: 'ana', sellerName: 'Ana' }) } }
  else if (path.startsWith('/api/goals/')) body = { success: true, data: { meta: 5000, superMeta: 7000, ultraMeta: 9000 } }
  else {
    const source = path === '/api/transactions' ? 'guru' : path === '/api/refunds' ? 'guruRefunds' : path === '/api/hotmart/vendas' ? 'hotmart' : path === '/api/hotmart/reembolsos' ? 'hotmartRefunds' : path === '/api/boleto/asaas/vendas' ? 'asaas' : path === '/api/boleto/boletex/vendas' ? 'boletex' : path.startsWith('/api/boleto/vendas/') ? 'tmb' : null
    if (!source) { unexpected.push(`${method} ${path}`); await route.abort(); return }
    const date = (url.searchParams.get('date') || today).slice(0, 10)
    body = provider(source, { startDate: url.searchParams.get('data_inicio') || date, endDate: url.searchParams.get('data_final') || date })
  }
  if (method !== (path === '/api/tv/settings' && method === 'PUT' ? 'PUT' : (path === '/api/tv/share' && method === 'POST') || ['/api/transactions', '/api/refunds'].includes(path) ? 'POST' : 'GET')) { unexpected.push(`${method} ${path}`); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base }, body: JSON.stringify(body) })
}

try {
  if (!base) {
    assert.equal(published, false, 'Published asset verification requires an explicit production URL')
    const socket = createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: ['ignore', 'pipe', 'pipe'] })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(base)).ok } catch { /* Starting Vite. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br' : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'TV fixture targets localhost or the explicitly opted-in Dashboard public assets')
  let vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) {
    const html = await (await fetch(`${base}/ranking`)).text()
    const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Published entry asset exists')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
    const config = await readPublishedVault({ base, main })
    vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
    assets = { main, publicVaultConfigured: true }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(({ vaultUrl, clientId }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture-admin', iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
    // Rejection models browsers / embedded displays that disallow Fullscreen API.
    Element.prototype.requestFullscreen = async () => { throw new DOMException('Fixture fullscreen refusal', 'NotAllowedError') }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
      if (window.fixtureClipboardDenied) throw new DOMException('Fixture clipboard refusal', 'NotAllowedError')
      window.fixtureClipboard = text
    } } })
  }, vault)
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() })
  })
  await page.clock.install({ time: now })

  const preview = () => page.getByTestId('tv-preview')
  const player = () => page.getByTestId('tv-player')
  const editor = () => page.getByRole('form', { name: 'Programação da TV' })
  const record = name => checks.push(name)
  const expectMain = async (container, amount) => expect(container.getByTestId('tv-main-value')).toHaveText(`R$ ${amount}`, { timeout: 15000 })
  const visit = async () => {
    await page.goto(`${base}/ranking`, { waitUntil: 'networkidle' })
    if (controlledClock) await page.clock.runFor(1000) // React's lazy-route fallback has a timed minimum duration.
    await page.getByRole('heading', { name: 'TV Mode', exact: true }).waitFor()
  }
  const configure = async () => { await page.getByRole('button', { name: 'Configurar TV', exact: true }).click(); await editor().waitFor() }
  const save = async () => { await editor().getByRole('button', { name: 'Salvar programação', exact: true }).click(); await editor().waitFor({ state: 'hidden' }) }
  const start = async () => { await page.getByRole('button', { name: 'Iniciar TV', exact: true }).click(); await player().waitFor() }
  const noOverflow = async name => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: viewport fits`)
  const screenshot = async name => { await noOverflow(name); await page.screenshot({ path: `${out}/${name}.png`, fullPage: await player().count() === 0, animations: 'disabled' }) }

  await visit()
  await expectMain(preview(), '1.233,64')
  assert.doesNotMatch(await preview().innerText(), /1\.255,36|2\.489,00/, 'Invoice cash cannot appear in the new-sales TV')
  record('Initial monthly preview uses shared financial rules: Hotmart net833.64 + TMB40%400, with Asaas invoices excluded')

  const sharing = () => page.getByTestId('tv-sharing')
  const publicAddress = () => sharing().getByRole('textbox', { name: 'Endereço público da TV', exact: true })
  await sharing().getByRole('heading', { name: 'Link público da TV', exact: true }).waitFor()
  await sharing().getByRole('button', { name: 'Criar link público', exact: true }).click()
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000001`)
  assert.equal(shareWrites.length, 1)
  assert.deepEqual(shareWrites[0], { action: 'create', expectedRevision: 0 })
  assert.equal(await publicAddress().getAttribute('readonly'), '')
  await expect(sharing().getByRole('link', { name: 'Abrir TV pública', exact: true })).toHaveAttribute('href', `${base}/tv/fixtureTv0000001`)
  await screenshot('sharing-1440-admin')
  await page.setViewportSize({ width: 360, height: 900 })
  await visit()
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000001`)
  await screenshot('sharing-360-admin')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await visit()
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000001`)
  await sharing().getByRole('button', { name: 'Copiar link', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixtureClipboard), `${base}/tv/fixtureTv0000001`)
  await page.evaluate(() => { window.fixtureClipboardDenied = true })
  await sharing().getByRole('button', { name: 'Copiar link', exact: true }).click()
  await expect(sharing()).toContainText(/copi|selecion/i)
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000001`)
  assert.equal(await publicAddress().evaluate(element => element.selectionEnd - element.selectionStart), `${base}/tv/fixtureTv0000001`.length, 'A failed clipboard write selects the full URL for manual copying')
  record('Administrator creates a short public URL, can open/copy it and retains a manual copy fallback when the clipboard is denied')

  await sharing().getByRole('button', { name: 'Trocar link', exact: true }).click()
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000002`)
  assert.deepEqual(shareWrites[1], { action: 'rotate', expectedRevision: 1 })
  await sharing().getByRole('button', { name: 'Desativar link', exact: true }).click()
  await expect(sharing().getByRole('button', { name: 'Criar link público', exact: true })).toBeVisible()
  await expect(publicAddress()).toHaveCount(0)
  assert.deepEqual(shareWrites[2], { action: 'disable', expectedRevision: 2 })
  assert.equal(share.enabled, false)
  record('Administrator rotates the capability and disables public sharing; the UI removes the revoked URL')

  share = { ...share, revision: share.revision + 1 } // A second administrator changed the capability.
  await sharing().getByRole('button', { name: 'Criar link público', exact: true }).click()
  await expect(sharing().getByRole('alert')).toContainText(/Outro administrador/)
  assert.equal(shareWrites.length, 3, 'A stale sharing revision must never overwrite another administrator')
  await sharing().getByRole('button', { name: 'Criar link público', exact: true }).click()
  await expect(publicAddress()).toHaveValue(`${base}/tv/fixtureTv0000005`)
  assert.deepEqual(shareWrites[3], { action: 'create', expectedRevision: 4 })
  record('Concurrent link modification reloads the current revision and requires a fresh deliberate action')

  await configure()
  assert.equal(await editor().getByTestId('tv-config-monthly-goal').count(), 1)
  assert.equal(await editor().locator('[data-testid^="tv-config-"]').count(), 8)
  await editor().getByRole('combobox', { name: /^Tema da TV/ }).selectOption('light')
  await editor().getByLabel('Exibir Vendas do dia', { exact: true }).check()
  await editor().getByLabel('Exibir Meios de pagamento', { exact: true }).check()
  await editor().getByRole('spinbutton', { name: /Tempo de Meta do mês/ }).fill('10')
  await editor().getByRole('spinbutton', { name: /Tempo de Ritmo da meta/ }).fill('11')
  await editor().getByRole('combobox', { name: /^Escopo do gráfico de pace/ }).selectOption('team')
  await editor().getByRole('combobox', { name: /^Alvo do gráfico de pace/ }).selectOption('commercial')
  await editor().getByRole('button', { name: 'Subir Top produtos', exact: true }).click()
  await save()
  assert.equal(settingsWrites, 1)
  assert.equal(savedSettings.panels.every(panel => panel.enabled), true)
  assert.deepEqual(savedSettings.panels.map(panel => panel.id), ['monthly-goal', 'pace', 'team-goals', 'product-goals', 'products', 'sellers', 'daily', 'payment-mix'])
  assert.equal(savedSettings.panels[0].durationSeconds, 10)
  assert.equal(savedSettings.panels[1].durationSeconds, 11)
  assert.equal(savedSettings.paceScope, 'team')
  assert.equal(savedSettings.paceScopeId, 'commercial')
  await visit()
  await expectMain(preview(), '1.233,64')
  record('Admin config persists panel selection, custom order, independent durations and theme through a fresh page load')

  await page.setViewportSize({ width: 1920, height: 1080 })
  // Freeze only after initial rendering; rotate deterministically thereafter.
  await page.clock.pauseAt(new Date(now.getTime() + 300000))
  controlledClock = true
  await page.waitForLoadState('networkidle')
  await start()
  assert.equal(await player().getAttribute('data-panel-id'), 'monthly-goal')
  await expectMain(player(), '1.233,64')
  assert.equal(await player().getAttribute('data-tv-theme'), 'light')
  await screenshot('monthly-1920-light')
  await page.getByRole('button', { name: 'Pausar apresentação', exact: true }).click()
  await page.clock.runFor(25000)
  assert.equal(await player().getAttribute('data-panel-id'), 'monthly-goal', 'Paused TV must not rotate')
  await page.getByRole('button', { name: 'Próximo painel', exact: true }).click()
  assert.equal(await player().getAttribute('data-panel-id'), 'pace')
  await page.getByRole('button', { name: 'Painel anterior', exact: true }).click()
  assert.equal(await player().getAttribute('data-panel-id'), 'monthly-goal')
  await page.getByRole('button', { name: 'Retomar apresentação', exact: true }).click()
  await page.clock.runFor(10100)
  assert.equal(await player().getAttribute('data-panel-id'), 'pace', 'Resume uses the first panel duration')
  await page.clock.runFor(11100)
  assert.equal(await player().getAttribute('data-panel-id'), 'team-goals', 'Second panel uses its own duration')
  await page.getByRole('button', { name: 'Pausar apresentação', exact: true }).click()
  record('Fullscreen refusal falls back to the immersive player; pause/resume, previous/next and per-panel rotation timers work')

  const beforePanels = calls.length
  const seen = new Set()
  for (let index = 0; index < 8; index++) {
    const id = await player().getAttribute('data-panel-id')
    seen.add(id)
    const text = await player().innerText()
    assert.doesNotMatch(text, /1\.255,36|2\.489,00/, `${id}: old invoice receipts stay excluded`)
    if (id === 'monthly-goal') await expectMain(player(), '1.233,64')
    if (id === 'pace') { await expectMain(player(), '955,76'); assert.match(text, /Comercial/i) }
    if (id === 'daily') await expectMain(player(), '277,88')
    if (id === 'sellers') { assert.match(text, /Ana/); assert.match(text, /Bruno/); assert.match(text, /955,76/) }
    if (id === 'products') { assert.match(text, /DevClub/); assert.match(text, /MBA/); assert.match(text, /IAClub/) }
    if (id === 'team-goals') { assert.match(text, /Comercial/); assert.match(text, /Marketing/) }
    if (id === 'payment-mix') { assert.match(text, /Cartão/); assert.match(text, /Boleto/); assert.match(text, /Pix/) }
    if (['pace', 'sellers', 'payment-mix'].includes(id)) await screenshot(`${id}-1920-light`)
    if (['monthly-goal', 'pace'].includes(id)) {
      const size = await player().locator('.tv-broadcast-main').evaluate(node => ({ scrollHeight: node.scrollHeight, clientHeight: node.clientHeight }))
      if (size.scrollHeight > size.clientHeight + 1) layoutIssues.push({ panel: id, viewport: '1920x1080', ...size })
    }
    await page.getByRole('button', { name: 'Próximo painel', exact: true }).click()
  }
  assert.deepEqual([...seen].sort(), [...panelIds].sort())
  assert.equal(calls.length, beforePanels, 'Scene switching reuses the loaded month instead of refetching all providers')
  await page.getByRole('button', { name: 'Retomar apresentação', exact: true }).click()
  await page.clock.runFor(20100)
  assert.equal(await player().getAttribute('data-panel-id'), 'product-goals', 'The one-minute unchanged settings poll cannot reset the playlist to its first scene')
  await page.getByRole('button', { name: 'Pausar apresentação', exact: true }).click()
  await page.keyboard.press('Escape')
  await player().waitFor({ state: 'hidden' })
  await preview().waitFor()
  await expect(page.getByRole('button', { name: 'Iniciar TV', exact: true })).toBeFocused()
  record('All eight panels render useful data from one shared month; financial totals remain consistent; Escape restores the workspace')

  await configure()
  await editor().getByRole('button', { name: 'Produtos', exact: true }).click()
  assert.equal(await editor().locator('input[type="checkbox"]:checked').count(), 3)
  assert.equal(await editor().locator('[data-testid^="tv-config-"]').first().getAttribute('data-testid'), 'tv-config-products')
  await editor().getByRole('button', { name: 'Cancelar', exact: true }).click()
  assert.equal(settingsWrites, 1)
  assert.equal(savedSettings.panels.filter(panel => panel.enabled).length, 8)
  record('Scenario preset composes a product-focused playlist; cancelling leaves the shared live program unchanged')

  // A fixed historical month and fixed scene must remain fixed during unattended playback.
  await configure()
  await editor().getByRole('combobox', { name: /^Exibição/ }).selectOption('fixed')
  await editor().getByRole('combobox', { name: /^Painel fixo/ }).selectOption('monthly-goal')
  await editor().getByRole('combobox', { name: /^Base financeira/ }).selectOption('gross')
  await editor().getByRole('combobox', { name: /^Período/ }).selectOption('fixed')
  await editor().getByLabel(/^Mês de referência/).fill('2026-09')
  await editor().getByRole('combobox', { name: /^Tema da TV/ }).selectOption('dark')
  await save()
  await expectMain(preview(), '1.900,00')
  await start()
  assert.equal(await player().getAttribute('data-tv-theme'), 'dark')
  assert.match(await player().innerText(), /setembro de 2026/i)
  await page.clock.runFor(35000)
  assert.equal(await player().getAttribute('data-panel-id'), 'monthly-goal')
  await expectMain(player(), '1.900,00')
  await screenshot('monthly-1920-dark-fixed')
  await player().getByRole('group', { name: /^Explorar Ritmo diário/ }).focus()
  await page.keyboard.press('Escape')
  await player().waitFor({ state: 'hidden' })
  record('Fixed scene and September selection remain fixed; gross mode shows1900 rather than cash1233.64')
  await page.clock.resume()
  controlledClock = false

  // A reader sees the shared admin selection but has no editor or write action.
  admin = false
  await page.setViewportSize({ width: 360, height: 900 })
  const writesBeforeReader = settingsWrites
  const shareReadsBeforeReader = calls.filter(call => call.path === '/api/tv/share').length
  const shareWritesBeforeReader = shareWrites.length
  await visit()
  await expectMain(preview(), '1.900,00')
  assert.equal(await page.getByRole('button', { name: 'Configurar TV', exact: true }).count(), 0)
  assert.equal(await sharing().count(), 0)
  assert.equal(calls.filter(call => call.path === '/api/tv/share').length, shareReadsBeforeReader, 'Readers cannot request the secret public capability')
  assert.equal(shareWrites.length, shareWritesBeforeReader)
  await start()
  await expectMain(player(), '1.900,00')
  await screenshot('monthly-360-dark-reader')
  await page.keyboard.press('Escape')
  assert.equal(settingsWrites, writesBeforeReader)
  record('Non-admin viewer inherits saved September/gross/dark settings on mobile and has no editor or write path')

  // Permissions remain enforced even though TV settings are shared by the workspace.
  permissions = ['ranking']
  const permissionStart = calls.length
  await visit()
  await page.getByRole('heading', { name: 'Acesso aos indicadores da TV', exact: true }).waitFor()
  await expect(page.getByRole('button', { name: 'Iniciar TV', exact: true })).toBeDisabled()
  const forbidden = calls.slice(permissionStart).filter(call => /^\/api\/(?:period-cache|goal-plans|sales-ops\/ledger|transactions|hotmart|boleto)/.test(call.path))
  assert.deepEqual(forbidden, [], 'Ranking-only access cannot trigger unauthorized financial reads')
  await page.getByRole('button', { name: 'Ranking comercial', exact: true }).click()
  await page.getByRole('heading', { name: 'Sales Ranking', exact: true }).waitFor()
  record('Ranking-only account cannot fetch TV financial data and retains access to the original commercial ranking')

  admin = true
  permissions = ['ranking', 'monthly', 'goals']
  scenario = 'empty'
  await page.setViewportSize({ width: 1440, height: 1000 })
  await visit()
  await expectMain(preview(), '0,00')
  assert.match(await preview().innerText(), /meta|configurad/i)
  record('A valid empty month renders zero with an unconfigured-goal state')

  scenario = 'data-error'
  await visit()
  await page.getByText(/Vendas indisponíveis|carregar os dados da TV/).first().waitFor()
  await expect(preview().getByTestId('tv-main-value')).toHaveText('—')
  record('Financial read failure renders an explicit unavailable state instead of invented zero values')

  scenario = 'settings-error'
  await visit()
  await page.getByRole('alert').filter({ hasText: /Configuração temporariamente indisponível/ }).waitFor()
  await expect(page.getByRole('button', { name: 'Iniciar TV', exact: true })).toBeDisabled()
  record('Unavailable TV configuration cannot start an invented default broadcast')

  scenario = 'normal'
  await visit()
  await configure()
  await editor().getByRole('combobox', { name: /^Tema da TV/ }).selectOption('light')
  revision++ // Another administrator saved between this editor's GET and PUT.
  const beforeConflict = settingsWrites
  await editor().getByRole('button', { name: 'Salvar programação', exact: true }).click()
  await editor().getByRole('button', { name: 'Carregar programação mais recente', exact: true }).waitFor()
  assert.equal(settingsWrites, beforeConflict, 'Stale editor must not overwrite shared settings')
  assert.equal(savedSettings.theme, 'dark')
  await editor().getByRole('button', { name: 'Carregar programação mais recente', exact: true }).click()
  await expect(editor().getByRole('combobox', { name: /^Tema da TV/ })).toHaveValue('dark')
  await editor().getByRole('button', { name: 'Cancelar', exact: true }).click()
  record('Concurrent editor conflict preserves the server configuration and offers explicit reload')

  assert.deepEqual(errors, [])
  assert.deepEqual(unexpected, [])
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript), 'Only optional same-origin opaque scripts may be blocked')
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200), 'All requested application assets succeeded')
  assert.deepEqual(layoutIssues, [], 'The 1080p TV must fit its monthly and pace panels without scrolling')
  completed = true
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, settingsWrites, shareWrites: shareWrites.length, errors, unexpected, blocked }))
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`)
  }
  throw error
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: completed, published, assets, checks, apiCalls: calls.length, calls, settingsWrites, shareWrites, realApiRequests: 0, realWrites: 0, errors, unexpected, blocked, layoutIssues, applicationAssets: [...applicationAssets.values()] }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
