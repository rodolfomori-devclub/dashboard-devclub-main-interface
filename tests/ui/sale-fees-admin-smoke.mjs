// Real Admin UI with isolated API fixtures: the sale fee table editor.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { adminUsersCatalogFixture, emptyAdminUsersFixture } from './admin-users-read-fixture.mjs'
import { emptySaleFeesFixture } from './sale-fees-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = process.env.DASHBOARD_SMOKE_OUTPUT || await fs.mkdtemp(join(tmpdir(), 'sale-fees-smoke-'))
let base = process.env.DASHBOARD_SMOKE_URL, server, browser, page, serverOutput = ''
let saved = structuredClone(emptySaleFeesFixture), conflict = false
const checks = [], writes = [], previews = [], unexpected = [], errors = []
const record = name => { checks.push(name); console.log(`PASS ${name}`) }

async function fixture(route) {
  const request = route.request(), url = new URL(request.url()), method = request.method(), path = url.pathname
  if (!path.startsWith('/api/')) { if (url.origin === base) await route.continue(); else await route.abort(); return }
  let body, status = 200
  if (path === '/api/access') body = { user: { sub: 'fixture-admin', name: 'Admin QA', email: 'admin@example.test', permissions: ['admin'], isAdmin: true } }
  else if (path === '/api/admin/users/catalog') body = adminUsersCatalogFixture
  else if (path === '/api/admin/users') body = emptyAdminUsersFixture
  else if (path === '/api/ranking-participation') body = { users: [] }
  else if (path === '/api/mcp/status') body = { enabled: false, writesEnabled: false }
  else if (path === '/api/sale-fees' && method === 'GET') body = saved
  else if (path === '/api/sale-fees/preview' && method === 'POST') {
    const input = request.postDataJSON(); previews.push(input)
    body = { complete: true, pending: 0, missing: 0,
      months: [{ month: '2026-11', count: 27, charged: 58021.85, previous: 50918.4, current: 50918.4, proposed: 51867.41 }],
      rules: [{ rule: 'pagarme.card.12', count: 16, charged: 36364.6, proposed: 31917.45 }, { rule: 'legacy:installments', count: 1, charged: 3557.42, proposed: 2882.77 }] }
  } else if (path === '/api/sale-fees' && method === 'PUT') {
    const input = request.postDataJSON(); writes.push(input)
    if (conflict || input.expectedRevision !== saved.revision) { status = 409; body = { code: 'SALE_FEES_CONFLICT', error: 'A tabela de taxas foi alterada por outro administrador. Recarregue antes de salvar.' } }
    else { saved = { ...saved, settings: input.settings, revision: saved.revision + 1, updatedAt: '2026-11-26T01:30:00Z' }; body = saved }
  } else if (path === '/api/sale-fees/history') body = { entries: [{ revision: 1, actor: 'admin@example.test', createdAt: '2026-11-26T01:30:00Z', before: null, after: saved.settings }] }
  else { unexpected.push(`${method} ${path}`); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
}

try {
  if (!base) {
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
    const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
      { cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` } })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
    server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
    let ready = false
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (server.exitCode !== null) throw new Error(serverOutput)
      try { ready = (await fetch(base)).ok } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
    }
    assert.equal(ready, true, serverOutput)
  }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(({ vaultUrl, clientId }) => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: 'fixture-admin', iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`)
  }, { vaultUrl: base, clientId: 'local-fixture-client' })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  page = await context.newPage()
  page.setDefaultTimeout(15000)
  page.on('pageerror', error => errors.push(error.message))
  const section = () => page.getByTestId('sale-fee-settings')
  const button = name => section().getByRole('button', { name, exact: true })

  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' })
  await section().getByRole('heading', { name: 'Tabela de taxas das vendas', exact: true }).waitFor()
  await expect(section()).toContainText('Nenhuma tabela salva: todas as vendas usam a regra anterior.')
  await expect(button('Salvar tabela')).toBeDisabled()
  record('Admin sees that no fee table is in force and nothing can be saved yet')

  await button('Nova vigência').click()
  await expect(section().getByRole('textbox', { name: 'ATUAL cartão 12x' })).toHaveValue('12,22')
  await expect(section().getByRole('textbox', { name: 'RENEG cartão 12x' })).toHaveValue('11,98')
  await section().getByLabel('TMB (% do contratado)').fill('0')
  await button('Usar esta vigência').click()
  await expect(section().getByRole('alert')).toContainText('percentual da TMB')
  await section().getByLabel('TMB (% do contratado)').fill('40')
  await section().getByLabel('Começa em').fill('2025-10-01')
  await button('Usar esta vigência').click()
  await expect(section().getByRole('row', { name: /01\/10\/2025 ATUAL 12,22%/ })).toBeVisible()
  record('A new schedule starts from the owner table, rejects an invalid TMB rate and lists the CET of 12x')

  await button('Prévia do impacto').click()
  await expect(section()).toContainText('R$ 51.867,41')
  assert.equal(previews.at(-1).settings.schedules[0].scenarios[0].pagarme.card[11], 0.1222)
  assert.deepEqual(Object.keys(previews.at(-1)).sort(), ['endDate', 'settings', 'startDate'])
  assert.ok((Date.parse(previews.at(-1).endDate) - Date.parse(previews.at(-1).startDate)) / 86400000 <= 366, 'The default range fits the 366 days the API accepts')
  await section().getByText('Como cada venda foi calculada').click()
  await expect(section()).toContainText('Pagar.me · cartão 12x')
  await expect(section()).toContainText('Regra anterior · parcelas sem taxa na tabela')
  record('The impact preview shows, per month, the previous rule, the saved table and the proposed table')

  await button('Salvar tabela').click()
  await expect(section().getByRole('alert')).toContainText('meses já fechados serão recalculados')
  assert.equal(writes.length, 0, 'A past-dated schedule needs an explicit confirmation')
  await button('Confirmar e salvar').click()
  await expect(section()).toContainText('Tabela salva. As telas passam a usar a nova tabela em até 2 minutos.')
  assert.deepEqual([writes.length, writes[0].expectedRevision, writes[0].settings.schedules[0].tmb.cashRate], [1, 0, 0.4])
  await expect(button('Salvar tabela')).toBeDisabled()
  await expect(section().getByText('Como cada venda foi calculada')).toHaveCount(0)
  await expect(section()).toContainText('Revisão 1, salva em 25/11/2026.')
  record('Saving a past-dated schedule asks for confirmation, sends the current revision, clears the preview and dates the save in Brasília')

  conflict = true
  await section().getByRole('button', { name: 'Remover a vigência de 01/10/2025' }).click()
  await button('Salvar tabela').click()
  await expect(section().getByRole('alert')).toContainText('meses já fechados serão recalculados')
  assert.equal(writes.length, 1, 'Removing a past schedule recalculates closed months and needs a confirmation too')
  await button('Confirmar e salvar').click()
  await expect(section().getByRole('alert')).toContainText('alterada por outro administrador')
  await button('Recarregar').click()
  await expect(section().getByRole('row', { name: /01\/10\/2025/ })).toBeVisible()
  conflict = false
  record('A concurrent change is refused and the editor reloads the saved table instead of overwriting it')

  await section().getByRole('button', { name: 'Editar a vigência de 01/10/2025' }).click()
  await section().getByLabel('Começa em').fill('2025-11-01')
  await button('Usar esta vigência').click()
  await expect(section().getByRole('row', { name: /01\/11\/2025/ })).toBeVisible()
  await expect(section().getByRole('row', { name: /01\/10\/2025/ })).toHaveCount(0)
  await button('Nova vigência').click()
  await section().getByLabel('Começa em').fill('2025-11-01')
  await button('Usar esta vigência').click()
  await expect(section().getByRole('alert')).toContainText('Já existe uma vigência a partir de 01/11/2025')
  await button('Cancelar').click()
  await button('Descartar alterações').click()
  await expect(section().getByRole('row', { name: /01\/10\/2025/ })).toBeVisible()
  await button('Nova vigência').click()
  await section().getByLabel('Começa em').fill('2099-01-01')
  await button('Usar esta vigência').click()
  await button('Salvar tabela').click()
  await expect(section()).toContainText('Tabela salva.')
  assert.deepEqual([writes.length, writes.at(-1).expectedRevision, writes.at(-1).settings.schedules.map(item => item.effectiveFrom)], [3, 1, ['2025-10-01', '2099-01-01']])
  record('Editing a start date moves the schedule, a taken date is refused, and a future-only change saves without the past-date warning')

  await button('Histórico').click()
  await expect(section()).toContainText('25/11/2026 · admin@example.test')
  await page.setViewportSize({ width: 360, height: 900 })
  await page.goto(`${base}/admin`, { waitUntil: 'networkidle' })
  await section().getByRole('heading', { name: 'Tabela de taxas das vendas', exact: true }).waitFor()
  const measure = () => page.evaluate(() => {
    if (document.documentElement.scrollWidth <= innerWidth) return []
    const scrolls = element => { for (let node = element.parentElement; node; node = node.parentElement) if (['auto', 'scroll'].includes(getComputedStyle(node).overflowX)) return true; return false }
    const root = document.querySelector('[data-testid="sale-fee-settings"]')
    return [...root.querySelectorAll('*')].filter(element => element.getBoundingClientRect().width > root.getBoundingClientRect().width + 1 && !scrolls(element))
      .slice(0, 8).map(element => `${element.tagName.toLowerCase()}.${String(element.className).split(' ')[0]} ${Math.round(element.getBoundingClientRect().width)}px`)
      .concat(`page ${document.documentElement.scrollWidth}px`)
  })
  assert.deepEqual(await measure(), [], 'The admin page with the fee table fits a 360px screen')
  await button('Nova vigência').click()
  assert.deepEqual(await measure(), [], 'The open schedule editor fits a 360px screen')
  record('History lists the saved revisions and the page, with the editor open, fits a 360px screen')

  assert.deepEqual(unexpected, [])
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ passed: true, checks: checks.length, writes: writes.length, previews: previews.length }))
} catch (error) {
  if (page) await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {})
  throw error
} finally {
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
