// Local UI only. All APIs and external requests are intercepted with synthetic aggregates.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = fileURLToPath(new URL('./artifacts/buyer-intelligence/', import.meta.url))
const socket = createServer()
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
const port = socket.address().port
await new Promise(resolve => socket.close(resolve))
const base = `http://127.0.0.1:${port}`
const env = { ...process.env, VITE_API_URL: `${base}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-buyer-fixture', VITE_VAULT_REDIRECT_URI: `${base}/callback`, VITE_ORACULO_URL: 'https://oraculo.example.test' }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = '', browser, scenario = 'normal', permission = true
const errors = [], calls = [], checks = []
server.stdout.on('data', value => { output = (output + value).slice(-3000) })
server.stderr.on('data', value => { output = (output + value).slice(-3000) })
const payload = { profiles: 4, totalProfiles: 6, buyerProfiles: 4, linkedPurchases: 6, approvedPurchases: 8, approvedLinkedPurchases: 6, reviewPending: 1, unlinkedPurchases: 4, revokedPurchases: 0, repeatBuyerProfiles: 2, crossProviderProfiles: 1, approvedWithPriorParticipation: 3, approvedWithPriorUtm: 2, coverage: { totalPurchases: 10, linkedPct: 60, withLeadProfiles: 3 }, denominators: { launchDistribution: 6, priorSourceDistribution: 3, repeatBuyerProfiles: 4 }, launchCountBeforePurchaseDistribution: [{ launches: '0', purchases: 3 }, { launches: '1', purchases: 2 }, { launches: '2', purchases: 1 }], priorSourceDistribution: [{ source: 'meta', purchases: 2 }, { source: '(sem utm_source)', purchases: 1 }], lastImport: { status: 'COMPLETED', completedAt: '2026-10-23T20:00:00Z' }, notice: 'Perfis provisórios agrupam contatos por evidências de identidade. UTMs são inscrições observadas, não atribuição comprovada.' }
Object.assign(payload, {
  approvedWithPriorHistoricalInteraction: 4, approvedWithPriorHistoricalSurvey: 3,
  approvedWithPriorHistoricalUtm: 2, approvedWithPriorHistoricalCampaignMembership: 5,
  historicalCoverage: { scope: 'all_imported_history', records: 30, linked: 20, undated: 8, surveys: 10, engagements: 5,
    sources: [{ source: 'leads-data-pesquisas-historicas-2024-2026', records: 30, linked: 20, undated: 8 }] },
  lastHistoricalImport: { status: 'COMPLETED', completedAt: '2026-10-24T12:00:00Z' },
  productCatalog: { scope: 'formation', ruleVersion: 'formation-catalog-2026-10-24.1', approvedMapped: 5 },
  productDistribution: [
    { code: 'devclub_fullstack', name: 'Formação DevClub FullStack', classification: 'MAPPED', purchases: 5, profiles: 3 },
    { code: null, name: null, classification: 'REVIEW_REQUIRED', purchases: 2, profiles: 2 },
    { code: null, name: null, classification: 'UNMAPPED', purchases: 1, profiles: 0 },
  ],
})
try {
  let ready = false
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(base)).ok } catch { /* local Vite startup */ } if (ready) break; if (server.exitCode !== null) throw new Error(output); await new Promise(resolve => setTimeout(resolve, 100)) }
  assert.ok(ready, output)
  await fs.mkdir(out, { recursive: true })
  const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined })
  const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } })
  await context.addInitScript(() => {
    const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256' })}.${encode({ sub: 'fixture', token_use: 'access', exp: 4102444800 })}.fixture`)
  })
  if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
  await context.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url())
    if (url.origin !== base) { errors.push('Unexpected external request'); await route.abort(); return }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    assert.equal(req.method(), 'GET')
    assert.equal(req.headers()['x-oraculo-buyers-token'], undefined)
    let body, status = 200
    if (url.pathname === '/api/access') body = { user: { sub: 'fixture', name: 'Operador de teste', permissions: permission ? ['attribution'] : ['today'], isAdmin: false } }
    else if (url.pathname === '/api/buyer-intelligence/overview') {
      assert.equal(permission, true)
      calls.push(Object.fromEntries(url.searchParams))
      if (scenario === 'error') { status = 503; body = { error: 'Consulta temporariamente indisponível.', code: 'BUYER_INTELLIGENCE_UNAVAILABLE' } }
      else {
        body = structuredClone(payload)
        body.period = { dateFrom: url.searchParams.get('dateFrom'), dateTo: url.searchParams.get('dateTo'), timezone: 'America/Sao_Paulo' }
        if (scenario === 'empty') {
          for (const key of Object.keys(body)) if (typeof body[key] === 'number') body[key] = 0
          body.coverage = { totalPurchases: 0, linkedPct: 0, withLeadProfiles: 0 }
          body.denominators = { launchDistribution: 0, priorSourceDistribution: 0, repeatBuyerProfiles: 0 }
          body.launchCountBeforePurchaseDistribution = []; body.priorSourceDistribution = []
          body.productDistribution = []; body.productCatalog.approvedMapped = 0
        }
        if (scenario === 'legacy') for (const key of ['historicalCoverage', 'lastHistoricalImport', 'productCatalog', 'productDistribution', 'approvedWithPriorHistoricalInteraction', 'approvedWithPriorHistoricalSurvey', 'approvedWithPriorHistoricalUtm', 'approvedWithPriorHistoricalCampaignMembership']) delete body[key]
      }
    } else { errors.push(`Unexpected API path ${url.pathname}`); await route.abort(); return }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`${base}/compradores?dateFrom=2024-01-01&dateTo=2026-10-23`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Inteligência de compradores', exact: true })).toBeVisible()
  await expect(page.getByText('6 de 10 pedidos ligados a um perfil')).toBeVisible()
  await expect(page.getByText('Base de comparação: 3 pedidos.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Histórico recuperado', exact: true })).toBeVisible()
  await expect(page.getByText('20 vinculados a perfis ativos', { exact: false })).toBeVisible()
  await expect(page.getByText('5 de 8 pedidos aprovados com produto identificado no período.')).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Formação DevClub FullStack' })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Produto em revisão', exact: false })).toBeVisible()
  await expect(page.getByRole('rowheader', { name: 'Produto não mapeado', exact: false })).toBeVisible()
  await expect(page.getByText('3 de 6 pedidos aprovados com perfil têm inscrição anterior registrada.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Abrir fichas no Oráculo' })).toHaveAttribute('href', 'https://oraculo.example.test/compradores')
  for (const [theme, width] of [['light', 1440], ['dark', 1440], ['light', 360], ['dark', 360]]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    await page.screenshot({ path: `${out}/${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    const overflow = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth, elements: [...document.querySelectorAll('#workspace-main *')].map(element => ({ tag: element.tagName, class: element.className, right: element.getBoundingClientRect().right, width: element.getBoundingClientRect().width })).filter(element => element.right > innerWidth + 1).slice(0, 12) }))
    assert.equal(overflow.documentWidth <= width, true, `No horizontal overflow ${theme} ${width}: ${JSON.stringify(overflow)}`)
  }
  checks.push('aggregate denominators, public profile link, 360/1440px light and dark')
  checks.push('global historical coverage, dated signals and product mappings remain separate from operational signups')
  await page.getByLabel('De', { exact: true }).fill('2025-01-01')
  await page.getByLabel('Até', { exact: true }).fill('2025-12-31')
  await page.getByRole('button', { name: 'Aplicar período' }).click()
  await expect(page.getByText('Pedidos de 01/01/2025 a 31/12/2025.', { exact: false })).toBeVisible()
  assert.deepEqual(calls.at(-1), { dateFrom: '2025-01-01', dateTo: '2025-12-31' })
  await expect(page.getByText('20 vinculados a perfis ativos', { exact: false })).toBeVisible()
  checks.push('period changes forwarded to one authoritative overview')
  scenario = 'legacy'; await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await expect(page.getByText('A cobertura histórica ainda não está disponível nesta consulta.')).toBeVisible()
  await expect(page.getByText('O catálogo de produtos ainda não está disponível nesta consulta.')).toBeVisible()
  await expect(page.getByText('3 de 6 pedidos aprovados com perfil têm inscrição anterior registrada.')).toBeVisible()
  checks.push('rolling release with older upstream keeps signups and marks new metrics unavailable')
  scenario = 'error'; await page.getByRole('button', { name: 'Atualizar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Consulta indisponível' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Quanto da base já está conectado?' })).toHaveCount(0)
  scenario = 'empty'; await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByText('Nenhum pedido observado neste período.', { exact: false })).toBeVisible()
  await expect(page.getByText('Nenhum pedido aprovado neste período para distribuir por produto.')).toBeVisible()
  await expect(page.getByText('20 vinculados a perfis ativos', { exact: false })).toBeVisible()
  await expect(page.getByText('0%')).toHaveCount(0)
  checks.push('outage is not zero; empty denominator remains unavailable')
  const previousCalls = calls.length
  permission = false; await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Acesso não liberado' })).toBeVisible()
  assert.equal(calls.length, previousCalls)
  checks.push('screen permission prevents overview requests')
  assert.deepEqual(errors, [])
  await fs.writeFile(`${out}/checks.json`, JSON.stringify({ checks, requests: calls.length, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ checks, requests: calls.length, screenshots: out }, null, 2))
} finally { await browser?.close(); server.kill('SIGTERM') }
