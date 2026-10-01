// All identities, sales, rules and writes are in-memory fixtures. API requests
// never reach any external service, including when the published JS is tested.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'
import { readPublishedVault } from './published-vault.mjs'
import { emptyProviderPayload, periodCacheFixture } from './period-cache-fixture.mjs'

const root = fileURLToPath(new URL('../../', import.meta.url))
const published = process.env.DASHBOARD_SMOKE_PRODUCTION === '1'
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/commissions-attribution', import.meta.url))
await fs.mkdir(out, { recursive: true })
const date = '2026-10-01', month = '2026-10'
const adminId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const emanuelId = '11111111-1111-4111-8111-111111111111'
const rebecaId = '22222222-2222-4222-8222-222222222222'
const emanuel = { id: emanuelId, name: 'Emanuel QA', email: 'emanuel@example.test', role: 'vendedor', active: true }
const rebeca = { id: rebecaId, name: 'Rebeca QA', email: 'rebeca@example.test', role: 'vendedor', active: true }
const sellers = [emanuel, rebeca]
const source = 'Comercial-Emanuel'
const hostile = '<img src=x onerror="window.fixtureInjection=true">'
const utm = { source, medium: 'whatsapp', campaign: 'turma-qa', content: hostile, term: 'consulta-qa' }
const mappings = [{ utmSource: source, sellerId: emanuelId, sellerName: emanuel.name, enabled: true, revision: 1 }]
const ledger = { attributions: [], manualSales: [], utmMappings: mappings, attributionMappingsStatus: 'ready' }
const ruleRows = []
const platforms = ['guru', 'hotmart', 'tmb', 'asaas', 'boletex', 'manual'].map(id => ({ id, label: ({ guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', asaas: 'Asaas', boletex: 'Boletex', manual: 'Manual' })[id] }))
const rawGuru = [{ hash: 'g-utm', product: { name: 'DevClub UTM QA' }, payment: { method: 'credit_card', total: 1000 },
  calculation_details: { net_amount: 900, total_amount: 1000, discounts: { fee: 100 }, net_affiliate_value: 0 },
  dates: { created_at: Math.floor(Date.parse(`${date}T12:00:00-03:00`) / 1000) }, contact: { name: 'Cliente QA', email: 'buyer@example.test' },
  trackings: Object.fromEntries(Object.entries(utm).map(([key, value]) => [`utm_${key}`, value])) },
{ hash: 'g-unknown', product: { name: 'Origem desconhecida QA' }, payment: { method: 'pix', total: 500 },
  calculation_details: { net_amount: 450, total_amount: 500 }, dates: { created_at: Math.floor(Date.parse(`${date}T10:00:00-03:00`) / 1000) },
  trackings: { utm_source: 'Comercial-Sem-Vínculo', utm_medium: 'email' } }]
const tmbPayload = { success: true, data: [{ id: 'tmb-qa-0', raw: { pedido_id: 'tmb-qa' }, product: 'TMB QA', value: 2000, timestamp: `${date}T12:00:00-03:00`, utm_source: 'Comercial-Rebeca' }] }
const calls = [], writes = [], checks = [], errors = [], unexpected = [], blocked = [], applicationAssets = new Map()
let base = process.env.DASHBOARD_SMOKE_URL, browser, page, server, serverOutput = '', completed = false, assets = null
let actor = { id: adminId, name: 'Admin QA', email: 'admin@example.test', role: 'gestor', active: true }, mode = 'admin', scenario = 'normal'
let conflictMapping = false, delayedMapping = false, releaseMapping, mappingPending = false
let conflictRule = false
const record = name => { checks.push(name); console.log(`PASS ${name}`) }
const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

function commissionBody(url) {
  const selectedMonth = url.searchParams.get('month'), requestedSeller = url.searchParams.get('sellerId')
  assert.match(selectedMonth, /^\d{4}-\d{2}$/)
  if (mode === 'seller') assert.equal(requestedSeller, null, 'A seller never requests another seller ID')
  const self = url.pathname.endsWith('/me') || mode === 'seller'
  const selectedSeller = self ? actor.id : requestedSeller
  const assignment = ledger.attributions.find(item => item.externalId === 'g-utm')
  const approved = mappings.find(item => item.utmSource === source && item.enabled)
  const owner = assignment ? sellers.find(item => item.id === assignment.sellerId) : approved ? sellers.find(item => item.id === approved.sellerId) : null
  let sales = owner ? [{ id: 'g-utm', externalId: 'g-utm', sourceId: 'guru', platform: 'Guru', date, product: 'DevClub UTM QA', family: 'DevClub',
    sellerId: owner.id, sellerName: owner.name, attributionMethod: assignment ? 'manual' : 'utm', utm,
    gross: 1000, cashCollected: 900, commission: null, commissionRate: null, commissionStatus: 'pending_rule' }] : []
  sales.push({ id: 'tmb-qa', externalId: 'tmb-qa', sourceId: 'tmb', platform: 'TMB', date, product: 'TMB QA', family: 'DevClub', sellerId: rebecaId, sellerName: rebeca.name,
    attributionMethod: 'manual', utm: { source: 'Comercial-Rebeca' }, gross: 2000, cashCollected: 800, commission: null, commissionRate: null, commissionStatus: 'pending_rule' },
  { id: 'zero-qa', externalId: 'zero-qa', sourceId: 'manual', platform: 'Pix direto', date, product: 'Sem recebimento QA', family: 'DevClub', sellerId: emanuelId, sellerName: emanuel.name,
    attributionMethod: 'manual', utm: {}, gross: 100, cashCollected: 0, commission: null, commissionRate: null, commissionStatus: 'pending_rule' },
  { id: 'refund-qa', externalId: 'refund-qa', sourceId: 'hotmart', platform: 'Hotmart', date, product: 'Reembolsada QA', family: 'DevClub', sellerId: emanuelId, sellerName: emanuel.name,
    attributionMethod: 'manual', utm: {}, gross: 300, cashCollected: 0, commission: null, commissionRate: null, commissionStatus: 'pending_refund' })
  if (['calculated', 'partial-calculated', 'timezone'].includes(scenario)) sales = sales.map(row => row.commissionStatus === 'pending_refund' ? row : { ...row, commission: row.id === 'g-utm' ? 45 : row.id === 'tmb-qa' ? 16 : 0, commissionRate: row.id === 'tmb-qa' ? 0.02 : 0.05, commissionStatus: 'calculated' })
  if (scenario === 'unknown-cash') sales = sales.map(row => row.id === 'g-utm' ? { ...row, cashCollected: null, commission: null, commissionStatus: 'pending_cash' } : row)
  if (scenario === 'timezone') sales = sales.map(row => ({ ...row, date: row.id === 'g-utm' ? `${selectedMonth}-16T01:30:00.000Z` : `${selectedMonth}-15` }))
  else if (selectedMonth !== month) sales = []
  if (scenario === 'loading') sales = []
  if (selectedSeller) sales = sales.filter(row => row.sellerId === selectedSeller)
  const pending = sales.filter(row => row.commission === null).length
  return { success: true, data: { period: { month: selectedMonth, startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-31` },
    scope: self ? 'self' : selectedSeller ? 'seller' : 'all', sellerId: selectedSeller, sellers: (selectedSeller ? sellers.filter(item => item.id === selectedSeller) : sellers).map(({ id, name }) => ({ id, name })), sales,
    summary: { salesCount: sales.length, gross: sales.reduce((sum, row) => sum + row.gross, 0), cashCollected: sales.length && sales.every(row => row.cashCollected === null) ? null : sales.reduce((sum, row) => sum + (row.cashCollected || 0), 0),
      commission: pending || ['partial', 'partial-calculated', 'loading'].includes(scenario) ? null : sales.reduce((sum, row) => sum + row.commission, 0), calculatedCommission: sales.reduce((sum, row) => sum + (row.commission || 0), 0), pendingCommissionCount: pending, refundedSalesCount: sales.filter(row => row.commissionStatus === 'pending_refund').length,
      missingCashCount: sales.filter(row => row.cashCollected === null).length, missingGrossCount: 0, unassignedSalesCount: 0 },
    status: { partial: ['partial', 'partial-calculated', 'unknown-cash'].includes(scenario), loading: scenario === 'loading', attributionAvailable: scenario !== 'attribution-error', sources: [{ id: 'guru', status: ['partial', 'partial-calculated'].includes(scenario) ? 'unavailable' : 'ready' }], generatedAt: `${date}T15:00:00Z`, refundReviewRequired: true, refundCoverage: [{ source: 'guru', basis: 'cancelled_at', status: 'period_only' }] },
    rules: { status: ['calculated', 'partial-calculated', 'timezone'].includes(scenario) ? 'configured' : 'not_configured', message: 'Percentuais ainda aguardam aprovação da gestão.' },
  } }
}

async function fixture(route) {
  const request = route.request(), url = new URL(request.url()), path = url.pathname, method = request.method()
  if (!path.startsWith('/api/')) {
    const allowed = ['/commissions', '/financial', '/atribuicao', '/hub'].includes(path) || path.startsWith('/assets/') || /^\/(devclub-favicon\.svg|devclub-apple-touch-icon\.png|favicon\.ico)$/.test(path)
    if (url.origin !== base || method !== 'GET' || published && !allowed) { blocked.push({ external: url.origin !== base, method, resource: request.resourceType(), opaqueScript: /^\/[A-Za-z0-9_-]{80,}$/.test(path) }); await route.abort(); return }
    await route.continue(); return
  }
  if (method === 'OPTIONS') { await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': base, 'access-control-allow-headers': 'authorization,content-type', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' } }); return }
  calls.push({ path, method, query: url.search, mode, scenario })
  let body, status = 200
  if (path === '/api/access') body = { user: { sub: actor.id, email: actor.email, name: actor.name, isAdmin: mode === 'admin', permissions: mode === 'admin' ? ['admin'] : mode === 'seller' ? ['commissions', 'hub-home', 'ranking', 'sales-links'] : ['financial'] } }
  else if (path === '/api/hub/session') body = { user: { ...actor, individual_goal: 0, is_editor: mode === 'admin', created_at: '2026-01-01T12:00:00Z' } }
  else if (path === '/api/commissions' || path === '/api/commissions/me') {
    assert.equal(method, 'GET')
    if (scenario === 'error') { status = 503; body = { error: 'Não foi possível consultar as comissões.' } }
    else body = commissionBody(url)
  } else if (path === '/api/commissions/rules') {
    assert.equal(mode, 'admin'); assert.equal(method, 'GET')
    const selectedMonth = url.searchParams.get('month')
    body = { success: true, data: { period: { month: selectedMonth, startDate: `${selectedMonth}-01`, endDate: `${selectedMonth}-31` }, sellers, rules: ruleRows, platforms } }
  } else if (path.startsWith('/api/commissions/rules/')) {
    assert.equal(mode, 'admin'); assert.equal(method, 'PUT')
    const input = request.postDataJSON(), sellerId = path.split('/').at(-1), saved = ruleRows.find(row => row.sellerId === sellerId)
    assert.deepEqual(Object.keys(input).sort(), ['expectedRevision', 'month', 'rates'])
    assert.deepEqual(Object.keys(input.rates).sort(), platforms.map(item => item.id).sort())
    assert.ok(Object.values(input.rates).every(value => value === null || typeof value === 'number' && value >= 0 && value <= 1))
    writes.push({ path, method, input })
    if (conflictRule) { conflictRule = false; saved.revision++; saved.rates.guru = 0.06; status = 409; body = { error: 'Regra alterada por outro administrador.' } }
    else { assert.equal(input.expectedRevision, saved?.revision || 0); const rule = { ...input, sellerId, sellerName: sellers.find(item => item.id === sellerId).name, revision: (saved?.revision || 0) + 1, basis: 'cash_collected', updatedAt: `${date}T15:00:00Z` }; if (saved) Object.assign(saved, rule); else ruleRows.push(rule); body = { success: true, data: { rule } } }
  } else if (path === '/api/sales-ops/utm-mappings') {
    assert.equal(mode, 'admin')
    if (method === 'PUT') {
      const input = request.postDataJSON()
      assert.deepEqual(Object.keys(input).sort(), ['enabled', 'expectedRevision', 'sellerId', 'utmSource'])
      writes.push({ path, method, input })
      if (delayedMapping) await new Promise(resolve => { mappingPending = true; releaseMapping = resolve })
      const saved = mappings.find(item => item.utmSource === input.utmSource)
      if (conflictMapping) { conflictMapping = false; status = 409; body = { error: 'Vínculo alterado por outro gestor.' }; if (saved) saved.revision++ }
      else if (input.expectedRevision !== (saved?.revision || 0)) { status = 409; body = { error: 'Revisão desatualizada.' } }
      else { const seller = sellers.find(item => item.id === input.sellerId); const value = { utmSource: input.utmSource, sellerId: input.sellerId, sellerName: seller?.name || '', enabled: input.enabled, revision: (saved?.revision || 0) + 1 }; if (saved) Object.assign(saved, value); else mappings.push(value); body = { success: true, data: value } }
    } else body = { success: true, data: { available: true, mappings, suggestions: ['Emanuel', 'Rebeca', 'Lucca', 'Bruna', 'Luiz', 'Sergio'].map(name => ({ utmSource: `Comercial-${name}` })) } }
  } else if (path === '/api/sales-ops/sellers') body = { data: sellers }
  else if (path === '/api/sales-ops/ledger') body = { data: ledger }
  else if (path === '/api/sales-ops/attributions') {
    assert.equal(method, 'PUT'); assert.equal(mode, 'admin')
    const input = request.postDataJSON(); writes.push({ path, method, input })
    assert.equal(input.snapshot.cashCollected, 900, 'Manual ownership keeps the actual Guru net cash')
    const seller = sellers.find(item => item.id === input.sellerId)
    assert.ok(seller)
    const saved = { ...input, id: 'assignment-qa', sellerName: seller.name, date, syncPending: false }
    ledger.attributions.splice(0, ledger.attributions.length, saved); body = { data: saved }
  } else if (path.startsWith('/api/sales-ops/audit/')) body = { data: [] }
  else if (path === '/api/period-cache') body = periodCacheFixture(url, { today: date, payloadForSource: id => id === 'guru' ? { data: rawGuru } : id === 'tmb' ? tmbPayload : emptyProviderPayload(id) })
  else if (path === '/api/transactions') body = { data: rawGuru }
  else if (path === '/api/refunds') body = { data: [] }
  else if (path.startsWith('/api/boleto/vendas/')) body = tmbPayload
  else if (path === '/api/hotmart/vendas') body = emptyProviderPayload('hotmart')
  else if (path === '/api/hotmart/reembolsos') body = emptyProviderPayload('hotmartRefunds')
  else if (path === '/api/boleto/asaas/vendas') body = { ...emptyProviderPayload('asaas'), data: { ...emptyProviderPayload('asaas').data, count: 1, totalGross: 1255.36, totalNet: 1255.36 } }
  else if (path === '/api/boleto/boletex/vendas') body = emptyProviderPayload('boletex')
  else if (path.startsWith('/api/hub/rest/v1/')) {
    assert.equal(method, 'GET', 'Commission screens never submit legacy reports, notifications or seller-entered monetary totals')
    const table = path.split('/').at(-1)
    if (table === 'profiles') body = sellers
    else if (table === 'sales_links') body = [{ id: 'untrusted-link', seller_id: rebecaId, link_url: `https://checkout.example.test/?utm_source=${source}`, product_name: 'Link alterado pelo vendedor' }]
    else body = []
  } else { unexpected.push(`${method} ${path}`); await route.abort(); return }
  await route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': base, 'cache-control': 'no-store' }, body: JSON.stringify(body) })
}

try {
  if (!base) {
    assert.equal(published, false)
    const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve))
    base = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env: { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-fixture-client', VITE_VAULT_REDIRECT_URI: `${base}/callback` }, stdio: ['ignore', 'pipe', 'pipe'] })
    server.stdout.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) }); server.stderr.on('data', chunk => { serverOutput = (serverOutput + chunk).slice(-2000) })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) { if (server.exitCode !== null) throw new Error(serverOutput); try { ready = (await fetch(base)).ok } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)) }
    assert.equal(ready, true, serverOutput)
  }
  assert.ok(published ? base === 'https://dashboard.launchcontrol.com.br' : ['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname))
  let vault = { vaultUrl: base, clientId: 'local-fixture-client' }
  if (published) { const html = await (await fetch(`${base}/commissions`)).text(); const main = html.match(/src="([^" ]*\/assets\/index-[^" ]+\.js)"/)?.[1]; assert.ok(main); if (process.env.DASHBOARD_EXPECTED_ASSET) assert.equal(main, process.env.DASHBOARD_EXPECTED_ASSET); const config = await readPublishedVault({ base, main }); vault = { vaultUrl: config.vaultUrl, clientId: config.clientId }; assets = { main, publicVaultConfigured: true } }
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE || (existsSync(chrome) ? chrome : undefined) })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(({ vaultUrl, clientId, adminId }) => { const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const id = localStorage.getItem('fixture-subject') || adminId; localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture' })}.${encode({ sub: id, iss: vaultUrl, aud: clientId, token_use: 'access', exp: 4102444800 })}.fixture-not-valid`) }, { ...vault, adminId })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', fixture)
  page = await context.newPage(); page.setDefaultTimeout(15000)
  await page.clock.setFixedTime(new Date(`${date}T15:00:00-03:00`))
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { const url = new URL(response.url()); if (url.origin === base && url.pathname.startsWith('/assets/')) applicationAssets.set(url.pathname, { path: url.pathname, status: response.status() }) })
  const visit = async (path, heading) => { await page.goto(`${base}${path}`, { waitUntil: 'networkidle' }); await page.getByRole('heading', { name: heading, exact: true }).first().waitFor() }
  const salesTable = () => page.getByRole('region', { name: 'Vendas para atribuição', exact: true })
  const attributionRow = id => salesTable().locator('tbody tr').filter({ hasText: id })
  const statement = () => page.getByRole('region', { name: 'Extrato de vendas e comissões', exact: true })
  const commissionRow = id => statement().locator('tbody tr').filter({ hasText: id })
  const mappingSection = () => page.getByTestId('utm-mappings')
  const mappingRow = value => page.getByTestId(`utm-mapping-${encodeURIComponent(value)}`)
  const shot = async name => {
    // Chromium resolves setViewportSize before responsive layout necessarily
    // catches up. Wait for paint before measuring, including open dialogs.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${name}: no page overflow`)
    await page.screenshot({ path: `${out}/${name}.png`, fullPage: !name.startsWith('rule-dialog'), animations: 'disabled' })
  }
  const switchActor = async (next, nextMode) => { actor = next; mode = nextMode; await page.evaluate(id => localStorage.setItem('fixture-subject', id), next.id) }

  await visit('/atribuicao', 'Atribuição e conciliação')
  await expect(attributionRow('g-utm')).toContainText(emanuel.name)
  await expect(attributionRow('g-unknown')).not.toContainText(emanuel.name)
  await attributionRow('g-utm').locator('summary').click()
  for (const field of ['source', 'medium', 'campaign', 'content', 'term']) await expect(attributionRow('g-utm')).toContainText(utm[field])
  assert.equal(await page.evaluate(() => window.fixtureInjection === true), false)
  assert.equal(writes.length, 0)
  assert.equal(calls.some(call => call.path.endsWith('/sales_links')), false, 'Seller-editable checkout links are never used as authoritative UTM mappings')
  record('Authorized UTM identifies the correct seller, retains all five source fields and renders hostile strings as text')
  await page.getByRole('combobox', { name: 'Identificação', exact: true }).selectOption('utm')
  await expect(salesTable().locator('tbody tr')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Identificação', exact: true }).selectOption('all')
  await page.getByRole('textbox', { name: 'Buscar venda', exact: true }).fill('consulta-qa')
  await expect(salesTable().locator('tbody tr')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Buscar venda', exact: true }).fill('')
  record('Attribution filters include UTM identification and search across tracking fields')

  mappings.push({ utmSource: ' comercial-emanuel ', sellerId: rebecaId, sellerName: rebeca.name, enabled: true, revision: 1 })
  await visit('/atribuicao', 'Atribuição e conciliação')
  await expect(attributionRow('g-utm')).toContainText('Não atribuído')
  mappings.pop()
  await visit('/atribuicao', 'Atribuição e conciliação')
  await expect(attributionRow('g-utm')).toContainText(emanuel.name)
  record('Conflicting normalized source aliases remain unassigned instead of choosing an arbitrary seller')

  await mappingSection().getByText('Configurar vínculos de UTM', { exact: true }).click()
  await expect(mappingRow('Comercial-Rebeca').getByRole('combobox')).toHaveValue('')
  await expect(mappingRow('Comercial-Rebeca').getByRole('button', { name: 'Salvar vínculo: Comercial-Rebeca', exact: true })).toBeDisabled()
  await mappingRow('Comercial-Rebeca').getByRole('combobox').selectOption(rebecaId)
  delayedMapping = true
  await mappingRow('Comercial-Rebeca').getByRole('button', { name: 'Salvar vínculo: Comercial-Rebeca', exact: true }).click()
  await expect.poll(() => mappingPending).toBe(true)
  await expect(mappingRow(source).getByRole('combobox')).toBeDisabled()
  releaseMapping(); delayedMapping = false
  await expect(mappingRow('Comercial-Rebeca')).toContainText(`Vinculada a ${rebeca.name}`)
  assert.deepEqual(writes.at(-1).input, { utmSource: 'Comercial-Rebeca', sellerId: rebecaId, enabled: true, expectedRevision: 0 })
  record('Suggested names never assign automatically; an explicit authorized save creates the mapping with revision protection')

  conflictMapping = true
  await mappingRow(source).getByRole('combobox').selectOption(rebecaId)
  await mappingRow(source).getByRole('button', { name: `Salvar vínculo: ${source}`, exact: true }).click()
  await expect(mappingSection().getByRole('alert')).toContainText('Outro gestor')
  await expect(mappingRow(source).getByRole('combobox')).toHaveValue(emanuelId)
  await expect(attributionRow('g-utm')).toContainText(emanuel.name)
  record('Concurrent mapping conflict reloads the approved seller instead of silently replacing ownership')

  await attributionRow('g-utm').getByRole('button', { name: /Atribuir|Revisar/ }).click()
  const assign = page.getByRole('dialog', { name: 'Atribuir venda', exact: true })
  await assign.getByRole('combobox', { name: 'Vendedor responsável', exact: true }).selectOption(rebecaId)
  await assign.getByRole('button', { name: 'Salvar venda', exact: true }).click()
  await expect(assign).toBeHidden()
  await expect(attributionRow('g-utm')).toContainText(rebeca.name)
  await expect(attributionRow('g-utm')).toContainText(/manual/i)
  await mappingRow(source).getByRole('button', { name: `Desativar vínculo: ${source}`, exact: true }).click()
  await expect(mappingRow(source)).toContainText('Vínculo desativado')
  await expect(attributionRow('g-utm')).toContainText(rebeca.name)
  record('Explicit manual reassignment keeps source data and survives disabling the automatic UTM mapping')

  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('workspace-theme', theme), theme)
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 }); await visit('/atribuicao', 'Atribuição e conciliação')
      await mappingSection().getByText('Configurar vínculos de UTM', { exact: true }).click()
      await attributionRow('g-utm').locator('summary').click()
      await shot(`attribution-${theme}-${width}`)
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  record('Attribution UTM details and approved mapping controls fit mobile and desktop in both themes')

  await visit('/financial', 'Comissões do time')
  await page.getByRole('button', { name: 'Configurar comissões', exact: true }).click()
  const ruleDialog = () => page.getByRole('dialog', { name: 'Regra de comissão', exact: true })
  await ruleDialog().getByRole('combobox', { name: 'Vendedor da regra', exact: true }).selectOption(emanuelId)
  for (const platform of platforms) await expect(ruleDialog().getByRole('spinbutton', { name: `Percentual ${platform.label}`, exact: true })).toHaveValue('')
  const beforeEmptyRule = writes.length
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).click()
  await expect(page.getByText('Informe pelo menos um percentual. Deixe as demais plataformas em branco.', { exact: true })).toBeVisible()
  assert.equal(writes.length, beforeEmptyRule)
  await ruleDialog().getByRole('spinbutton', { name: 'Percentual Guru', exact: true }).fill('5')
  await ruleDialog().getByRole('spinbutton', { name: 'Percentual TMB', exact: true }).fill('0')
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).click()
  await expect(ruleDialog()).toBeHidden()
  assert.deepEqual(writes.at(-1).input, { month, rates: { guru: 0.05, hotmart: null, tmb: 0, asaas: null, boletex: null, manual: null }, expectedRevision: 0 })
  record('Only an explicit admin rule converts 5% to 0.05; blank platforms stay pending and a typed zero remains zero')
  await page.getByRole('button', { name: 'Configurar comissões', exact: true }).click()
  await ruleDialog().getByRole('combobox', { name: 'Vendedor da regra', exact: true }).selectOption(emanuelId)
  await expect(ruleDialog().getByRole('spinbutton', { name: 'Percentual Guru', exact: true })).toHaveValue('5')
  await page.setViewportSize({ width: 360, height: 1000 }); await shot('rule-dialog-dark-360')
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).scrollIntoViewIfNeeded()
  await expect(ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true })).toBeInViewport()
  await shot('rule-dialog-actions-dark-360')
  await page.setViewportSize({ width: 1440, height: 1000 })
  await ruleDialog().getByRole('spinbutton', { name: 'Percentual Guru', exact: true }).fill('7')
  conflictRule = true
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).click()
  await expect(ruleDialog().getByRole('spinbutton', { name: 'Percentual Guru', exact: true })).toHaveValue('6')
  assert.equal(ruleRows[0].rates.guru, 0.06)
  await ruleDialog().getByRole('spinbutton', { name: 'Percentual Guru', exact: true }).fill('0.57')
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).click()
  await expect(ruleDialog()).toBeHidden()
  assert.equal(writes.at(-1).input.rates.guru, 0.0057)
  assert.equal(writes.at(-1).input.expectedRevision, 2)
  record('Rule revision conflict reloads the authoritative percentages instead of overwriting another administrator')

  await page.getByRole('button', { name: 'Configurar comissões', exact: true }).click()
  await ruleDialog().getByRole('combobox', { name: 'Vendedor da regra', exact: true }).selectOption(emanuelId)
  for (const platform of platforms) await ruleDialog().getByRole('spinbutton', { name: `Percentual ${platform.label}`, exact: true }).fill('')
  await ruleDialog().getByRole('button', { name: 'Salvar regra', exact: true }).click()
  await expect(ruleDialog()).toBeHidden()
  assert.ok(Object.values(writes.at(-1).input.rates).every(value => value === null))
  assert.equal(writes.at(-1).input.expectedRevision, 3)
  record('An administrator can explicitly clear an existing rule without turning unconfigured rates into zero')

  const beforeOwnAdmin = calls.length
  await visit('/commissions', 'Minhas comissões')
  const ownAdminCalls = calls.slice(beforeOwnAdmin).filter(call => call.path.startsWith('/api/commissions'))
  assert.ok(ownAdminCalls.length > 0)
  assert.ok(ownAdminCalls.every(call => call.path === '/api/commissions/me' && !new URLSearchParams(call.query).has('sellerId')))
  await expect(commissionRow('g-utm')).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: 'Vendedor das comissões', exact: true })).toHaveCount(0)
  record('The personal commission screen uses the own-user endpoint even for an administrator')

  await switchActor(rebeca, 'seller')
  await visit('/commissions', 'Minhas comissões')
  await expect(commissionRow('g-utm')).toContainText('Manual')
  await expect(commissionRow('tmb-qa')).toContainText(money(800))
  await expect(page.getByText('Aguardando regra', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Vendedor das comissões', exact: true })).toHaveCount(0)
  await expect(page.getByRole('combobox', { name: /Senioridade|Regra de comissão/ })).toHaveCount(0)
  await expect(commissionRow('zero-qa')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Enviar.*Relatório/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Configurar comissões', exact: true })).toHaveCount(0)
  record('Seller receives only its assigned sales, sees pending rules explicitly and cannot choose another seller or submit a legacy report')

  scenario = 'calculated'
  await visit('/commissions', 'Minhas comissões')
  await expect(commissionRow('g-utm')).toContainText(money(45))
  await expect(commissionRow('tmb-qa')).toContainText(money(16))
  await expect(page.locator('.commission-stat').filter({ hasText: 'Comissões estimadas' })).toContainText(money(61))
  await expect(page.getByText(/Comissão estimada, sujeita à conferência de reembolsos/)).toBeVisible()
  await expect(statement()).not.toContainText(/\b(aprovada|paga|pago)\b/i)
  const sellerStatement = await statement().locator('tbody').innerText()
  await switchActor({ id: adminId, name: 'Financeiro QA', email: 'finance@example.test', role: 'financeiro', active: true }, 'finance')
  await visit('/financial', 'Comissões do time')
  await expect(page.getByRole('button', { name: 'Configurar comissões', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Adicionar ajuste', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Vendedor das comissões', exact: true }).selectOption(rebecaId)
  await expect(page.locator('.commission-stat').filter({ hasText: 'Comissões estimadas' })).toContainText(money(61))
  for (const id of ['g-utm', 'tmb-qa']) await expect(commissionRow(id)).toHaveCount(1)
  assert.ok(sellerStatement.includes(money(45)) && sellerStatement.includes(money(16)))
  record('Seller and Finance render the same authoritative commission and cash values without counting old Asaas receipts')

  await page.getByRole('combobox', { name: 'Vendedor das comissões', exact: true }).selectOption('all')
  await expect(commissionRow('zero-qa')).toContainText(money(0))
  await expect(commissionRow('refund-qa')).toContainText('Reembolso em conferência')
  await expect(commissionRow('refund-qa')).toContainText('Pendente')
  await page.getByRole('combobox', { name: 'Status da comissão', exact: true }).selectOption('pending_refund')
  await expect(statement().locator('tbody tr')).toHaveCount(1)
  await page.getByRole('combobox', { name: 'Status da comissão', exact: true }).selectOption('all')
  await page.getByLabel('Competência das comissões', { exact: true }).fill('2026-09')
  await expect(statement()).toContainText('Nenhuma venda atribuída nesta competência')
  await page.getByLabel('Competência das comissões', { exact: true }).fill(month)
  await expect(commissionRow('g-utm')).toBeVisible()
  scenario = 'timezone'
  await visit('/financial', 'Comissões do time')
  await page.getByLabel('Competência das comissões', { exact: true }).fill('2026-09')
  await expect(commissionRow('g-utm')).toContainText('15/09/2026')
  await expect(commissionRow('tmb-qa')).toContainText('15/09/2026')
  scenario = 'calculated'
  await visit('/financial', 'Comissões do time')
  await expect(commissionRow('g-utm')).toContainText('01/10/2026')
  record('Explicit zero cash and refunded sales stay distinct; month and status filters preserve period boundaries')

  scenario = 'unknown-cash'
  await visit('/financial', 'Comissões do time')
  await expect(commissionRow('g-utm')).toContainText('A confirmar')
  await expect(commissionRow('g-utm')).toContainText('Recebimento a confirmar')
  await expect(page.locator('.commission-stat').filter({ hasText: 'Cash collected' })).toContainText(money(800))
  await expect(page.locator('.commission-stat').filter({ hasText: 'Cash collected' })).toContainText('Parcial')
  scenario = 'partial'
  await visit('/financial', 'Comissões do time')
  await expect(page.getByText('Parcial', { exact: true }).first()).toBeVisible()
  await expect(page.getByText(/Algumas fontes ainda estão atualizando/)).toBeVisible()
  scenario = 'partial-calculated'
  await visit('/financial', 'Comissões do time')
  await page.getByRole('combobox', { name: 'Vendedor das comissões', exact: true }).selectOption(rebecaId)
  await expect(page.locator('.commission-stat').filter({ hasText: 'Comissões estimadas' })).toContainText(`Já calculado: ${money(61)}`)
  await expect(page.locator('.commission-stat').filter({ hasText: 'Comissões estimadas' })).toContainText('A confirmar')
  record('Unknown cash and incomplete sources remain explicit instead of appearing as collected money or a complete zero')

  scenario = 'loading'
  await visit('/financial', 'Comissões do time')
  await expect(page.getByText('Carregando valor...', { exact: true })).toHaveCount(3)
  await expect(page.locator('.commission-stat strong')).toHaveCount(0)
  scenario = 'attribution-error'
  await visit('/financial', 'Comissões do time')
  await expect(page.getByText(/A atribuição está temporariamente indisponível/)).toBeVisible()
  record('Loading stays visible inside cards and attribution outages are explicitly identified')

  scenario = 'calculated'
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => localStorage.setItem('workspace-theme', theme), theme)
    for (const width of [1440, 360]) {
      await page.setViewportSize({ width, height: 1000 }); await visit('/financial', 'Comissões do time'); await commissionRow('g-utm').waitFor(); await shot(`financial-${theme}-${width}`)
    }
  }
  await switchActor(emanuel, 'seller')
  await visit('/commissions', 'Minhas comissões'); await shot('seller-dark-360')
  const beforeDenied = calls.length
  await visit('/financial', 'Acesso não liberado')
  assert.deepEqual(calls.slice(beforeDenied).filter(call => call.path !== '/api/access'), [])
  record('Responsive statements fit 360px and desktop in both themes; a seller cannot open Finance or fetch its API')

  scenario = 'error'
  await visit('/commissions', 'Minhas comissões')
  await expect(page.getByRole('alert').filter({ hasText: 'Não foi possível consultar' })).toBeVisible()
  await expect(page.locator('.commission-stat')).toHaveCount(0)
  record('A failed commission request presents a retryable error without fabricating zero-value cards')

  assert.equal(calls.some(call => call.path.endsWith('/commission_reports') && call.method !== 'GET'), false)
  assert.equal(calls.some(call => call.path.endsWith('/financial_notifications') && call.method !== 'GET'), false)
  assert.deepEqual(unexpected, []); assert.deepEqual(errors, [])
  assert.ok([...applicationAssets.values()].every(asset => asset.status === 200))
  assert.ok(blocked.every(item => published && !item.external && item.method === 'GET' && item.resource === 'script' && item.opaqueScript))
  completed = true
  console.log(JSON.stringify({ passed: true, published, assets, checks: checks.length, apiCalls: calls.length, fixtureWrites: writes.length, realWrites: 0, errors, unexpected }))
} catch (error) {
  if (page) { await page.screenshot({ path: `${out}/failure.png`, fullPage: true }).catch(() => {}); await fs.writeFile(`${out}/failure.txt`, `${error.stack}\n\n${await page.locator('body').innerText().catch(() => '')}`) }
  throw error
} finally {
  if (releaseMapping) releaseMapping()
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: completed, published, assets, checks, calls, writes, errors, unexpected, blocked, realApiRequests: 0, realWrites: 0, applicationAssets: [...applicationAssets.values()] }, null, 2))
  if (browser) await browser.close()
  if (server) server.kill('SIGTERM')
}
