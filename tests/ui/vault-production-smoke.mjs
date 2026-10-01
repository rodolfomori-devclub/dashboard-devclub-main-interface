// Explicit production smoke: actual Vault login/PKCE, isolated browser contexts,
// no mocked endpoints, token injection, business writes, HAR or saved sessions.
// VAULT_SMOKE_CREDENTIALS_DIR=/private/test-folder node tests/ui/vault-production-smoke.mjs
// Add --check to validate local inputs without opening a browser or making requests.
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { SCREENS } from '../../src/lib/navigation.js'

const dashboard = 'https://dashboard.launchcontrol.com.br'
const vault = 'https://auth.clubeducacao.com.br'
const vaultApi = 'https://vault-api-production-5ef1.up.railway.app'
const api = 'https://dashboard-devclub-main-api-production.up.railway.app'
const clientId = 'vault_1ba956672dccd783a33fc46f8b9d4d30'
const directory = process.env.VAULT_SMOKE_CREDENTIALS_DIR
assert.ok(directory, 'Set VAULT_SMOKE_CREDENTIALS_DIR to the private test account directory')
assert.equal((await fs.stat(directory)).mode & 0o077, 0, 'Credentials directory must be private')
const profiles = {
  admin: { entry: '/admin', heading: 'Administração', permissions: SCREENS.map(screen => screen.permission).sort(), menuCount: SCREENS.length },
  user: { entry: '/diario', heading: 'Diário de vendas', permissions: ['daily', 'today'], menus: ['/diario', '/global'] },
  seller: { entry: '/daily-kpis', heading: 'KPIs Diários', permissions: ['commissions', 'daily-kpis'], menus: ['/daily-kpis', '/commissions'] },
}
const selected = (process.env.VAULT_SMOKE_PROFILES || 'admin,user,seller').split(',')
const accounts = new Map()
for (const name of selected) {
  assert.ok(profiles[name], 'Invalid smoke profile')
  const file = path.join(directory, `${name}-credentials.json`)
  assert.equal((await fs.stat(file)).mode & 0o077, 0, 'Credential files must be private')
  const account = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.ok(account.email?.startsWith('codex-release-') && account.email.endsWith('@test.invalid'), 'Only temporary release test accounts are allowed')
  assert.ok(account.password && account.userId, 'Missing test credentials')
  accounts.set(name, account)
}
if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ inputsValid: true, profiles: selected, networkRequests: 0 }))
  process.exit(0)
}

const output = await fs.mkdtemp(path.join(os.tmpdir(), 'vault-browser-smoke-'))
await fs.chmod(output, 0o700)
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(localChrome) ? localChrome : undefined) })
const results = []
let failed = false
try {
  for (const name of selected) {
    const spec = profiles[name], account = accounts.get(name)
    // Never connect to or reuse a personal browser/profile.
    const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    page.setDefaultTimeout(30_000)
    const responses = [], pageErrors = []
    let stage = 'open-dashboard', authenticated = false
    page.on('pageerror', error => pageErrors.push(error.name))
    page.on('response', response => {
      const url = new URL(response.url())
      // Intentionally exclude bodies, headers, query strings and customer data.
      if ([api, vaultApi].includes(url.origin)) responses.push({ path: url.pathname, status: response.status(), authenticated })
    })
    try {
      await page.goto(dashboard + spec.entry, { waitUntil: 'domcontentloaded' })
      await page.getByRole('button', { name: 'Entrar pelo Vault', exact: true }).click()
      await page.waitForURL(url => url.origin === vault && url.pathname === '/login')
      const loginUrl = new URL(page.url())
      assert.equal(loginUrl.searchParams.get('client_id'), clientId)
      assert.equal(loginUrl.searchParams.get('redirect_uri'), dashboard + '/callback')
      assert.equal(loginUrl.searchParams.get('code_challenge_method'), 'S256')
      assert.ok(loginUrl.searchParams.get('code_challenge')?.length >= 43)
      stage = 'vault-login'
      await page.getByPlaceholder('seu@email.com', { exact: true }).fill(account.email)
      await page.getByPlaceholder('Sua senha', { exact: true }).fill(account.password)
      const [accessResponse] = await Promise.all([
        page.waitForResponse(response => new URL(response.url()).origin === api && new URL(response.url()).pathname === '/api/access' && response.status() === 200),
        page.getByRole('button', { name: 'Entrar', exact: true }).click(),
      ])
      const access = (await accessResponse.json()).user
      authenticated = true
      assert.equal(access.sub, account.userId, 'Authenticated identity differs from selected test account')
      assert.equal(access.isAdmin, name === 'admin')
      assert.deepEqual([...access.permissions].sort(), spec.permissions)
      await page.waitForURL(url => url.origin === dashboard && url.pathname === spec.entry)
      await page.getByRole('heading', { name: spec.heading, exact: true }).first().waitFor()
      stage = 'menu-permissions'
      const menu = await page.locator('#workspace-navigation nav a').evaluateAll(links => links.map(link => new URL(link.href).pathname).sort())
      if (spec.menus) assert.deepEqual(menu, [...spec.menus].sort())
      else assert.equal(menu.length, spec.menuCount)
      assert.equal(await page.getByRole('heading', { name: 'Esta tela não pôde ser aberta', exact: true }).count(), 0)

      if (name === 'seller') {
        stage = 'seller-commissions'
        await Promise.all([
          page.waitForResponse(response => new URL(response.url()).origin === api && new URL(response.url()).pathname === '/api/hub/session' && response.status() === 200),
          page.goto(dashboard + '/commissions', { waitUntil: 'domcontentloaded' }),
        ])
        await page.getByRole('heading', { name: 'Comissões', exact: true }).first().waitFor()
      }
      if (name !== 'admin') {
        stage = 'direct-route-denial'
        for (const forbidden of ['/admin', '/financial', '/results']) {
          await page.goto(dashboard + forbidden, { waitUntil: 'domcontentloaded' })
          await page.getByRole('heading', { name: 'Acesso não liberado', exact: true }).waitFor()
        }
      }
      assert.deepEqual(pageErrors, [], 'Browser runtime errors occurred')
      assert.ok(responses.some(response => response.path === '/api/auth/login' && response.status === 200), 'No real Vault login was observed')
      assert.ok(responses.some(response => response.path === '/oauth/token' && response.status === 200), 'No real OAuth token exchange was observed')
      assert.equal(responses.filter(response => response.authenticated && response.path.startsWith('/api/hub/') && response.status >= 400).length, 0, 'Hub requests failed after authentication')
      results.push({ profile: name, passed: true, actualLogin: true, pkce: true, menuCount: menu.length, directRouteDenials: name === 'admin' ? 0 : 3, responses })
      console.log(JSON.stringify({ profile: name, passed: true, actualLogin: true, pkce: true, menuCount: menu.length }))
    } catch {
      // Playwright errors may include typed credentials or full OAuth URLs.
      // Report the stage/statuses only, never serialize the original exception.
      failed = true
      results.push({ profile: name, passed: false, stage, path: new URL(page.url()).pathname, pageErrors, responses })
      console.error(JSON.stringify({ profile: name, passed: false, stage }))
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
  const report = path.join(output, 'results.json')
  await fs.writeFile(report, JSON.stringify({ dashboard, realServices: true, isolatedContexts: true, results }, null, 2), { mode: 0o600 })
  console.log(JSON.stringify({ report, passed: !failed }))
}
if (failed) process.exitCode = 1
