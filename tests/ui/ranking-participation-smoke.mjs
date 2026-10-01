// Real Admin UI, synthetic identity and isolated API fixtures only. Can also
// inspect explicitly selected published assets without contacting any real API.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { readPublishedVault } from './published-vault.mjs'
import { adminUsersCatalogFixture, emptyAdminUsersFixture } from './admin-users-read-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/ranking-participation', import.meta.url))
await fs.mkdir(out, { recursive: true })
let base = process.env.DASHBOARD_SMOKE_URL, server, browser, page, serverOutput = '', assets = null
let admin = true, scenario = 'normal', pendingWrite, releaseWrite, completed = false
const users = [
  { id: 'head-fixture', name: 'Miguel Head', teamId: 'commercial', teamName: 'Comercial', active: true, excludedFromRanking: false, revision: 0, updatedAt: null },
  { id: 'seller-fixture', name: 'Ana Vendedora', teamId: 'commercial', teamName: 'Comercial', active: true, excludedFromRanking: false, revision: 0, updatedAt: null },
  { id: 'marketing-fixture', name: 'Bruno Marketing', teamId: 'marketing', teamName: 'Marketing', active: true, excludedFromRanking: true, revision: 2, updatedAt: '2026-10-01T12:00:00Z' },
]
const initialIds = users.map(user => user.id)
const checks = [], calls = [], writes = [], unexpected = [], errors = [], blocked = [], applicationAssets = new Map()
const record = name => { checks.push(name); console.log(`PASS ${name}`) }

async function fixture(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
  if (!path.startsWith('/api/')) {
    const publicPath = path === '/admin' || path.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(path)
    if (url.origin !== base || method !== 'GET' || (published && !publicPath)) {
      blocked.push({ external: url.origin !== base, method, resource: request.resourceType(), opaqueScript: /^\/[A-Za-z0-9_-]{80,}$/.test(path) })
      await route.abort(); return
    }
    await route.continue(); return
  }
  // Cross-origin API requests from published assets are fulfilled locally too.
  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,PUT,OPTIONS' } }); return
  }
  calls.push({ method, path, admin, scenario })
  let body, status = 200
  if (path === '/api/access' && method === 'GET') body = { user: { sub: 'fixture-admin', name: 'Admin QA', email: 'admin@example.test', permissions: admin ? ['admin'] : ['ranking'], isAdmin: admin } }
  else if (path === '/api/admin/users/catalog' && method === 'GET') { assert.equal(admin, true); body = adminUsersCatalogFixture }
  else if (path === '/api/admin/users' && method === 'GET') { assert.equal(admin, true); body = emptyAdminUsersFixture }
  else if (path === '/api/ranking-participation' && method === 'GET') {
    assert.equal(admin, true, 'Only administrators load participation configuration')
    if (scenario === 'read-error') { status = 503; body = { error: 'Não foi possível carregar a participação.' } }
    else body = { users }
  } else if (path.startsWith('/api/ranking-participation/') && method === 'PUT') {
    assert.equal(admin, true, 'Only administrators can update participation')
    const id = decodeURIComponent(path.slice('/api/ranking-participation/'.length)), input = request.postDataJSON()
    const user = users.find(person => person.id === id)
    assert.ok(user, 'The update targets an existing profile')
    assert.deepEqual(Object.keys(input).sort(), ['excludedFromRanking', 'expectedRevision'])
    assert.equal(typeof input.excludedFromRanking, 'boolean')
    assert.ok(Number.isInteger(input.expectedRevision))
    writes.push({ id, input, scenario })
    if (scenario === 'delayed-write') await new Promise(resolve => { pendingWrite = true; releaseWrite = resolve })
    if (scenario === 'write-error') { status = 503; body = { error: 'Não foi possível salvar a participação.' } }
    else if (input.expectedRevision !== user.revision) { status = 409; body = { code: 'RANKING_PARTICIPATION_CONFLICT', error: 'Outro administrador alterou esta participação.' } }
    else {
      Object.assign(user, { excludedFromRanking: input.excludedFromRanking, revision: user.revision + 1, updatedAt: '2026-10-01T16:00:00Z' })
      body = { user }
    }
  } else { unexpected.push(`${method} ${path}`); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base }, body: JSON.stringify(body) })
}

try {
  if (!base) {
    assert.equal(published, false, 'Published checks require an explicit production URL')
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
      try { ready = (await fetch(base)).ok } catch { /* Vite is starting. */ }
      if (ready) break
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.equal(ready, true, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br' : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Fixture targets localhost or explicitly selected Dashboard public assets')
  let vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) {
    const html = await (await fetch(`${base}/admin`)).text()
    const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
    assert.ok(main, 'Published entry exists')
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
  }, vault)
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { const url = new URL(response.url()); if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() }) })
  const section = () => page.getByTestId('ranking-participation')
  const row = id => page.getByTestId(`ranking-participation-user-${id}`)
  const head = () => row('head-fixture')
  const search = () => section().getByRole('searchbox', { name: 'Buscar usuário', exact: true })
  const filter = () => section().getByRole('combobox', { name: 'Filtrar participação', exact: true })
  const exclude = () => head().getByRole('button', { name: /^Excluir dos cálculos/ })
  const include = () => head().getByRole('button', { name: /^Incluir nos cálculos/ })
  const visit = async () => { await page.goto(`${base}/admin`, { waitUntil: 'networkidle' }); await page.getByRole('heading', { name: admin ? 'Administração' : 'Acesso não liberado', exact: true }).waitFor() }
  const shot = async name => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`); await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, animations: 'disabled' }) }

  await visit()
  await section().getByRole('heading', { name: 'Participação nos rankings', exact: true }).waitFor()
  await expect(head()).toContainText('Participa')
  await expect(row('marketing-fixture')).toContainText('Excluído')
  assert.equal(writes.length, 0)
  record('Admin loads saved participation without mutating users')

  await search().fill('miguel')
  await expect(head()).toBeVisible()
  await expect(row('seller-fixture')).toHaveCount(0)
  await search().fill('nome ausente')
  await expect(section().getByTestId(/^ranking-participation-user-/)).toHaveCount(0)
  await search().fill('')
  await filter().selectOption('excluded')
  await expect(row('marketing-fixture')).toBeVisible()
  await expect(head()).toHaveCount(0)
  await filter().selectOption('included')
  await expect(head()).toBeVisible()
  await expect(row('marketing-fixture')).toHaveCount(0)
  await filter().selectOption('all')
  record('Search, no-results and participation filters select existing users')

  scenario = 'delayed-write'
  await exclude().click()
  await expect.poll(() => Boolean(pendingWrite)).toBe(true)
  await expect(head().getByRole('button')).toBeDisabled()
  await expect(head()).toContainText('Salvando')
  assert.deepEqual(writes[0], { id: 'head-fixture', input: { excludedFromRanking: true, expectedRevision: 0 }, scenario: 'delayed-write' })
  releaseWrite()
  await expect(include()).toBeEnabled()
  await expect(head()).toContainText('Excluído')
  scenario = 'normal'
  record('Exclusion sends only preference and revision; loading prevents duplicate writes')

  await visit()
  await expect(include()).toBeVisible()
  await expect(row('seller-fixture')).toContainText('Participa')
  assert.deepEqual(users.map(user => user.id), initialIds, 'Excluding a profile never deletes or replaces it')
  await include().click()
  await expect(exclude()).toBeVisible()
  assert.deepEqual(writes.at(-1).input, { excludedFromRanking: false, expectedRevision: 1 })
  await visit()
  await expect(exclude()).toBeVisible()
  record('Exclusion persists across reload and can be reversed without deleting accounts')

  scenario = 'write-error'
  await exclude().click()
  await expect(section()).toContainText(/salvar|indisponível/i)
  await expect(exclude()).toBeEnabled()
  assert.equal(users[0].excludedFromRanking, false)
  scenario = 'normal'
  record('Failed save retains the previous participation state and permits retry')

  Object.assign(users[0], { excludedFromRanking: true, revision: users[0].revision + 1 })
  const conflictReads = calls.filter(call => call.path === '/api/ranking-participation').length, beforeConflict = writes.length
  await exclude().click()
  await expect(include()).toBeVisible()
  assert.equal(writes.length, beforeConflict + 1, 'A conflict cannot silently retry a stale update')
  assert.ok(calls.filter(call => call.path === '/api/ranking-participation').length > conflictReads, 'A conflict reloads the authoritative server state')
  await expect(section()).toContainText(/administrador|recente|atualizada/i)
  record('Revision conflict reloads the latest setting without overwriting another administrator')

  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('workspace-theme', theme), theme)
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 })
      await visit()
      await expect(include()).toBeVisible()
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), theme === 'dark')
      if (width === 360) assert.ok(await section().getByText('Escolha quem participa dos cálculos comerciais, inclusive no TV Mode.', { exact: true }).evaluate(element => element.getBoundingClientRect().width >= 160), 'Mobile heading retains a readable text column')
      await shot(`participation-${theme}-${width}`)
    }
  }
  record('Saved settings and controls fit desktop and mobile in light and dark themes')

  scenario = 'read-error'
  await visit()
  await expect(section()).toContainText(/carregar|indisponível/i)
  await expect(section().getByTestId(/^ranking-participation-user-/)).toHaveCount(0)
  scenario = 'normal'
  await visit()
  await expect(include()).toBeVisible()
  record('Failed directory fetch does not invent participation or expose stale edit controls')

  admin = false
  const readStart = calls.length
  await visit()
  await expect(section()).toHaveCount(0)
  assert.deepEqual(calls.slice(readStart).filter(call => call.path.startsWith('/api/ranking-participation')), [])
  record('Non-admin cannot open participation controls or request their API')

  assert.deepEqual(users.map(user => user.id), initialIds)
  assert.equal(calls.some(call => call.method === 'DELETE'), false)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200))
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript), 'Only optional same-origin opaque scripts may be blocked')
  completed = true
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, fixtureWrites: writes.length, realWrites: 0, errors, unexpected, blocked }))
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    await fs.writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`)
  }
  throw error
} finally {
  if (releaseWrite) releaseWrite()
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: completed, published, assets, checks, calls, writes, realApiRequests: 0, realWrites: 0, errors, unexpected, blocked, applicationAssets: [...applicationAssets.values()] }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
