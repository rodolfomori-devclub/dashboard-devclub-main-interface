// Real public/private TV players, synthetic sales only. Every API is intercepted;
// published mode reads approved application assets and never production records.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'
import { defaultTvSettings } from '../../src/components/tv/tvConfig.js'
import { buildTvData } from '../../src/components/tv/tvData.js'
import { periodCacheFixture, emptyProviderPayload } from './period-cache-fixture.mjs'
import { readPublishedVault } from './published-vault.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/tv-live-celebrations', import.meta.url))
const today = '2026-10-19', now = new Date(`${today}T15:00:00-03:00`)
const sources = ['guru', 'hotmart', 'tmb', 'asaas', 'boletex', 'manual']
const profile = { id: 'fixture-admin', name: 'Admin sintético', email: 'admin@example.test', role: 'gestor', active: true }
const directory = { teams: [{ id: 'commercial', name: 'Comercial', active: true }],
  individuals: [{ id: 'ana', name: 'Ana sintética', teamId: 'commercial', active: true }] }
const settings = { ...defaultTvSettings(), mode: 'fixed', fixedPanel: 'daily', theme: 'dark', metric: 'gross' }
settings.panels = settings.panels.map(panel => ({ ...panel, enabled: panel.id === 'daily' }))
const publicSettings = { ...settings, panels: settings.panels.filter(panel => panel.enabled) }
delete publicSettings.paceScope
delete publicSettings.paceScopeId
const initialModel = buildTvData({ year: 2026, month: 10, today, directory,
  sales: { operationsStatus: 'ready', records: [], sources: [{ id: 'hotmart', label: 'Hotmart', kind: 'sale', status: 'ready' }] } })
delete initialModel.directory
let feed = { day: today, groups: sources.map(source => ({ source, ready: source !== 'tmb', events: [] })) }
feed.groups.find(group => group.source === 'hotmart').events.push({ id: 'baseline', occurredAt: `${today}T17:59:00Z`, amount: 900, sellerName: 'Venda anterior' })
let privateRows = [{ id: 'private-baseline', occurredAt: `${today}T17:59:00Z`, amount: 900, sellerName: 'Ana sintética' }]
let base = process.env.DASHBOARD_SMOKE_URL, server, browser, page, contextLabel = 'public', complete = false, serverOutput = ''
let scenario = 'ready', revision = 1, apiResponses = 0, vault, entryAsset = null, privateRefreshing = false
const checks = [], blocked = [], unexpected = [], errors = [], privateScripts = [], apiCalls = [], assets = new Map()
const record = text => { checks.push(text); console.log(`PASS ${checks.length}: ${text}`) }
const settle = () => new Promise(resolve => setTimeout(resolve, 100))
const player = () => page.getByTestId('tv-player')
const overlay = () => page.getByTestId('tv-celebration')
const group = source => feed.groups.find(item => item.source === source)
const probe = () => page.evaluate(() => ({ ...window.liveTvProbe }))
const clockNow = () => page.evaluate(() => Date.now())
const event = async (id, amount = 1234.56, sellerName = 'Ana sintética', extra = {}) => ({ id, amount,
  occurredAt: new Date(await clockNow()).toISOString(), ...(sellerName ? { sellerName } : {}), ...extra })
const noEffect = async () => { await settle(); await expect(overlay()).toHaveCount(0) }
const closeEffect = async () => { await page.getByRole('button', { name: 'Encerrar comemoração', exact: true }).click(); await noEffect() }

function provider(id, range) {
  if (id !== 'hotmart') return emptyProviderPayload(id)
  const transactions = privateRows.filter(row => range.startDate <= row.occurredAt.slice(0, 10) && range.endDate >= row.occurredAt.slice(0, 10))
    .map(row => ({ transaction: row.id, product: 'DevClub', grossValue: row.amount, netValue: row.amount, fee: 0,
      paymentMethod: 'CREDIT_CARD', currency: 'BRL', netCurrency: 'BRL', feeCurrency: 'BRL', orderDate: row.occurredAt }))
  const total = transactions.reduce((sum, row) => sum + row.netValue, 0)
  return { success: true, data: { financialSchemaVersion: 2, count: transactions.length, totalGross: total, totalNet: total, totalFees: 0, transactions } }
}

async function fixture(route, label) {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
  if (!path.startsWith('/api/')) {
    const privateModule = /\/src\/(?:PrivateWorkspace|contexts\/AuthContext|lib\/(?:vault-sdk|api))\./.test(path)
      || /\/assets\/(?:PrivateWorkspace|AuthContext)-/.test(path)
    if (label === 'public' && privateModule) privateScripts.push(path)
    const allowed = path === '/tv' || path === '/ranking' || path.startsWith('/assets/')
      || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(path)
    if (url.origin !== base || method !== 'GET' || (label === 'public' && privateModule) || (published && !allowed)) {
      blocked.push({ context: label, path, method, external: url.origin !== base }); await route.abort(); return
    }
    await route.continue(); return
  }
  const headers = { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type,x-client-info,prefer,range,range-unit',
    'access-control-allow-methods': 'GET,OPTIONS', 'cache-control': 'no-store' }
  if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
  apiCalls.push({ context: label, path, method, scenario })
  if (method !== 'GET' || (label === 'public' && path !== '/api/tv/public')) {
    unexpected.push({ context: label, path, method }); await route.abort(); return
  }
  let body, status = 200
  if (path === '/api/tv/public') {
    assert.equal(request.headers().authorization, undefined, 'Anonymous sales never send the stale bearer fixture')
    assert.equal(request.headers().cookie, undefined, 'Anonymous TV omits cookies')
    const model = { ...initialModel, celebrations: structuredClone(feed) }
    if (scenario === 'network-error') { status = 503; body = { error: 'Falha sintética de atualização' } }
    else body = { settings: publicSettings, revision, model, updatedAt: new Date(await clockNow()).toISOString(), loading: false, refreshing: false,
      error: scenario === 'goals-warning' ? 'Metas indisponíveis. Vendas atualizadas.' : null }
  } else if (path === '/api/access') body = { user: { sub: profile.id, name: profile.name, email: profile.email, permissions: ['ranking', 'monthly', 'goals'], isAdmin: true } }
  else if (path === '/api/hub/session') body = { user: profile }
  else if (path === '/api/tv/settings') body = { settings, revision: 1, updatedAt: now.toISOString() }
  else if (path === '/api/tv/share') body = { enabled: false, token: null, path: null, simplePath: null, revision: 0, updatedAt: null }
  else if (path === '/api/goal-plans/options') body = directory
  else if (/^\/api\/goal-plans\/\d{4}\/\d{1,2}$/.test(path)) body = { plans: [] }
  else if (path === '/api/period-cache') {
    body = periodCacheFixture(url, { today, payloadForSource: provider })
    const fetchedAt = new Date((await clockNow()) - (privateRefreshing ? 10000 : 0)).toISOString()
    body.generatedAt = new Date(await clockNow()).toISOString()
    body.segments.forEach(segment => segment.sources.forEach(source => { source.fetchedAt = fetchedAt; source.lastAttemptAt = fetchedAt }))
    if (privateRefreshing) {
      const source = body.segments.find(segment => segment.kind === 'today').sources.find(item => item.id === 'hotmart')
      source.status = 'stale'; source.refreshing = true
      body.pending = 1; body.completed = body.total - 1; body.complete = false
    }
  }
  else if (path === '/api/sales-ops/ledger') body = { data: { manualSales: [], attributions: privateRows.filter(row => row.sellerName)
    .map(row => ({ source: 'hotmart', externalId: row.id, sellerId: 'ana', sellerName: 'Ana sintética' })) } }
  else if (path.startsWith('/api/hub/rest/v1/')) {
    const table = path.split('/').pop()
    body = table === 'profiles' ? [profile, ...directory.individuals.map(person => ({ ...person, role: 'vendedor', team_id: person.teamId }))]
      : table === 'teams' ? directory.teams : table === 'team_settings' ? { id: 'setting', team_goal: 5000, origins: [] }
        : table === 'monthly_goals' ? { month: 10, year: 2026, team_goal: 5000 } : []
  } else { unexpected.push({ context: label, path, method }); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', headers, body: JSON.stringify(body) })
  if (path === '/api/tv/public' || path === '/api/period-cache') apiResponses++
}

async function createContext(label) {
  contextLabel = label
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1920, height: 1080 } })
  await context.addInitScript(({ label, vault }) => {
    if (label === 'private') {
      const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture-admin', iss: vault.vaultUrl, aud: vault.clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
    } else localStorage.setItem('vault_access_token', 'expired-synthetic-tv-session')
    window.liveTvProbe = { contexts: 0, sourceStarts: 0, sourceCancels: 0, contextCloses: 0, mediaPlays: 0, overlays: 0, maxOverlays: 0, fullscreenRequests: 0 }
    window.fixtureHidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.fixtureHidden })
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext
    if (NativeAudioContext) {
      function observed(source) {
        const start = source.start.bind(source), stop = source.stop.bind(source)
        source.start = (...args) => { window.liveTvProbe.sourceStarts++; return start(...args) }
        source.stop = (...args) => {
          if (!args.length || args[0] <= source.context.currentTime) window.liveTvProbe.sourceCancels++
          return stop(...args)
        }
        return source
      }
      class ObservedAudioContext extends NativeAudioContext {
        constructor(...args) { super(...args); window.liveTvProbe.contexts++ }
        createOscillator(...args) { return observed(super.createOscillator(...args)) }
        createBufferSource(...args) { return observed(super.createBufferSource(...args)) }
        close(...args) { window.liveTvProbe.contextCloses++; return super.close(...args) }
      }
      window.AudioContext = ObservedAudioContext
      if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudioContext
    }
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) { window.liveTvProbe.mediaPlays++; return play.apply(this, args) }
    Element.prototype.requestFullscreen = async () => { window.liveTvProbe.fullscreenRequests++; throw new DOMException('Synthetic fullscreen refusal', 'NotAllowedError') }
    const seen = new WeakSet()
    new MutationObserver(() => {
      const elements = document.querySelectorAll('[data-testid="tv-celebration"]')
      window.liveTvProbe.maxOverlays = Math.max(window.liveTvProbe.maxOverlays, elements.length)
      elements.forEach(node => { if (!seen.has(node)) { seen.add(node); window.liveTvProbe.overlays++ } })
    }).observe(document, { childList: true, subtree: true })
  }, { label, vault })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', route => fixture(route, label))
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push({ context: label, message: error.message }))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) assets.set(url.pathname, response.status())
  })
  await page.clock.install({ time: now })
  await page.goto(`${base}/${label === 'public' ? 'tv' : 'ranking'}`, { waitUntil: 'networkidle' })
  if (label === 'private') {
    await page.getByTestId('tv-preview').waitFor()
    await expect(page.getByTestId('tv-preview').getByTestId('tv-gross-value')).toContainText('900,00')
    await page.getByRole('button', { name: 'Iniciar TV', exact: true }).click()
  }
  await player().waitFor()
  await page.clock.pauseAt(new Date(now.getTime() + 10000))
  await noEffect()
  return context
}

async function poll(milliseconds = 60100) {
  const before = apiResponses
  const path = contextLabel === 'public' ? '/api/tv/public' : '/api/period-cache'
  const response = page.waitForResponse(value => new URL(value.url()).pathname === path)
  await page.clock.fastForward(milliseconds)
  await response
  await expect.poll(() => apiResponses).toBeGreaterThan(before)
  await settle()
}
async function show(expected) {
  await expect(overlay()).toHaveCount(1)
  await expect(overlay()).toHaveAttribute('data-animation', 'confetti')
  if (expected.sellerName) await expect(overlay()).toContainText(expected.sellerName)
  else await expect(overlay()).toContainText('Venda confirmada')
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(expected.amount)
  await expect(overlay().getByTestId('sale-celebration-amount')).toHaveText(formatted)
  assert.equal((await probe()).maxOverlays, 1, 'One visual sale at a time')
}
async function screenshot(name) {
  if (await overlay().count()) await new Promise(resolve => setTimeout(resolve, 900))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name}: no horizontal overflow`)
  if (await overlay().count()) assert.equal(await overlay().evaluate(node => {
    const box = node.getBoundingClientRect()
    return box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
  }), true, `${name}: celebration fits the screen`)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
}

try {
  await fs.mkdir(out, { recursive: true })
  if (!base) {
    assert.equal(published, false, 'Published fixture verification requires an explicit URL')
    const socket = createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(`${base}/tv`)).ok } catch { /* Owned Vite startup. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br'
    : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use only owned localhost or the exact approved published hostname')
  vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) {
    const response = await fetch(`${base}/tv`)
    assert.equal(response.status, 200)
    entryAsset = (await response.text()).match(/src="([^" ]*\/assets\/(?:main|index)-[^" ]+\.js)"/)?.[1]
    assert.ok(entryAsset, 'Published route serves the application entry')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(entryAsset, process.env.DASHBOARD_EXPECTED_ASSET)
    const config = await readPublishedVault({ base, main: entryAsset })
    vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const publicContext = await createContext('public')
  assert.equal((await probe()).contexts, 0)
  assert.equal((await probe()).sourceStarts, 0)
  await expect(page.getByRole('button', { name: 'Ativar som', exact: true })).toBeVisible()
  record('Public TV baselines existing sales and an initially unavailable source silently, without creating an audio context')

  const first = await event('first')
  group('hotmart').events.push(first)
  await poll()
  await show(first)
  assert.equal((await probe()).sourceStarts, 0)
  await screenshot('public-new-sale-1920')
  await page.clock.runFor(4800)
  await expect(overlay()).toHaveCount(1)
  await page.clock.runFor(500)
  await noEffect()
  record('The first new sale shows Confetes, the verified seller and its amount, stays for five seconds and clears automatically without autoplay')

  const seen = (await probe()).overlays
  first.amount = 9999
  first.sellerName = 'Nome corrigido'
  group('hotmart').events.push(await event('date-only', 500, '', { occurredAt: null }), await event('late-import', 600, '', { occurredAt: `${today}T17:58:00Z` }))
  await poll()
  await noEffect()
  assert.equal((await probe()).overlays, seen)
  record('Repeated polling, value/name corrections, undated records and older imports do not replay celebrations')

  const refreshSale = await event('after-transient-refresh', 1212.12)
  group('hotmart').ready = false
  group('hotmart').refreshing = true
  const savedEvents = group('hotmart').events
  group('hotmart').events = []
  await poll()
  await noEffect()
  group('hotmart').ready = true
  delete group('hotmart').refreshing
  group('hotmart').events = [...savedEvents, refreshSale]
  await poll()
  await show(refreshSale)
  await closeEffect()
  record('A brief healthy cache refresh retains its baseline so the newly collected sale still celebrates')

  const anonymous = await event('no-seller', 2222.22, '')
  group('hotmart').events.push(anonymous)
  await poll()
  await show(anonymous)
  await expect(overlay()).not.toContainText('Ana sintética')
  await closeEffect()
  record('A new sale without an eligible seller shows the generic confirmation and the correct amount')

  const batch = [await event('batch-a', 111, 'Primeiro da fila'), await event('batch-b', 222, 'Segundo da fila'), await event('batch-c', 333, 'Terceiro da fila')]
  group('hotmart').events.push(...batch)
  await poll()
  for (let index = 0; index < batch.length; index++) {
    await show(batch[index])
    await page.clock.runFor(5250)
  }
  await noEffect()
  const afterBatch = (await probe()).overlays
  await poll()
  await noEffect()
  assert.equal((await probe()).overlays, afterBatch)
  record('A batch plays sequentially with only one overlay and each stable identity is celebrated once')

  group('tmb').events = [await event('initial-recovery', 444)]
  group('tmb').ready = true
  await poll()
  await noEffect()
  const recovered = await event('recovered-new', 555)
  group('tmb').events.push(recovered)
  await poll()
  await show(recovered)
  await closeEffect()
  group('tmb').ready = false
  group('tmb').events = []
  await poll()
  group('tmb').ready = true
  group('tmb').events = [await event('outage-backlog', 666)]
  await poll()
  await noEffect()
  const afterRecovery = await event('after-recovery', 777)
  group('tmb').events.push(afterRecovery)
  await poll()
  await show(afterRecovery)
  await closeEffect()
  record('Initial partial data and a source outage establish fresh silent baselines; only later sales notify after recovery')

  scenario = 'goals-warning'
  const withGoalsWarning = await event('healthy-sales-goals-warning', 778)
  group('hotmart').events.push(withGoalsWarning)
  await poll()
  await show(withGoalsWarning)
  await expect(player()).toContainText('Metas indisponíveis')
  await closeEffect()
  scenario = 'ready'
  record('Unavailable goals do not suppress a healthy new-sale feed or reset its baseline')

  await page.getByRole('button', { name: 'Ativar som', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Silenciar som', exact: true })).toBeVisible()
  const enabled = await probe()
  const audible = await event('audible', 888)
  group('hotmart').events.push(audible)
  await poll()
  await show(audible)
  await expect.poll(async () => (await probe()).sourceStarts).toBeGreaterThan(enabled.sourceStarts)
  const playing = await probe()
  await page.getByRole('button', { name: 'Silenciar som', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ativar som', exact: true })).toBeVisible()
  assert.ok((await probe()).sourceCancels > playing.sourceCancels, 'Muting stops current scheduled audio immediately')
  await closeEffect()
  const muted = await probe(), mutedSale = await event('muted-sale', 889)
  group('hotmart').events.push(mutedSale)
  await poll()
  await show(mutedSale)
  assert.equal((await probe()).sourceStarts, muted.sourceStarts)
  await closeEffect()
  await page.getByRole('button', { name: 'Ativar som', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Silenciar som', exact: true })).toBeVisible()
  record('An explicit sound gesture unlocks future sale audio; muting cancels playback immediately and preserves silent visual notifications')

  const beforeTestCalls = apiCalls.length, beforeTest = await probe()
  await page.getByRole('button', { name: 'Testar comemoração', exact: true }).click()
  await expect(overlay()).toHaveCount(1)
  await expect(overlay()).toContainText('Venda de teste')
  await expect.poll(async () => (await probe()).sourceStarts).toBeGreaterThan(beforeTest.sourceStarts)
  assert.equal(apiCalls.length, beforeTestCalls, 'The synthetic test does not write or fetch a sale')
  await screenshot('public-synthetic-test-1920')
  await closeEffect()
  record('Testar comemoração clearly labels a synthetic sale, uses unlocked audio and performs no API request')

  const hiddenBatch = [await event('hidden-a', 901), await event('hidden-b', 902)]
  group('hotmart').events.push(...hiddenBatch)
  await poll()
  await show(hiddenBatch[0])
  const beforeHidden = await probe()
  await page.evaluate(() => { window.fixtureHidden = true; document.dispatchEvent(new Event('visibilitychange')) })
  await noEffect()
  assert.ok((await probe()).sourceCancels > beforeHidden.sourceCancels)
  const hiddenCalls = apiResponses
  await page.clock.fastForward(65000)
  assert.equal(apiResponses, hiddenCalls, 'Hidden TV does not poll')
  group('hotmart').events.push(await event('arrived-hidden', 903))
  await page.clock.runFor(1000)
  const visibleResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tv/public')
  await page.evaluate(() => { window.fixtureHidden = false; document.dispatchEvent(new Event('visibilitychange')) })
  await visibleResponse
  await noEffect()
  const resumed = await event('resumed-new', 904)
  group('hotmart').events.push(resumed)
  await poll()
  await show(resumed)
  await closeEffect()
  record('Hiding the browser stops sound, clears the active sale and queue, pauses polling and silently baselines sales received while hidden')

  const interrupted = [await event('error-active', 910), await event('error-queued', 911)]
  group('hotmart').events.push(...interrupted)
  await poll()
  await show(interrupted[0])
  const errorAudio = await probe()
  const beforeError = (await probe()).overlays
  scenario = 'network-error'
  const errorResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tv/public')
  // The actual public visibility handler is also the immediate refresh path.
  // Keeping document.hidden false avoids resetting the tracker before the 503.
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await errorResponse
  await expect(player()).toContainText('Atualização indisponível')
  await noEffect()
  assert.ok((await probe()).sourceCancels > errorAudio.sourceCancels, 'An HTTP failure immediately stops the current sound')
  scenario = 'ready'
  group('hotmart').events.push(await event('error-backlog', 905))
  await poll(15100)
  await noEffect()
  assert.equal((await probe()).overlays, beforeError)
  const afterError = await event('after-error', 906)
  group('hotmart').events.push(afterError)
  await poll()
  await show(afterError)
  await closeEffect()
  record('A failed refresh immediately clears the active sound and queued sales, preserves the dashboard and silently baselines outage backlog on recovery')

  await page.getByRole('button', { name: 'Entrar em tela cheia', exact: true }).click()
  assert.equal((await probe()).fullscreenRequests, 1)
  await player().waitFor()
  await page.setViewportSize({ width: 360, height: 900 })
  const mobile = await event('mobile', 907, 'Ana sintética')
  group('hotmart').events.push(mobile)
  await poll()
  await show(mobile)
  await screenshot('public-new-sale-360')
  await closeEffect()
  await screenshot('public-controls-360')
  record('Fullscreen API refusal keeps TV usable; the live celebration and controls fit a 360-pixel display')
  await publicContext.close()

  const privateContext = await createContext('private')
  assert.equal((await probe()).contexts, 0)
  const privateNew = await event('private-new', 321.45)
  privateRows.push(privateNew)
  await poll()
  await show(privateNew)
  assert.equal((await probe()).sourceStarts, 0)
  await screenshot('private-new-sale-1920')
  await closeEffect()
  const privateSeen = (await probe()).overlays
  privateNew.amount = 432.10
  await poll()
  await noEffect()
  assert.equal((await probe()).overlays, privateSeen)
  record('Private TV transforms a new attributed provider record into one sale celebration and deduplicates subsequent amount corrections')

  privateRefreshing = true
  await poll()
  await noEffect()
  // This sale arrives after the loader fetched its one attribution ledger.
  // It must still notify, using the generic name until attribution is known.
  const afterPrivateRefresh = await event('private-after-refresh', 543.21, '')
  privateRows.push(afterPrivateRefresh)
  privateRefreshing = false
  await poll(2100)
  await show(afterPrivateRefresh)
  await closeEffect()
  record('The real private period-cache stale/refreshing snapshot preserves the baseline until the ready response delivers its new sale')

  const privateAnonymous = await event('private-anonymous', 654.32, '')
  privateRows.push(privateAnonymous)
  await poll()
  await show(privateAnonymous)
  await player().focus()
  await page.keyboard.press('Escape')
  await noEffect()
  await expect(player()).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(player()).toHaveCount(0)
  await noEffect()
  await page.getByRole('button', { name: 'Iniciar TV', exact: true }).click()
  await player().waitFor()
  await noEffect()
  const reopened = (await probe()).overlays
  await poll()
  await noEffect()
  assert.equal((await probe()).overlays, reopened)
  record('Private seller-free sales work; Escape clears the effect and reopening TV never replays earlier sales')
  await privateContext.close()

  assert.deepEqual(blocked, [], 'No external request or mutation reaches the network')
  assert.deepEqual(unexpected, [], 'All API traffic is expected, synthetic and read-only')
  assert.deepEqual(privateScripts, [], 'The anonymous player does not load private modules')
  assert.deepEqual(errors, [], 'No uncaught browser errors')
  assert.ok([...assets.values()].every(status => status === 200))
  complete = true
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, published, checks, blocked, unexpected, privateScripts, errors, entryAsset, assets: Object.fromEntries(assets), apiRequests: apiCalls.length }, null, 2))
  console.log(JSON.stringify({ passed: true, published, checks: checks.length, artifact: `${out}/results.json` }))
} finally {
  if (!complete) {
    if (page && !page.isClosed()) await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: false, published, checks, blocked, unexpected, privateScripts, errors, entryAsset, assets: Object.fromEntries(assets), apiCalls }, null, 2)).catch(() => {})
  }
  await browser?.close()
  if (server && server.exitCode === null) server.kill('SIGTERM')
}
