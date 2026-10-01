// Public TV verification uses owned browser contexts, synthetic aggregates and
// intercepted APIs. Production mode reads public application assets only.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { buildTvData } from '../../src/components/tv/tvData.js'
import { defaultTvSettings } from '../../src/components/tv/tvConfig.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/tv-public', import.meta.url))
await fs.mkdir(out, { recursive: true })
const token = 'fixtureTv0000001'
const now = new Date('2026-10-15T15:00:00-03:00')
const source = id => ({ id, label: id, platform: id, kind: 'sale', status: 'ready' })
const directory = { teams: [{ id: 'sales', name: 'Comercial' }], individuals: [{ id: 'ana', name: 'Ana', teamId: 'sales' }] }
const sale = (id, extra = {}) => ({ id, sourceId: 'hotmart', platform: 'Hotmart', kind: 'sale', quantity: 1, date: '2026-10-15T14:00:00Z', family: 'DevClub', gross: 300, net: 277.88, revenue: 277.88, payment: 'Cartão', sellerId: 'ana', ...extra })
const initialModel = buildTvData({ year: 2026, month: 10, today: '2026-10-15', metric: 'cash', directory,
  plans: [{ scope: 'overall', metric: 'cash', target: 5000 }, { scope: 'team', scopeId: 'sales', metric: 'cash', target: 5000 }],
  sales: { records: [sale('h1'), sale('h2'), sale('h3'), sale('t1', { sourceId: 'tmb', platform: 'TMB', gross: 1000, revenue: 1000, family: 'MBA', payment: 'Boleto' })], sources: [source('hotmart'), source('tmb')] },
})
delete initialModel.directory // Public projection does not include the internal identity directory.
assert.equal(Math.round(initialModel.totals.cash * 100), 123364)
let settings = defaultTvSettings()
settings.theme = 'dark'
settings.panels = settings.panels.map(panel => ({ ...panel, enabled: ['monthly-goal', 'pace', 'sellers'].includes(panel.id), durationSeconds: 10 }))
let model = structuredClone(initialModel), revision = 1, updatedAt = now.toISOString(), scenario = 'ready'
let base = process.env.DASHBOARD_SMOKE_URL, server, serverOutput = '', browser, page, complete = false
let contextLabel = 'anonymous', assets = null
const requests = [], blocked = [], unexpected = [], errors = [], checks = [], privateScripts = []
const applicationAssets = new Map()
const record = name => checks.push(name)

async function fixture(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method()
  if (!url.pathname.startsWith('/api/')) {
    if (/\/src\/(?:PrivateWorkspace|contexts\/AuthContext|lib\/(?:vault-sdk|api))\./.test(url.pathname) || /\/assets\/PrivateWorkspace-/.test(url.pathname)) privateScripts.push(url.pathname)
    const allowedAsset = /^\/tv(?:\/.*)?$/.test(url.pathname) || url.pathname.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
    if (url.origin !== base || method !== 'GET' || (published && !allowedAsset)) {
      blocked.push({ external: url.origin !== base, method, path: url.pathname, resource: request.resourceType() })
      await route.abort(); return
    }
    await route.continue(); return
  }
  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET,OPTIONS' } }); return
  }
  requests.push({ path: url.pathname, query: url.search, method, context: contextLabel, scenario, authorization: request.headers().authorization || null, cookie: request.headers().cookie || null })
  if (!['/api/tv/public', `/api/tv/public/${token}`].includes(url.pathname) || url.search || method !== 'GET') {
    unexpected.push(`${method} ${url.pathname}`)
    await route.abort(); return
  }
  assert.equal(request.headers().authorization, undefined, 'Anonymous TV must never send a Vault bearer token')
  assert.equal(request.headers().cookie, undefined, 'Anonymous TV must omit credentials even when a stale session cookie exists')
  if (scenario === 'network-error') { await route.abort('failed'); return }
  const status = scenario === 'revoked' ? 404 : scenario === 'unavailable' ? 503 : 200
  const publicSettings = { ...settings, panels: settings.panels.filter(panel => panel.enabled && (settings.mode !== 'fixed' || panel.id === settings.fixedPanel)) }
  delete publicSettings.paceScope
  delete publicSettings.paceScopeId
  const body = scenario === 'revoked' ? { code: 'TV_LINK_NOT_FOUND', error: 'Link da TV indisponível.' }
    : scenario === 'unavailable' ? { error: 'Indicadores temporariamente indisponíveis.' }
      : scenario === 'warming' ? { settings: publicSettings, revision, model: null, updatedAt: null, loading: true, error: null }
        : { settings: publicSettings, revision, model, updatedAt, loading: false, error: null }
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'cache-control': 'no-store' }, body: JSON.stringify(body) })
}

async function createContext({ stale = false } = {}) {
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1920, height: 1080 } })
  await context.addInitScript(({ stale }) => {
    if (stale) {
      localStorage.setItem('vault_access_token', 'expired-fixture-access-token')
      localStorage.setItem('vault_refresh_token', 'expired-fixture-refresh-token')
      localStorage.setItem('vault_user', JSON.stringify({ id: 'fixture-stale-user' }))
      document.cookie = 'fixture_stale_session=expired; path=/'
    }
    window.fixturePublicFetches = []
    const originalFetch = window.fetch
    window.fetch = (input, options) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('/api/tv/public')) window.fixturePublicFetches.push({ credentials: options?.credentials, hasAuthorization: Boolean(new Headers(options?.headers).get('authorization')) })
      return originalFetch(input, options)
    }
    Element.prototype.requestFullscreen = async () => { throw new DOMException('Fixture fullscreen refusal', 'NotAllowedError') }
  }, { stale })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  const next = await context.newPage()
  next.setDefaultTimeout(15000)
  next.on('pageerror', error => errors.push(error.message))
  next.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, response.status())
  })
  await next.clock.install({ time: now })
  return { context, page: next }
}

try {
  if (!base) {
    assert.equal(published, false, 'Production fixture verification needs an explicit public asset URL')
    const socket = createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(base)).ok } catch { /* Starting the owned Vite server. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br' : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  if (published) {
    const html = await (await fetch(`${base}/tv`)).text()
    const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Production public route serves the application entry point')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
    assets = { main }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const first = await createContext()
  page = first.page
  const player = () => page.getByTestId('tv-player')
  const noAuth = async (path = '/tv') => {
    assert.equal(await page.getByRole('button', { name: 'Entrar pelo Vault', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Configurar TV', exact: true }).count(), 0)
    assert.equal(await page.getByRole('button', { name: 'Ativar link público', exact: true }).count(), 0)
    assert.equal(await page.getByRole('link', { name: 'Visão global', exact: true }).count(), 0)
    assert.equal(new URL(page.url()).pathname, path)
  }
  const checkValue = () => expect(player().getByTestId('tv-main-value')).toHaveText('R$ 1.233,64')
  const shot = async name => {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`)
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: false, animations: 'disabled' })
  }
  await page.goto(`${base}/tv`, { waitUntil: 'networkidle' })
  await player().waitFor()
  await checkValue()
  await noAuth()
  assert.equal(await player().getAttribute('data-tv-theme'), 'dark')
  assert.equal(await page.evaluate(() => localStorage.length), 0, 'Public viewing does not create an authentication session')
  assert.equal(requests.at(-1).path, '/api/tv/public', 'The easy-to-type address requests the canonical anonymous endpoint')
  record('Fresh anonymous browser opens /tv directly with no Vault, suffix, sidebar, settings or private API calls')
  await shot('public-1920-dark')
  await page.getByRole('button', { name: 'Entrar em tela cheia', exact: true }).click()
  await player().waitFor()
  await checkValue()
  assert.equal(await page.getByRole('button', { name: 'Sair da TV', exact: true }).count(), 0)
  record('Public TV keeps playing when the device rejects the Fullscreen API and has no exit into private navigation')

  await page.clock.pauseAt(new Date(now.getTime() + 30000))
  await page.getByRole('button', { name: 'Pausar apresentação', exact: true }).click()
  await page.getByRole('button', { name: 'Próximo painel', exact: true }).click()
  assert.equal(await player().getAttribute('data-panel-id'), 'pace')
  await page.getByRole('button', { name: 'Painel anterior', exact: true }).click()
  assert.equal(await player().getAttribute('data-panel-id'), 'monthly-goal')
  await page.getByRole('button', { name: 'Retomar apresentação', exact: true }).click()
  await page.clock.runFor(10100)
  assert.equal(await player().getAttribute('data-panel-id'), 'pace')
  await page.keyboard.press('Escape')
  await player().waitFor()
  await noAuth()
  record('Public playback supports manual navigation and automatic rotation; Escape never opens private workspace')

  // The admin can remotely change the program without requiring a new URL.
  settings = { ...settings, mode: 'fixed', fixedPanel: 'monthly-goal', theme: 'light' }
  revision++
  await page.clock.runFor(61000)
  await expect(player()).toHaveAttribute('data-panel-id', 'monthly-goal')
  await expect(player()).toHaveAttribute('data-tv-theme', 'light')
  await checkValue()
  assert.match(await player().innerText(), /Painel fixo/)
  record('Shared settings refresh updates the existing anonymous TV to the admin-selected fixed/light presentation')

  scenario = 'network-error'
  const beforeOutage = requests.length
  await page.clock.runFor(61000)
  await expect.poll(() => requests.length).toBeGreaterThan(beforeOutage)
  await checkValue()
  await expect(player().getByRole('status')).toContainText(/atualiz|conexão|últim|indispon|carregar/i)
  record('Transient network outage keeps the last known aggregates with a visible stale/error indicator')

  scenario = 'ready'
  await page.clock.runFor(61000)
  await checkValue()
  await page.setViewportSize({ width: 360, height: 900 })
  await shot('public-360-light')
  await noAuth()
  record('Anonymous viewer remains usable on a narrow display in light mode')

  scenario = 'revoked'
  await page.clock.runFor(61000)
  await expect(player()).toHaveCount(0)
  assert.doesNotMatch(await page.locator('body').innerText(), /1\.233,64|5\.000,00/, 'Revoked links must clear previously displayed financial data')
  await expect(page.getByRole('heading').filter({ hasText: /link.*indispon|link.*desativ|acesso.*indispon|TV.*indispon/i })).toBeVisible()
  await noAuth()
  record('A revoked link removes the playing scene and all retained financial values at the next access check')
  await first.context.close()

  scenario = 'ready'
  contextLabel = 'stale-vault'
  const stale = await createContext({ stale: true })
  page = stale.page
  await page.goto(`${base}/tv`, { waitUntil: 'networkidle' })
  await player().waitFor()
  await checkValue()
  await noAuth()
  const options = await page.evaluate(() => window.fixturePublicFetches)
  assert.ok(options.length > 0)
  assert.ok(options.every(request => request.credentials === 'omit' && !request.hasAuthorization))
  assert.equal(await page.evaluate(() => localStorage.getItem('vault_access_token')), 'expired-fixture-access-token', 'Public route does not try to refresh or clear unrelated Vault state')
  record('Stale Vault tokens and cookies are ignored; public requests explicitly omit credentials and Authorization')

  scenario = 'unavailable'
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('heading', { name: 'Não foi possível abrir a TV', exact: true }).waitFor()
  assert.equal(await player().count(), 0)
  assert.doesNotMatch(await page.locator('body').innerText(), /1\.233,64|R\$\s*0,00/)
  await noAuth()
  scenario = 'ready'
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click()
  await checkValue()
  record('Initial API outage shows a recoverable error; retry opens the public TV without asking for a Vault session')

  scenario = 'warming'
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect(page.getByText(/Carregando os indicadores|preparando.*indicadores|Preparando a TV|Abrindo a TV/i).first()).toBeVisible()
  assert.doesNotMatch(await page.locator('body').innerText(), /R\$\s*0,00/, 'A cache still warming must not invent zero values')
  await noAuth()
  record('A warming shared cache renders loading rather than fabricated zero sales')

  scenario = 'ready'
  await page.goto(`${base}/tv/`, { waitUntil: 'networkidle' })
  await checkValue()
  await noAuth('/tv/')
  assert.equal(requests.at(-1).path, '/api/tv/public')
  record('/tv/ with a trailing slash opens the same anonymous canonical presentation')

  contextLabel = 'legacy-link'
  await page.goto(`${base}/tv/${token}`, { waitUntil: 'networkidle' })
  await checkValue()
  await noAuth(`/tv/${token}`)
  assert.equal(requests.at(-1).path, `/api/tv/public/${token}`)
  assert.ok((await page.evaluate(() => window.fixturePublicFetches)).every(request => request.credentials === 'omit' && !request.hasAuthorization))
  record('Previously shared 16-character token links still work without authentication or credentials')

  // Invalid or deeper URLs cannot silently select the canonical public feed.
  for (const path of ['/tv/invalid', `/tv/${token}/extra`, '/tv/invalid/extra', '/tv/public']) {
    const beforeInvalid = requests.length
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading').filter({ hasText: /link.*inválid|link.*indispon|TV.*indispon/i })).toBeVisible()
    assert.equal(requests.length, beforeInvalid, `${path}: no API request`)
    assert.equal(await player().count(), 0)
    await noAuth(path)
  }
  record('Malformed and deep public paths cannot open private workspace or request canonical/legacy API data')

  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  assert.deepEqual(privateScripts, [], 'The anonymous entry must not load the private workspace or Vault SDK')
  assert.ok(requests.every(request => request.method === 'GET' && ['/api/tv/public', `/api/tv/public/${token}`].includes(request.path) && !request.query && !request.authorization && !request.cookie))
  assert.ok([...applicationAssets.values()].every(status => status === 200))
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && /^\/[A-Za-z0-9_-]{80,}$/.test(item.path)), 'Only optional opaque production scripts may be blocked')
  complete = true
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: requests.length, privateApiRequests: 0, errors }))
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`)
  }
  throw error
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: complete, published, assets, checks, requests, blocked, unexpected, errors, privateScripts, realApiRequests: 0, realWrites: 0, applicationAssets: [...applicationAssets.entries()] }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
