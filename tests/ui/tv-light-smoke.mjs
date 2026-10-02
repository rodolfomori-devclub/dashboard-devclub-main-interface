// Run after npm run build. Only local built assets and synthetic public API data
// are used; all other requests are blocked before they can reach the network.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'
import postcss from 'postcss'
import { chromium, expect } from '@playwright/test'
import { buildTvData } from '../../src/components/tv/tvData.js'
import { defaultTvSettings, TV_PANELS } from '../../src/components/tv/tvConfig.js'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/tv-light', import.meta.url))
const now = new Date('2026-10-15T15:00:00-03:00')
const token = 'fixtureTv0000001'
const directory = { teams: [{ id: 'commercial', name: 'Comercial' }], individuals: [{ id: 'ana', name: 'Ana sintética', teamId: 'commercial' }] }
// A new Asaas contract legitimately has different sale and collected-entry
// amounts; Guru/Hotmart now use the authoritative platform net for both.
const source = { id: 'asaas', label: 'Fonte sintética', kind: 'sale', status: 'ready', platform: 'asaas', salesAvailable: true }
const initialModel = buildTvData({ year: 2026, month: 10, today: '2026-10-15', metric: 'cash', directory,
  plans: [{ scope: 'overall' }, { scope: 'team', scopeId: 'commercial' }, { scope: 'product', scopeId: 'DevClub' }].map(scope => ({ ...scope, metric: 'cash', target: 5000 })),
  sales: { sources: [source], records: [{ id: 'synthetic-sale', sourceId: 'asaas', platform: 'Asaas', kind: 'sale', quantity: 1, date: '2026-10-15T14:00:00Z', family: 'DevClub', gross: 1900.12, net: 1233.64, revenue: 1233.64, received: 1233.64, payment: 'Cartão', sellerId: 'ana' }] },
})
delete initialModel.directory
let settings = { ...defaultTvSettings(), theme: 'dark', metric: 'cash', panels: TV_PANELS.map(panel => ({ id: panel.id, enabled: true, durationSeconds: 10 })) }
let model = structuredClone(initialModel), scenario = 'ready', revision = 1
let base = process.env.DASHBOARD_SMOKE_URL, server, serverOutput = '', browser, page, complete = false
const checks = [], requests = [], blocked = [], errors = [], xhrOptions = [], assetPaths = new Set()
const record = name => checks.push(name)

async function fixture(route) {
  const request = route.request(), url = new URL(request.url())
  if (/\/tv\/public(?:\/[^/]*)?$/.test(url.pathname)) {
    assert.equal(request.method(), 'GET')
    assert.equal(request.headers().authorization, undefined, 'Anonymous TV cannot send a Vault token')
    requests.push({ path: url.pathname, authorization: request.headers().authorization || null, cookie: request.headers().cookie || null, scenario })
    if (scenario === 'network-error') { await route.abort('failed'); return }
    const status = scenario === 'revoked' ? 404 : scenario === 'unavailable' ? 503 : 200
    const publicSettings = { ...settings, panels: settings.panels.filter(panel => panel.enabled && (settings.mode !== 'fixed' || panel.id === settings.fixedPanel)) }
    delete publicSettings.paceScope
    delete publicSettings.paceScopeId
    const updatedAt = await request.frame().evaluate(() => new Date().toISOString())
    const body = scenario === 'revoked' ? { code: 'TV_LINK_NOT_FOUND', error: 'Link da TV indisponível.' }
      : scenario === 'unavailable' ? { error: 'Indicadores temporariamente indisponíveis.' }
        : { settings: publicSettings, revision, model: scenario === 'warming' ? null : model, updatedAt: scenario === 'warming' ? null : updatedAt, loading: scenario === 'warming', error: null }
    await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'cache-control': 'no-store' }, body: JSON.stringify(body) })
    return
  }
  const asset = url.origin === base && request.method() === 'GET' && (/^\/tv-light(?:\/.*)?$/.test(url.pathname) || url.pathname === '/favicon.ico')
  if (!asset) { blocked.push({ path: url.pathname, origin: url.origin, type: request.resourceType() }); await route.abort(); return }
  if (request.resourceType() === 'script') assetPaths.add(url.pathname)
  await route.continue()
}

async function createContext({ javaScriptEnabled = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', javaScriptEnabled })
  if (javaScriptEnabled) await context.addInitScript(() => {
    // These browser APIs are absent in many older embedded browsers. Parsing
    // with acorn below separately guarantees that every delivered script is ES5.
    window.fetch = undefined
    window.AbortController = undefined
    window.Intl = undefined
    window.URL = undefined
    window.URLSearchParams = undefined
    window.fixturePublicXhrs = []
    localStorage.setItem('vault_access_token', 'expired-fixture-token')
    const open = XMLHttpRequest.prototype.open
    const send = XMLHttpRequest.prototype.send
    const header = XMLHttpRequest.prototype.setRequestHeader
    XMLHttpRequest.prototype.open = function (method, url) { this.fixtureRequest = { method, url, authorization: false }; return open.apply(this, arguments) }
    XMLHttpRequest.prototype.setRequestHeader = function (name) { if (this.fixtureRequest && name.toLowerCase() === 'authorization') this.fixtureRequest.authorization = true; return header.apply(this, arguments) }
    XMLHttpRequest.prototype.send = function () { window.fixturePublicXhrs.push({ ...this.fixtureRequest, withCredentials: this.withCredentials }); return send.apply(this, arguments) }
    Element.prototype.requestFullscreen = function () { throw new Error('Synthetic fullscreen refusal') }
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  const next = await context.newPage()
  next.setDefaultTimeout(10000)
  next.on('pageerror', error => errors.push(error.message))
  if (javaScriptEnabled) await next.clock.install({ time: now })
  return { context, page: next }
}

async function refresh() {
  revision++
  const before = requests.length
  await page.clock.runFor(31000)
  await expect.poll(() => requests.length).toBeGreaterThan(before)
}

const panel = () => page.locator('#tv-light-panel')
async function dual(gross, cash, locator = panel()) {
  const formatted = value => value === null ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value).replace(/\s/g, ' ')
  await expect.poll(async () => (await locator.getByTestId('tv-gross-value').first().innerText()).replace(/\s/g, ' ')).toBe(formatted(gross))
  await expect.poll(async () => (await locator.getByTestId('tv-cash-value').first().innerText()).replace(/\s/g, ' ')).toBe(formatted(cash))
}

async function checkFits(name) {
  const dimensions = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight }))
  assert.ok(dimensions.scrollWidth <= dimensions.width + 1 && dimensions.scrollHeight <= dimensions.height + 1, `${name} fits 1280x720: ${JSON.stringify(dimensions)}`)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
}

try {
  await fs.mkdir(out, { recursive: true })
  const dist = fileURLToPath(new URL('../../dist/tv-light/', import.meta.url))
  assert.ok(existsSync(`${dist}index.html`), 'Build first: npm run build')
  const html = await fs.readFile(`${dist}index.html`, 'utf8')
  assert.doesNotMatch(html, /type\s*=\s*["']module["']|modulepreload|\/assets\//i, 'TV Light is independent of the React/module entry point')
  for (const name of ['app.js', 'config.js']) parse(await fs.readFile(`${dist}${name}`, 'utf8'), { ecmaVersion: 5, sourceType: 'script' })
  const css = postcss.parse(await fs.readFile(`${dist}style.css`, 'utf8'))
  css.walkDecls(declaration => {
    assert.doesNotMatch(declaration.prop, /^(--|(?:grid|gap|row-gap|column-gap|inset|aspect-ratio|backdrop-filter)(?:-|$))/i, `Legacy CSS property: ${declaration.prop}`)
    assert.doesNotMatch(declaration.value, /\b(?:var|clamp|min|max|color-mix|oklch)\s*\(|\b(?:grid|subgrid)\b/i, `Legacy CSS value: ${declaration.value}`)
  })
  record('Built HTML has classic scripts only; app/config parse as ES5 and CSS avoids modern-only layout/color features')

  if (!base) {
    let port = Number(process.env.DASHBOARD_SMOKE_PORT || 0)
    if (!port) {
      const socket = createServer()
      await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
      port = socket.address().port
      await new Promise(resolve => socket.close(resolve))
    }
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(`${base}/tv-light/`)).ok } catch { /* Owned preview starting. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  base = base.replace(/\/$/, '')
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'This smoke only runs against local built assets')
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const first = await createContext()
  page = first.page
  await page.goto(`${base}/tv-light`, { waitUntil: 'networkidle' })
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'ready')
  await dual(1900.12, 1233.64)
  assert.match(requests.at(-1).path, /\/tv\/public$/)
  await expect(panel()).toContainText(/cash collected/i)
  assert.equal(await page.getByRole('button', { name: /Entrar pelo Vault|Configurar TV/ }).count(), 0)
  record('Canonical light route shows precise gross/cash anonymously without fetch, AbortController, Intl or URL APIs')

  for (const theme of ['dark', 'light']) {
    for (const { id } of TV_PANELS) {
      settings = { ...settings, theme, mode: 'fixed', fixedPanel: id }
      await refresh()
      await expect(panel()).toHaveAttribute('data-panel-id', id)
      await expect(page.locator('body')).toHaveAttribute('data-tv-theme', theme)
      await expect(panel().getByTestId('tv-gross-value').first()).toBeVisible()
      await expect(panel().getByTestId('tv-cash-value').first()).toBeVisible()
      await checkFits(`${id}-${theme}-1280`)
    }
  }
  record('All eight configured panels render in both themes and fit a 1280x720 television')

  for (const [id, field] of [['sellers', 'sellers'], ['team-goals', 'teamGoals'], ['product-goals', 'productGoals']]) {
    settings = { ...settings, mode: 'fixed', fixedPanel: id }
    model = structuredClone(initialModel)
    model[field] = Array.from({ length: 8 }, (_, index) => ({ ...initialModel[field][0], id: `synthetic-${index}`, name: `Resultado sintético ${index + 1}` }))
    await refresh()
    await expect(panel().locator('tbody tr')).toHaveCount(5)
    await expect(panel()).toContainText(/5 primeiros de 8/)
    await checkFits(`${id}-eight-results-1280`)
  }
  record('Longer rankings and goal lists show five rows with an explicit total and fit 1280x720')

  // The public projection sends only fields required by the selected scene.
  settings = { ...settings, mode: 'fixed', fixedPanel: 'sellers' }
  model = { month: initialModel.month, metric: 'cash', metricLabel: initialModel.metricLabel, unit: 'currency', totals: { partial: false }, sellers: initialModel.sellers }
  await refresh()
  await expect(panel()).toHaveAttribute('data-panel-id', 'sellers')
  await expect(panel()).toContainText('Ana sintética')
  await dual(1900.12, 1233.64)
  record('A fixed ranking accepts a sparse public model without monthly overview, total financial values or other scenes')

  model = structuredClone(initialModel)
  settings = { ...settings, fixedPanel: 'monthly-goal' }
  for (const [gross, cash] of [[null, 1233.64], [1900.12, null], [0, 0]]) {
    model.overview.gross = gross; model.totals.gross = gross; model.overview.grossPartial = gross === null; model.totals.grossPartial = gross === null
    model.overview.cash = cash; model.totals.cash = cash; model.overview.cashPartial = cash === null; model.totals.cashPartial = cash === null
    await refresh()
    await dual(gross, cash)
  }
  model.overview.gross = 1900.12; model.overview.grossPartial = true; model.totals.gross = 1900.12; model.totals.grossPartial = true
  model.overview.cash = 1233.64; model.overview.cashPartial = false; model.totals.cash = 1233.64; model.totals.cashPartial = false
  await refresh()
  await dual(1900.12, 1233.64)
  await expect(panel()).toContainText(/parcial/i)
  record('Unknown gross/cash remain separate from explicit zero; partial values are labeled and cents remain precise')

  model = structuredClone(initialModel)
  settings = { ...settings, mode: 'rotate', panels: settings.panels.map(item => ({ ...item, durationSeconds: 10 })) }
  await refresh()
  await page.locator('#tv-light-pause').click()
  const pausedPanel = await panel().getAttribute('data-panel-id')
  await page.clock.runFor(11000)
  await expect(panel()).toHaveAttribute('data-panel-id', pausedPanel)
  await page.locator('#tv-light-next').click()
  assert.notEqual(await panel().getAttribute('data-panel-id'), pausedPanel)
  await page.locator('#tv-light-prev').click()
  await expect(panel()).toHaveAttribute('data-panel-id', pausedPanel)
  await page.locator('#tv-light-pause').click()
  await page.clock.runFor(11000)
  assert.notEqual(await panel().getAttribute('data-panel-id'), pausedPanel)
  await page.locator('#tv-light-fullscreen').click()
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'ready')
  record('Rotation, pause and manual controls work; fullscreen refusal preserves the presentation')

  settings = { ...settings, mode: 'fixed', fixedPanel: 'monthly-goal' }
  await refresh()
  scenario = 'network-error'
  await refresh()
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'stale')
  await dual(1900.12, 1233.64)
  await expect(page.locator('#tv-light-status')).toContainText(/atualiza|última|conexão/i)
  await checkFits('monthly-goal-stale-1280')
  record('Network failure keeps the last known values with a visible stale indicator')
  await page.clock.runFor(300001)
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'unavailable')
  assert.doesNotMatch(await page.locator('body').innerText(), /1\.900,12|1\.233,64|5\.000,00/, 'Expired stale values are cleared after five minutes')
  record('A prolonged network outage clears expired values after five minutes')
  scenario = 'ready'
  await refresh()
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'ready')
  scenario = 'revoked'
  await refresh()
  await expect(page.locator('#tv-light-title')).toContainText(/link.*indisponível/i)
  assert.doesNotMatch(await page.locator('body').innerText(), /1\.900,12|1\.233,64|5\.000,00/, 'Revocation removes retained financial values')
  record('Revoked links immediately clear previously displayed aggregates')

  scenario = 'unavailable'
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'unavailable')
  assert.doesNotMatch(await panel().innerText(), /R\$\s*0,00/)
  scenario = 'ready'
  await page.locator('#tv-light-retry').click()
  await dual(1900.12, 1233.64)
  scenario = 'warming'
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('body')).toHaveAttribute('data-tv-state', 'loading')
  assert.doesNotMatch(await panel().innerText(), /R\$\s*0,00/)
  record('Initial errors expose retry and a warming aggregate cache does not invent zero sales')

  scenario = 'ready'
  for (const path of ['/tv-light/', `/tv-light/${token}`]) {
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    await dual(1900.12, 1233.64)
    assert.equal(requests.at(-1).path.endsWith(token), path.endsWith(token))
  }
  xhrOptions.push(...await page.evaluate(() => window.fixturePublicXhrs))
  assert.ok(xhrOptions.length > 0 && xhrOptions.every(request => request.method === 'GET' && !request.withCredentials && !request.authorization))
  assert.equal(await page.evaluate(() => localStorage.getItem('vault_access_token')), 'expired-fixture-token')
  assert.ok(requests.every(request => !request.authorization && !request.cookie))
  record('Trailing slash/token links use anonymous XHR without Authorization or cross-origin credentials and ignore stale Vault storage')

  const noScript = await createContext({ javaScriptEnabled: false })
  page = noScript.page
  await page.goto(`${base}/tv-light`, { waitUntil: 'networkidle' })
  await expect(page.locator('h1')).toBeVisible()
  // Playwright's text matcher deliberately excludes noscript descendants.
  await expect(page.locator('noscript')).toBeVisible()
  assert.match(await page.locator('noscript').textContent(), /javascript/i)
  await checkFits('javascript-disabled-1280')
  record('Static HTML remains readable when JavaScript is unavailable')

  assert.ok(assetPaths.size > 0)
  assert.ok([...assetPaths].every(path => /^\/tv-light\/(?:app|config)\.js$/.test(path)), 'No React, module or private application scripts are loaded')
  assert.deepEqual(blocked, [], 'The light page should not attempt private/external assets or APIs')
  assert.deepEqual(errors, [])
  complete = true
  console.log(JSON.stringify({ passed: true, checks: checks.length, apiCalls: requests.length, assets: [...assetPaths], realApiRequests: 0 }))
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`)
  }
  throw error
} finally {
  await fs.mkdir(out, { recursive: true })
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: complete, checks, requests, blocked, errors, xhrOptions, assets: [...assetPaths], realApiRequests: 0, realWrites: 0 }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
