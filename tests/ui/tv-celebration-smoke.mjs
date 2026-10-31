// Public, synthetic celebration preview. No identity, API or production writes.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium, expect } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/tv-celebration', import.meta.url))
const preferenceKey = 'devclub.tv-celebration-demo.v1'
const now = new Date('2026-10-19T16:00:00Z')
let base = process.env.DASHBOARD_SMOKE_URL, server, browser, page, complete = false, serverOutput = ''
const checks = [], blocked = [], errors = [], privateScripts = [], assets = new Map()
const record = text => checks.push(text)

async function routeAssets(route) {
  const request = route.request(), url = new URL(request.url())
  const privatePath = /^\/(?:api|auth)(?:\/|$)/.test(url.pathname)
    || /\/src\/(?:PrivateWorkspace|contexts\/AuthContext|lib\/(?:vault-sdk|api))\./.test(url.pathname)
    || /\/assets\/(?:PrivateWorkspace|AuthContext)-/.test(url.pathname)
  if (privatePath) privateScripts.push(url.pathname)
  const allowedPublished = url.pathname === '/tv-demo' || url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/sounds/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(url.pathname)
  if (url.origin !== base || request.method() !== 'GET' || privatePath || (published && !allowedPublished)) {
    blocked.push({ path: url.pathname, external: url.origin !== base, method: request.method() })
    await route.abort(); return
  }
  await route.continue()
}

async function audioCounters() {
  return page.evaluate(() => ({ ...window.demoAudioProbe }))
}
const overlay = () => page.getByTestId('tv-celebration')
const stop = () => page.getByRole('button', { name: 'Parar prévia', exact: true })
const simulate = () => page.getByRole('button', { name: 'Simular venda', exact: true }).first()
const volume = () => page.getByRole('slider', { name: /^Volume/ })
async function chooseRadio(input) {
  // The animation thumbnails are clickable native labels over the small radio.
  await input.locator('..').click()
  await expect(input).toBeChecked()
}
async function setVolume(value) {
  await volume().focus()
  await volume().press('Home')
  for (let step = 0; step < value / 5; step++) await volume().press('ArrowRight')
  await expect(volume()).toHaveValue(String(value))
}
const screenshot = async name => {
  // Browser CSS animation frames advance on the compositor, independently of
  // Playwright's controlled JS timers. Capture the readable entered state.
  if (await overlay().count()) await new Promise(resolve => setTimeout(resolve, 900))
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${name}: no horizontal overflow`)
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: false })
}

try {
  await fs.mkdir(out, { recursive: true })
  if (!base) {
    assert.equal(published, false, 'Published verification requires an explicit URL')
    const socket = createServer()
    await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port
    await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
      cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base,
        VITE_VAULT_CLIENT_ID: 'synthetic-demo-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-3000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(`${base}/tv-demo`)).ok } catch { /* Owned Vite startup. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(ready, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br'
    : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use only owned localhost or the exact approved published hostname')
  if (published) {
    const response = await fetch(`${base}/tv-demo`)
    assert.equal(response.status, 200)
    const html = await response.text()
    const main = html.match(/src="([^" ]*\/assets\/(?:main|index)-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Published route serves the application entry')
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
  await context.addInitScript(() => {
    localStorage.setItem('vault_access_token', 'expired-demo-fixture')
    window.demoAudioProbe = { contexts: 0, sourceStarts: 0, sourceStops: 0, sourceCancels: 0, contextCloses: 0, mediaPlays: 0 }
    const NativeAudioContext = window.AudioContext || window.webkitAudioContext
    if (NativeAudioContext) {
      class ObservedAudioContext extends NativeAudioContext {
        constructor(...args) { super(...args); window.demoAudioProbe.contexts++ }
        createOscillator(...args) { return observeSource(super.createOscillator(...args)) }
        createBufferSource(...args) { return observeSource(super.createBufferSource(...args)) }
        close(...args) { window.demoAudioProbe.contextCloses++; return super.close(...args) }
      }
      function observeSource(source) {
        const start = source.start.bind(source), stop = source.stop.bind(source)
        source.start = (...args) => { window.demoAudioProbe.sourceStarts++; return start(...args) }
        source.stop = (...args) => {
          window.demoAudioProbe.sourceStops++
          if (!args.length || args[0] <= source.context.currentTime) window.demoAudioProbe.sourceCancels++
          return stop(...args)
        }
        return source
      }
      window.AudioContext = ObservedAudioContext
      if (window.webkitAudioContext) window.webkitAudioContext = ObservedAudioContext
    }
    const play = HTMLMediaElement.prototype.play
    HTMLMediaElement.prototype.play = function (...args) { window.demoAudioProbe.mediaPlays++; return play.apply(this, args) }
    Element.prototype.requestFullscreen = async () => { throw new DOMException('Synthetic fullscreen refusal', 'NotAllowedError') }
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', routeAssets)
  page = await context.newPage()
  page.setDefaultTimeout(12000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => {
    const url = new URL(response.url())
    if (url.origin === base && url.pathname.startsWith('/assets/')) assets.set(url.pathname, response.status())
  })
  await page.clock.install({ time: now })
  await page.goto(`${base}/tv-demo`, { waitUntil: 'networkidle' })
  await page.getByTestId('tv-demo').waitFor()
  await page.clock.pauseAt(new Date(now.getTime() + 10000))
  assert.equal(await page.getByRole('button', { name: 'Entrar pelo Vault', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'Configurar TV', exact: true }).count(), 0)
  assert.equal(await overlay().count(), 0)
  assert.deepEqual(await audioCounters(), { contexts: 0, sourceStarts: 0, sourceStops: 0, sourceCancels: 0, contextCloses: 0, mediaPlays: 0 }, 'Opening the demo never starts audio')
  const animationChoices = page.getByRole('group', { name: 'Animação', exact: true }).getByRole('radio')
  const soundChoices = page.getByRole('group', { name: 'Som da comemoração', exact: true }).getByRole('radio')
  assert.equal(await animationChoices.count(), 3)
  assert.equal(await soundChoices.count(), 4)
  await expect(stop()).toBeDisabled()
  record('Anonymous demo loads three animations and four sounds with no autoplay, private session UI or API calls')
  await screenshot('demo-1920')

  await page.getByLabel('Mostrar vendedor', { exact: true }).check()
  await page.getByLabel('Nome do vendedor', { exact: true }).fill('Vendedora de demonstração')
  await page.getByLabel('Valor da venda', { exact: true }).fill('1234.56')
  for (let index = 0; index < 3; index++) {
    await chooseRadio(animationChoices.nth(index))
    const choice = await animationChoices.nth(index).inputValue()
    const before = await audioCounters()
    await simulate().click()
    await expect(overlay()).toHaveCount(1)
    await expect(overlay()).toHaveAttribute('data-animation', choice)
    await expect(overlay()).toContainText('Vendedora de demonstração')
    await expect(overlay()).toContainText(/1\.234,56/)
    await page.clock.runFor(600)
    await screenshot(`animation-${choice}-1920`)
    await simulate().click()
    await expect(overlay()).toHaveCount(1)
    await stop().click()
    await expect(overlay()).toHaveCount(0)
    await expect(stop()).toBeDisabled()
    assert.ok((await audioCounters()).sourceStarts >= before.sourceStarts)
  }
  record('All three visual treatments show the synthetic seller/value; replay replaces the previous effect and Stop clears it')

  await simulate().click()
  await page.getByRole('button', { name: 'Encerrar comemoração', exact: true }).click()
  await expect(overlay()).toHaveCount(0)
  await expect(stop()).toBeDisabled()
  record('The celebration close button stops both the visible effect and its sound')

  await page.getByLabel('Mostrar vendedor', { exact: true }).uncheck()
  await simulate().click()
  await expect(overlay()).toHaveCount(1)
  await expect(overlay()).not.toContainText('Vendedora de demonstração')
  await page.clock.runFor(5200)
  await expect(overlay()).toHaveCount(0)
  await expect(stop()).toBeDisabled()
  record('Seller-free celebration works and the five-second preview finishes automatically')

  await page.getByLabel('Silenciar', { exact: true }).uncheck()
  await setVolume(45)
  const hearButtons = page.getByRole('button', { name: /^Ouvir / })
  assert.equal(await hearButtons.count(), 4)
  for (let index = 0; index < 4; index++) {
    const before = await audioCounters()
    await chooseRadio(soundChoices.nth(index))
    assert.equal((await audioCounters()).sourceStarts, before.sourceStarts, 'Changing sound is silent')
    await hearButtons.nth(index).click()
    await expect.poll(async () => (await audioCounters()).sourceStarts + (await audioCounters()).mediaPlays).toBeGreaterThan(before.sourceStarts + before.mediaPlays)
    await expect(overlay()).toHaveCount(0)
    await expect(stop()).toBeEnabled()
    await stop().click()
    await expect(stop()).toBeDisabled()
    assert.ok((await audioCounters()).sourceCancels > before.sourceCancels, 'Stop immediately cancels scheduled audio sources')
  }
  record('Four sound previews start only after explicit clicks and can be stopped without a visual sale')

  const beforeSelection = await audioCounters()
  await hearButtons.first().click()
  await expect.poll(async () => (await audioCounters()).sourceStarts).toBeGreaterThan(beforeSelection.sourceStarts)
  await chooseRadio(soundChoices.nth(1))
  await expect(stop()).toBeDisabled()
  assert.ok((await audioCounters()).sourceCancels > beforeSelection.sourceCancels, 'Selecting a new sound cancels the one being previewed')
  record('Changing the selected sound silences the current preview instead of overlapping playback')

  await page.getByLabel('Silenciar', { exact: true }).check()
  const muted = await audioCounters()
  await simulate().click()
  await expect(overlay()).toHaveCount(1)
  assert.equal((await audioCounters()).sourceStarts, muted.sourceStarts)
  assert.equal((await audioCounters()).mediaPlays, muted.mediaPlays)
  await stop().click()
  await page.getByLabel('Silenciar', { exact: true }).uncheck()
  await setVolume(0)
  const zero = await audioCounters()
  await simulate().click()
  await expect(overlay()).toHaveCount(1)
  assert.equal((await audioCounters()).sourceStarts, zero.sourceStarts)
  assert.equal((await audioCounters()).mediaPlays, zero.mediaPlays)
  await stop().click()
  record('Mute and zero volume keep visual feedback while suppressing audio playback')

  await chooseRadio(animationChoices.nth(2))
  await chooseRadio(soundChoices.nth(3))
  await setVolume(45)
  await page.getByLabel('Silenciar', { exact: true }).check()
  const selected = { animation: await animationChoices.nth(2).inputValue(), sound: await soundChoices.nth(3).inputValue(), volume: 45, muted: true }
  await page.getByRole('button', { name: 'Guardar minha escolha', exact: true }).click()
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), preferenceKey)
  assert.equal(stored.animation, selected.animation)
  assert.equal(stored.sound, selected.sound)
  assert.equal(stored.muted, true)
  assert.ok(stored.volume === 45 || stored.volume === 0.45, 'Saved volume reflects the selected 45%')
  // React's lazy-route reveal uses a timer; let it run during navigation.
  await page.clock.resume()
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByTestId('tv-demo').waitFor()
  await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000))
  await expect(animationChoices.nth(2)).toBeChecked()
  await expect(soundChoices.nth(3)).toBeChecked()
  await expect(volume()).toHaveValue('45')
  await expect(page.getByLabel('Silenciar', { exact: true })).toBeChecked()
  assert.equal((await audioCounters()).contexts, 0, 'Restoring preferences does not initialize audio')
  assert.equal((await audioCounters()).sourceStarts, 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('vault_access_token')), 'expired-demo-fixture')
  assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), [preferenceKey, 'vault_access_token'].sort())
  record('Only demo preferences persist locally, reload silently restores them, and unrelated auth storage remains untouched')

  await page.getByRole('button', { name: 'Testar em tela cheia', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Sair da tela cheia', exact: true })).toBeVisible()
  await simulate().click()
  await expect(overlay()).toHaveCount(1)
  await screenshot('fullscreen-fallback-1920')
  await page.getByRole('button', { name: 'Sair da tela cheia', exact: true }).click()
  await expect(overlay()).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Testar em tela cheia', exact: true })).toBeVisible()
  record('Fullscreen rejection falls back to the immersive preview and exiting stops the current effect')

  await page.getByRole('button', { name: 'Testar em tela cheia', exact: true }).click()
  await simulate().click()
  await expect(overlay()).toHaveCount(1)
  await page.getByTestId('tv-demo-screen').focus()
  await page.keyboard.press('Escape')
  await expect(overlay()).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Sair da tela cheia', exact: true })).toHaveCount(0)
  await expect(stop()).toBeDisabled()
  record('Escape closes an active fullscreen celebration and restores the configuration screen')

  await page.setViewportSize({ width: 360, height: 900 })
  await screenshot('demo-360')
  await page.getByRole('button', { name: 'Testar combinação', exact: true }).click()
  await expect(overlay()).toHaveCount(1)
  assert.equal(await page.getByTestId('tv-demo-stage').evaluate(node => {
    const box = node.getBoundingClientRect()
    return box.top >= -1 && box.bottom <= innerHeight + 1
  }), true, 'Testing a combination from the mobile controls brings the complete preview into the viewport')
  await screenshot('celebration-360')
  await stop().click()
  record('Testing a combination from mobile controls scrolls the complete preview into view without horizontal overflow at 360 pixels')

  assert.deepEqual(blocked, [], 'Demo attempts no API, identity service, external request or mutation')
  assert.deepEqual(privateScripts, [], 'Demo never loads the private workspace or auth modules')
  assert.deepEqual(errors, [], 'No uncaught browser errors')
  assert.ok([...assets.values()].every(status => status === 200), 'Every published asset loads')
  complete = true
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, published, checks, blocked, privateScripts, errors, assets: Object.fromEntries(assets) }, null, 2))
  console.log(JSON.stringify({ passed: true, published, checks: checks.length, artifact: `${out}/results.json` }))
} finally {
  if (!complete) {
    if (page) await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: false, published, checks, blocked, privateScripts, errors, assets: Object.fromEntries(assets) }, null, 2)).catch(() => {})
  }
  await browser?.close()
  if (server && server.exitCode === null) server.kill('SIGTERM')
}
