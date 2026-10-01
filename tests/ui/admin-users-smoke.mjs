// Account-management UI against an in-memory Vault-shaped fixture. Every API
// and outbound request is intercepted; no user, password or email is real.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { readPublishedVault } from './published-vault.mjs'
import { adminUsersCatalogFixture as catalog } from './admin-users-read-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/admin-users', import.meta.url))
await fs.mkdir(out, { recursive: true })
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const existingId = '11111111-1111-4111-8111-111111111111'
const teamId = catalog.teams[0].id
// Production Vault retains historical screen titles; the Dashboard presents
// its current navigation labels while continuing to send canonical IDs.
const vaultCatalog = { ...catalog, permissions: catalog.permissions.map(item => ({ ...item,
  label: ({ today: 'Hoje', daily: 'Diario' })[item.id] || item.label,
})) }
const revisionFor = (id, version) => createHash('sha256').update(`${id}:${version}`).digest('hex').slice(0, 32)
const userShape = (id, name, email, permissions, isAdmin = false) => ({ id, name, email, active: true, isAdmin, permissions, revision: revisionFor(id, 1) })
const users = [userShape(adminId, 'Admin QA', 'admin@example.test', [], true), userShape(existingId, 'Pessoa existente', 'existing@example.test', ['hub-home'])]
const createdByKey = new Map(), creates = [], accessWrites = [], hubWrites = [], calls = [], checks = [], errors = [], unexpected = [], blocked = []
const applicationAssets = new Map()
let base = process.env.DASHBOARD_SMOKE_URL, server, serverOutput = '', browser, page, assets = null, completed = false
let admin = true, actor = users[0], scenario = 'normal', pendingCreate = false, releaseCreate, serial = 100
let failedOnce = false
const record = name => { checks.push(name); console.log(`PASS ${name}`) }
const redactedCreate = create => ({ ...create, input: { ...create.input, password: '[synthetic credential omitted]' } })
const writableKeys = ['email', 'excludedFromRanking', 'isAdmin', 'name', 'password', 'permissions', 'teamId']

async function fixture(route) {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
  if (!path.startsWith('/api/')) {
    const appPath = ['/admin', '/hub', '/mensal'].includes(path) || path.startsWith('/assets/') || /^\/(?:devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(path)
    if (url.origin !== base || method !== 'GET' || (published && !appPath)) {
      blocked.push({ external: url.origin !== base, method, resource: request.resourceType(), opaqueScript: /^\/[A-Za-z0-9_-]{80,}$/.test(path) })
      await route.abort(); return
    }
    await route.continue(); return
  }
  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type,idempotency-key', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' } }); return
  }
  calls.push({ path, method, query: url.search, admin, scenario })
  let body, status = 200
  if (path === '/api/access' && method === 'GET') body = { user: { sub: actor.id, email: actor.email, name: actor.name, permissions: admin ? ['admin'] : actor.permissions, isAdmin: admin } }
  else if (path === '/api/ranking-participation' && method === 'GET') body = { users: [] }
  else if (path.startsWith('/api/admin/users')) {
    assert.equal(admin, true, 'Only scoped Dashboard administrators request user administration')
    if (path === '/api/admin/users/catalog' && method === 'GET') {
      if (scenario === 'catalog-error') { status = 503; body = { error: 'Catálogo de permissões indisponível.', code: 'VAULT_UNAVAILABLE' } }
      else body = scenario === 'teams-error' ? { ...vaultCatalog, teams: [], teamsUnavailable: true } : vaultCatalog
    } else if (path === '/api/admin/users' && method === 'GET') {
      if (scenario === 'list-error') { status = 503; body = { error: 'Não foi possível consultar os usuários.' } }
      else {
        const query = (url.searchParams.get('search') || '').toLowerCase()
        const filtered = users.filter(user => `${user.name} ${user.email}`.toLowerCase().includes(query))
        const currentPage = Number(url.searchParams.get('page') || 1), limit = Number(url.searchParams.get('limit') || 50)
        body = { users: filtered.slice((currentPage - 1) * limit, currentPage * limit), total: filtered.length, page: currentPage, limit, totalPages: Math.ceil(filtered.length / limit) }
      }
    } else if (path === '/api/admin/users' && method === 'POST') {
      const input = request.postDataJSON(), key = request.headers()['idempotency-key']
      assert.deepEqual(Object.keys(input).sort(), writableKeys)
      assert.match(key || '', /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, 'Every create intent has a stable random idempotency key')
      assert.equal(typeof input.isAdmin, 'boolean')
      assert.equal(typeof input.excludedFromRanking, 'boolean')
      assert.ok(input.teamId === null || catalog.teams.some(team => team.id === input.teamId))
      assert.ok(Array.isArray(input.permissions) && input.permissions.every(id => catalog.permissions.some(permission => permission.id === id)))
      assert.ok(!input.permissions.includes('admin'), 'Administrative status is scoped and never an injected permission')
      assert.ok(typeof input.password === 'string' && input.password.length >= 20)
      for (const pattern of [/[A-Z]/, /[a-z]/, /\d/, /[^A-Za-z0-9]/]) assert.match(input.password, pattern)
      creates.push({ input, key, scenario })
      if (scenario === 'delayed-create') await new Promise(resolve => { pendingCreate = true; releaseCreate = resolve })
      if (scenario === 'write-error') { status = 503; body = { error: 'Vault temporariamente indisponível.', code: 'VAULT_UNAVAILABLE' } }
      else if (scenario === 'validation-error') { status = 400; body = { error: 'Revise os dados informados.', code: 'VALIDATION_ERROR' } }
      else {
        const previous = createdByKey.get(key)
        if (previous) {
          assert.deepEqual(input, previous.input, 'Retry preserves identity, credentials, access, team and ranking intent')
          body = { ...previous.result, replayed: true }
        } else if (users.some(user => user.email.toLowerCase() === input.email.toLowerCase())) {
          status = 409; body = { code: 'USER_ALREADY_HAS_ACCESS', error: 'Esta conta já possui acesso ao Dashboard. Edite os acessos na lista.' }
        } else {
          const id = `22222222-2222-4222-8222-${String(serial++).padStart(12, '0')}`
          const created = scenario !== 'attach-existing'
          const user = userShape(id, created ? input.name : 'Conta original preservada', input.email.toLowerCase(), input.isAdmin ? [] : input.permissions, input.isAdmin)
          const hub = scenario === 'hub-pending' ? { status: 'pending', profileId: null, requestId: key, error: 'Cadastro comercial pendente.', retryable: true } : { status: 'ready', profileId: id }
          user.hub = hub
          users.push(user)
          body = { user, created, replayed: false, loginUrl: catalog.loginUrl, hub }
          createdByKey.set(key, { input: structuredClone(input), result: structuredClone(body) })
        }
        if (scenario === 'lost-response' && !failedOnce) { failedOnce = true; await route.abort('failed'); return }
      }
    } else if (/^\/api\/admin\/users\/[^/]+\/sync-profile$/.test(path) && method === 'POST') {
      const id = path.split('/')[4], input = request.postDataJSON(), user = users.find(item => item.id === id)
      assert.ok(user)
      assert.deepEqual(input, { requestId: user.hub.requestId }, 'Commercial retry sends only the persisted operation identifier')
      hubWrites.push({ id, input })
      user.hub = { status: 'ready', profileId: user.id }
      body = { user, hub: user.hub }
    } else if (/^\/api\/admin\/users\/[^/]+\/access$/.test(path) && method === 'PUT') {
      const id = path.split('/')[4], input = request.postDataJSON(), user = users.find(item => item.id === id)
      assert.ok(user)
      assert.deepEqual(Object.keys(input).sort(), ['expectedRevision', 'isAdmin', 'permissions'])
      assert.ok(input.permissions.every(permission => catalog.permissions.some(item => item.id === permission)))
      accessWrites.push({ id, input })
      if (id === adminId) { status = 403; body = { error: 'Você não pode alterar o próprio acesso por esta tela.', code: 'SELF_ACCESS_CHANGE_DENIED' } }
      else if (input.expectedRevision !== user.revision) { status = 409; body = { error: 'Outro administrador alterou estes acessos.', code: 'DASHBOARD_ACCESS_CONFLICT' } }
      else {
        Object.assign(user, { isAdmin: input.isAdmin, permissions: input.isAdmin ? [] : input.permissions, revision: revisionFor(id, accessWrites.length + 1) })
        body = { user }
      }
    } else if (/^\/api\/admin\/users\/[^/]+$/.test(path) && method === 'GET') {
      const user = users.find(item => item.id === path.split('/')[4]); assert.ok(user); body = { user }
    } else { unexpected.push(`${method} ${path}`); await route.abort(); return }
  } else { unexpected.push(`${method} ${path}`); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'cache-control': 'no-store' }, body: JSON.stringify(body) })
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
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br' : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  let vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) {
    const html = await (await fetch(`${base}/admin`)).text()
    const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]
    assert.ok(main)
    if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET)
    const config = await readPublishedVault({ base, main })
    vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }
    assets = { main, publicVaultConfigured: true }
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(({ vaultUrl, clientId, adminId }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: adminId, iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.fixtureClipboard = value } } })
  }, { ...vault, adminId })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { const url = new URL(response.url()); if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() }) })
  const section = () => page.getByTestId('admin-users')
  const row = id => section().getByTestId(`admin-user-${id}`)
  const dialog = () => page.getByRole('dialog', { name: 'Adicionar usuário', exact: true })
  const nameInput = () => dialog().getByRole('textbox', { name: 'Nome completo', exact: true })
  const emailInput = () => dialog().getByRole('textbox', { name: 'E-mail', exact: true })
  const submit = () => dialog().getByRole('button', { name: 'Criar usuário', exact: true })
  const visit = async (path = '/admin') => { await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); if (path === '/admin') await page.getByRole('heading', { name: admin ? 'Administração' : 'Acesso não liberado', exact: true }).waitFor() }
  const open = async () => { await section().getByRole('button', { name: 'Adicionar usuário', exact: true }).click(); await dialog().waitFor() }
  const fill = async (name, email, permissions = ['hub-home', 'materials']) => {
    await nameInput().fill(name); await emailInput().fill(email)
    await dialog().getByRole('combobox', { name: 'Perfil do Dashboard', exact: true }).selectOption('user')
    await dialog().getByRole('button', { name: 'Limpar seleção', exact: true }).click()
    for (const permission of permissions) await dialog().getByRole('checkbox', { name: catalog.permissions.find(item => item.id === permission).label, exact: true }).check()
  }
  const noSavedPassword = async password => assert.equal(await page.evaluate(password => [localStorage, sessionStorage].some(storage => Object.values(storage).some(value => value.includes(password))), password), false, 'Temporary credentials never enter browser persistent/session storage')
  const shot = async name => { assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no horizontal overflow`); await page.screenshot({ path: `${out}/${name}.png`, fullPage: !await page.getByRole('dialog').count(), animations: 'disabled' }) }

  await visit()
  await expect(row(existingId)).toBeVisible()
  assert.equal(creates.length, 0)
  const selfEdit = row(adminId).getByRole('button', { name: 'Editar acessos: Admin QA', exact: true })
  if (await selfEdit.count()) await expect(selfEdit).toBeDisabled()
  await open()
  await expect(dialog().getByRole('checkbox', { name: 'Administração', exact: true })).toHaveCount(0)
  await expect(dialog().getByRole('combobox', { name: 'Perfil do Dashboard', exact: true })).toHaveValue('user')
  await expect(dialog().getByRole('checkbox', { name: 'Diário', exact: true })).toBeVisible()
  await expect(dialog().getByRole('checkbox', { name: 'Visão global', exact: true })).toBeVisible()
  await expect(dialog().getByRole('checkbox', { name: 'Hoje', exact: true })).toHaveCount(0)
  assert.equal(await dialog().getByRole('checkbox').count(), catalog.permissions.length + 1, 'Menu checklist includes only Dashboard screens plus ranking participation')
  record('Scoped administrator loads current users and the exact screen catalog without global Vault roles')

  const beforeInvalid = creates.length
  await submit().click()
  await nameInput().fill('Teste inválido'); await emailInput().fill('not-an-email')
  await submit().click()
  await nameInput().fill('   '); await emailInput().fill('valid@example.test')
  await submit().click()
  await nameInput().fill('Nome válido')
  await dialog().getByRole('button', { name: 'Limpar seleção', exact: true }).click()
  await submit().click()
  assert.equal(creates.length, beforeInvalid)
  record('Missing identity, whitespace-only name, invalid email and empty user menus are rejected before a create request')

  await fill('Pessoa nova QA', 'new-person@example.test')
  await dialog().getByRole('combobox', { name: 'Time', exact: true }).selectOption(teamId)
  await dialog().getByRole('checkbox', { name: /^Participa dos rankings/ }).uncheck()
  scenario = 'delayed-create'
  await submit().click()
  await expect.poll(() => pendingCreate).toBe(true)
  await expect(dialog().getByRole('button', { name: 'Salvando…', exact: true })).toBeDisabled()
  releaseCreate()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  const firstCreate = creates[0], firstUser = users.find(user => user.email === firstCreate.input.email)
  assert.deepEqual([...firstCreate.input.permissions].sort(), ['hub-home', 'materials'])
  assert.equal(firstCreate.input.isAdmin, false)
  assert.equal(firstCreate.input.teamId, teamId)
  assert.equal(firstCreate.input.excludedFromRanking, true)
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveValue(firstCreate.input.password)
  await page.getByRole('button', { name: 'Copiar senha', exact: true }).click()
  assert.equal(await page.evaluate(() => window.fixtureClipboard), firstCreate.input.password)
  await noSavedPassword(firstCreate.input.password)
  scenario = 'normal'
  record('New scoped user receives selected screens/team/ranking preference and an in-memory strong temporary password')

  // Reload removes the one-time credential and preserves the actual directory.
  await visit()
  await expect(row(firstUser.id)).toBeVisible()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveCount(0)
  await noSavedPassword(firstCreate.input.password)
  record('Credentials disappear after navigation/reload while the created user remains listed')

  await open(); await fill('Nome diferente', 'existing@example.test', ['today'])
  const existingBefore = structuredClone(users.find(user => user.id === existingId))
  await submit().click()
  await expect(dialog()).toContainText(/já possui|já.*acesso|existente/i)
  assert.deepEqual(users.find(user => user.id === existingId), existingBefore)
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveCount(0)
  record('Duplicate Dashboard account produces an explicit conflict and never overwrites credentials or permissions')

  await visit(); await open(); await fill('Solicitação de vínculo', 'other-vault-account@example.test')
  scenario = 'attach-existing'
  await submit().click()
  await expect(page.getByText(/Conta original preservada/).first()).toBeVisible()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveCount(0)
  await noSavedPassword(creates.at(-1).input.password)
  scenario = 'normal'
  record('Existing Vault identity gains Dashboard access without replacing its name or showing an unused password')

  await visit(); await open(); await fill('Repetição segura', 'retry-safe@example.test')
  scenario = 'lost-response'; failedOnce = false
  await submit().click()
  await expect(dialog().getByRole('alert')).toBeVisible()
  const lost = creates.at(-1), beforeRetry = users.length
  scenario = 'normal'
  await submit().click()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  assert.equal(users.length, beforeRetry)
  assert.equal(creates.at(-1).key, lost.key)
  assert.deepEqual(creates.at(-1).input, lost.input)
  await expect(page.getByLabel('Senha temporária', { exact: true })).toHaveValue(lost.input.password)
  await noSavedPassword(lost.input.password)
  record('Lost response retries the same idempotency key and exact payload without creating another account')

  await visit(); await open(); await fill('Dados a revisar QA', 'corrected@example.test')
  scenario = 'validation-error'
  await submit().click()
  await expect(dialog().getByRole('alert')).toBeVisible()
  await expect(nameInput()).toBeEnabled()
  const rejectedKey = creates.at(-1).key
  await nameInput().fill('Dados corrigidos QA')
  scenario = 'normal'
  await submit().click()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  assert.notEqual(creates.at(-1).key, rejectedKey)
  assert.equal(creates.at(-1).input.name, 'Dados corrigidos QA')
  record('Definitive validation rejection unlocks corrections and creates a fresh intent instead of endlessly retrying invalid data')

  await visit(); await open(); await fill('Gestor do Dashboard QA', 'dashboard-admin@example.test', [])
  await dialog().getByRole('combobox', { name: 'Perfil do Dashboard', exact: true }).selectOption('admin')
  await submit().click()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  assert.equal(creates.at(-1).input.isAdmin, true)
  assert.equal('role' in creates.at(-1).input, false)
  assert.equal('systemId' in creates.at(-1).input, false)
  record('Administrator option applies only to Dashboard and never sends a global Vault role or arbitrary system')

  await visit(); await open(); await fill('Comercial pendente QA', 'hub-pending@example.test')
  scenario = 'hub-pending'
  await submit().click()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  const beforeCommercialRetry = creates.length, pendingUser = users.find(user => user.email === 'hub-pending@example.test')
  scenario = 'normal'
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click()
  await page.getByRole('button', { name: 'Concluir cadastro comercial', exact: true }).first().click()
  await expect.poll(() => hubWrites.length).toBe(1)
  assert.equal(hubWrites[0].id, pendingUser.id)
  assert.equal(creates.length, beforeCommercialRetry)
  assert.equal(pendingUser.hub.status, 'ready')
  record('Partial commercial setup retries its persisted operation without resending a password or recreating the Vault account')

  await visit()
  await row(existingId).getByRole('button', { name: 'Editar acessos: Pessoa existente', exact: true }).click()
  const editor = () => page.getByRole('dialog', { name: 'Acessos de Pessoa existente', exact: true })
  await editor().getByRole('checkbox', { name: 'Materiais', exact: true }).check()
  await editor().getByRole('button', { name: /Salvar acessos/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Concluir', exact: true }).click()
  await editor().waitFor({ state: 'hidden' })
  assert.deepEqual(accessWrites.at(-1), { id: existingId, input: { isAdmin: false, permissions: ['hub-home', 'materials'], expectedRevision: existingBefore.revision } })
  record('Access editing uses an explicit revision and modifies only the selected Dashboard permissions')

  await row(existingId).getByRole('button', { name: 'Editar acessos: Pessoa existente', exact: true }).click()
  const serverUser = users.find(user => user.id === existingId)
  Object.assign(serverUser, { permissions: ['today'], revision: revisionFor(existingId, 99) })
  const beforeConflict = accessWrites.length
  await editor().getByRole('checkbox', { name: 'Anual', exact: true }).check()
  await editor().getByRole('button', { name: /Salvar acessos/ }).click()
  await expect(editor().getByRole('alert')).toContainText(/administrador|atualiz|recarreg/i)
  assert.equal(accessWrites.length, beforeConflict + 1)
  assert.deepEqual(serverUser.permissions, ['today'])
  record('Stale access editor reports a conflict and cannot silently overwrite a newer permission change')

  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('workspace-theme', theme), theme)
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 }); await visit(); await row(existingId).waitFor(); await shot(`users-${theme}-${width}`)
      await open(); await shot(`user-form-${theme}-${width}`)
    }
  }
  record('Directory and screen-selection form remain readable in desktop/mobile and both themes')

  scenario = 'teams-error'
  await visit(); await open()
  await expect(dialog()).toContainText(/Times temporariamente indisponíveis/)
  await expect(dialog().getByRole('combobox', { name: 'Time', exact: true })).toHaveValue('')
  await fill('Pessoa sem time QA', 'without-team@example.test')
  await submit().click()
  await expect(page.getByLabel('Senha temporária', { exact: true })).toBeVisible()
  assert.equal(creates.at(-1).input.teamId, null)
  scenario = 'normal'
  record('Unavailable team directory is explicit and still allows a new account without inventing a team assignment')

  scenario = 'catalog-error'
  await visit()
  await expect(section().getByRole('alert').first()).toBeVisible()
  const writesBeforeUnavailable = creates.length
  const add = section().getByRole('button', { name: 'Adicionar usuário', exact: true })
  if (await add.count()) await expect(add).toBeDisabled()
  assert.equal(creates.length, writesBeforeUnavailable)
  scenario = 'normal'
  record('Unavailable permission catalog disables account creation rather than assuming unrestricted access')

  admin = false; actor = firstUser
  const beforeReader = calls.length
  await visit('/hub')
  await page.getByRole('heading', { name: 'Seu espaço de trabalho', exact: true }).waitFor()
  await expect(page.getByRole('link', { name: 'Materiais', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Administração', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Mensal', exact: true })).toHaveCount(0)
  await visit('/admin')
  await expect(section()).toHaveCount(0)
  await visit('/mensal')
  await page.getByRole('heading', { name: 'Acesso não liberado', exact: true }).waitFor()
  assert.deepEqual(calls.slice(beforeReader).filter(call => call.path !== '/api/access'), [])
  record('Created user sees exactly its menus; direct Admin/monthly routes are denied before their APIs run')

  assert.equal(calls.some(call => call.method === 'DELETE'), false)
  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200))
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript))
  completed = true
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, fixtureCreates: createdByKey.size, accessWrites: accessWrites.length, realWrites: 0, errors, unexpected }))
} catch (error) {
  if (page) {
    await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
    let failure = `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`
    for (const { input } of creates) failure = failure.replaceAll(input.password, '[synthetic credential omitted]')
    await fs.writeFile(`${out}/failure.txt`, failure)
  }
  throw error
} finally {
  if (releaseCreate) releaseCreate()
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: completed, published, assets, checks, calls, creates: creates.map(redactedCreate), accessWrites, hubWrites, errors, unexpected, blocked, realApiRequests: 0, realWrites: 0, applicationAssets: [...applicationAssets.values()] }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
