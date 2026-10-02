// Read-only local fixtures: unavailable platform net must survive reports and PDF export.
import { chromium } from 'playwright'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const base = process.env.DASHBOARD_SMOKE_URL || 'http://127.0.0.1:4419'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const out = process.env.DASHBOARD_SMOKE_OUTPUT || fileURLToPath(new URL('./artifacts/hub-financial-partial', import.meta.url))
await fs.mkdir(out, { recursive: true })
const profile = { id: 'manager-fixture', name: 'Gestora fixture', email: 'fixture@example.test', role: 'gestor', active: true, is_editor: true }
const seller = { id: 'seller-fixture', name: 'Vendedora fixture', email: 'seller@example.test', role: 'vendedor', active: true, individual_goal: 5000 }
let scenario = 'unknown'
const rows = () => ['2026-09-15', '2026-10-02'].flatMap(date => [
  ...['Guru', 'Hotmart'].map(platform => ({ id: `${date}-${platform}`, date, seller_id: seller.id, product: 'Global', origin: 'Workshop Global', client_name: 'Fixture', platform, amount: 1997, total_sale_value: 2397.24, cash_collected: 1997, dashboard_financial_policy: 'net_after_fees', dashboard_net_known: false, dashboard_gross: null, dashboard_cash_known: false })),
  ...(scenario === 'mixed' ? [{ id: `${date}-TMB`, date, seller_id: seller.id, product: 'Global', origin: 'Workshop Global', client_name: 'Fixture', platform: 'TMB', amount: 1000, total_sale_value: 3000, cash_collected: 1000, commission_value: 30 }] : []),
])
const errors = [], writes = [], external = [], checks = [], mockedBackgroundFunctions = []
const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const browser = await chromium.launch({ headless: true, executablePath: existsSync(chrome) ? chrome : undefined })
const context = await browser.newContext({ locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', reducedMotion: 'reduce', acceptDownloads: true })
await context.addInitScript(() => {
  const encode = value => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  localStorage.setItem('vault_access_token', `${encode({ alg: 'RS256', kid: 'fixture-only' })}.${encode({ sub: 'fixture', exp: 4102444800 })}.fixture-not-valid`)
})
if (context.routeWebSocket) await context.routeWebSocket('**/*', () => {})
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url())
  if (url.origin !== base) { external.push(url.origin); return route.abort() }
  if (!url.pathname.startsWith('/api/')) return route.continue()
  if (request.method() === 'POST' && ['/api/hub/functions/v1/linkedin-ads-sheets', '/api/hub/functions/v1/low-ticket-meta-hubla'].includes(url.pathname)) {
    mockedBackgroundFunctions.push(url.pathname)
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
  }
  if (!['GET', 'HEAD'].includes(request.method())) { writes.push(`${request.method()} ${url.pathname}`); return route.abort() }
  let body = [], count = 0
  if (url.pathname === '/api/access') body = { user: { sub: 'fixture', email: profile.email, name: profile.name, permissions: ['admin'], isAdmin: true } }
  else if (url.pathname === '/api/hub/session') body = { user: profile }
  else if (url.pathname.startsWith('/api/hub/rest/v1/')) {
    const table = url.pathname.split('/').at(-1)
    if (table === 'profiles') body = [profile, seller]
    else if (table === 'sales') {
      body = rows().filter(row => url.searchParams.getAll('date').every(filter => {
        const [op, value] = filter.split('.')
        return op === 'gte' ? row.date >= value : op === 'lte' ? row.date <= value : op === 'lt' ? row.date < value : true
      }))
      count = body.length
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000)
      body = body.slice(offset, offset + limit)
    } else if (table === 'team_settings') body = [{ id: 'settings', team_goal: 10000 }]
    else if (table === 'monthly_goals') body = [{ team_goal: 10000 }]
    else if (table === 'webinar_global_debriefings') body = [{ id: 'webinar-1', webinar_date: '2026-10-02', investment: 100, leads: 10, whatsapp_leads: 5, live_attendees: 4, applications: 2, mqls: 1 }]
    else if (table === 'dre_global') body = null
  }
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': `0-${Math.max(0, count - 1)}/${count}` }, body: JSON.stringify(body) })
})
const page = await context.newPage()
page.setDefaultTimeout(15000)
await page.clock.setFixedTime(new Date('2026-10-02T16:00:00-03:00'))
page.on('pageerror', error => errors.push(error.message))
async function pdf(button, name) {
  const downloadPromise = page.waitForEvent('download')
  await button.click()
  const download = await downloadPromise
  const file = `${out}/${name}.pdf`
  await download.saveAs(file)
  const text = execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' })
  await fs.writeFile(`${out}/${name}.txt`, text)
  assert.match(text, /Financeiro parcial: 2 venda|Dados financeiros parciais: 2 vendas/)
  assert.doesNotMatch(text, /1\.997,00|2\.397,24/)
  if (scenario === 'unknown' || name.startsWith('dre-')) assert.match(text, /Não informado/)
  if (scenario === 'mixed') assert.match(text, /R\$\s*1\.000,00\s*(?:\*|· Parcial)/)
  checks.push(`${name}: PDF includes partial count and unknown, never original gross`)
}
try {
  for (scenario of ['unknown', 'mixed']) {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${base}/results`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: /Setembro 2026/ }).click()
    await page.getByTestId('report-financial-partial').waitFor()
    assert.match(await page.getByTestId('report-financial-partial').innerText(), /2 vendas de Guru\/Hotmart sem líquido informado/)
    const revenue = page.locator('p').getByText('Receita Total', { exact: true }).first().locator('..')
    assert.match(await revenue.innerText(), scenario === 'unknown' ? /Não informado/ : /1\.000,00 · Parcial/)
    assert.doesNotMatch(await page.locator('main').innerText(), /1\.997,00|2\.397,24/)
    await pdf(page.getByRole('button', { name: 'Baixar PDF', exact: true }).first(), `results-${scenario}`)
    await page.screenshot({ path: `${out}/results-${scenario}.png`, fullPage: true })
    checks.push(`Monthly report ${scenario}: count, financial value, detailed periods and exported partial status`)

    await page.goto(`${base}/dre-global`, { waitUntil: 'networkidle' })
    await page.getByTestId('dre-financial-partial').waitFor()
    assert.match(await page.getByTestId('dre-financial-partial').innerText(), /2 vendas/)
    assert.equal(await page.getByLabel('Receita não TMB', { exact: true }).inputValue(), '')
    assert.equal(await page.getByLabel('Receita não TMB', { exact: true }).getAttribute('placeholder'), 'Não informado')
    const sales = page.locator('span').getByText('VENDAS', { exact: true }).locator('..')
    assert.match(await sales.innerText(), scenario === 'unknown' ? /Não informado/ : /1\.000,00 · Parcial/)
    await pdf(page.getByRole('button', { name: 'PDF', exact: true }), `dre-${scenario}`)
    await page.screenshot({ path: `${out}/dre-${scenario}.png`, fullPage: true })
    checks.push(`DRE ${scenario}: unknown suggestion blank, subtotal preserved, cash and PDF marked`)

    await page.goto(`${base}/marketing`, { waitUntil: 'networkidle' })
    await page.getByRole('tab', { name: /Workshop Global|Webinar Global/ }).click()
    await page.getByTestId('webinar-financial-partial').waitFor()
    const finance = page.getByText('Faturamento', { exact: true }).locator('..')
    assert.match(await finance.innerText(), scenario === 'unknown' ? /Não informado/ : /3\.000,00 · Parcial/)
    const roas = page.getByText('ROAS', { exact: true }).locator('..')
    assert.match(await roas.innerText(), scenario === 'unknown' ? /Não informado/ : /30\.00x · Parcial/)
    await page.screenshot({ path: `${out}/webinar-${scenario}.png`, fullPage: true })
    checks.push(`Webinar ${scenario}: revenue and ROAS preserve missing net and other-platform contracts`)
  }
  assert.deepEqual(errors, []); assert.deepEqual(writes, []); assert.deepEqual(external, [])
  await fs.writeFile(`${out}/results.json`, JSON.stringify({ passed: true, checks, errors, writes, external, mockedBackgroundFunctions }, null, 2))
  console.log(JSON.stringify({ passed: true, checks: checks.length, errors, writes, external }))
} finally { await browser.close() }
