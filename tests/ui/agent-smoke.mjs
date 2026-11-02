// Local UI only. A local fixture stands in for the API across origins, as in production,
// and streams synthetic NDJSON a line at a time, which Playwright routes cannot do.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer as createHttpServer } from 'node:http'
import { createServer } from 'node:net'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = fileURLToPath(new URL('./artifacts/agent/', import.meta.url))
const freePort = async () => {
  const socket = createServer()
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve))
  const { port } = socket.address()
  await new Promise(resolve => socket.close(resolve))
  return port
}
const port = await freePort()
const base = `http://127.0.0.1:${port}`
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const errors = [], requests = [], replies = []
let permissions = ['monthly'], closedEarly = 0

const cors = { 'Access-Control-Allow-Origin': base, 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }
const json = (res, status, body) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
const open = res => { res.writeHead(200, { ...cors, 'Content-Type': 'application/x-ndjson; charset=utf-8', 'X-Content-Type-Options': 'nosniff' }); res.flushHeaders() }
const line = (res, event) => res.write(`${JSON.stringify(event)}\n`)
// A reply is the list of what the API does: an event to write, or a pause in milliseconds.
const stream = steps => async (req, res) => {
  open(res)
  for (const step of steps) {
    if (typeof step === 'number') await sleep(step)
    else line(res, step)
  }
  res.end()
}
const api = createHttpServer(async (req, res) => {
  const { pathname } = new URL(req.url, base)
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return }
  if (pathname === '/api/access') return json(res, 200, { user: { sub: 'fixture', name: 'Operador de teste', permissions, isAdmin: false } })
  if (pathname === '/api/agent/messages' && req.method === 'POST') {
    let text = ''
    for await (const chunk of req) text += chunk
    requests.push(JSON.parse(text))
    const reply = replies.shift()
    if (!reply) { errors.push('Unexpected agent request'); return json(res, 500, {}) }
    return reply(req, res)
  }
  errors.push(`Unexpected API path ${req.method} ${pathname}`)
  return json(res, 404, { error: 'not found' })
})
await new Promise(resolve => api.listen(0, '127.0.0.1', resolve))
const env = { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api`, VITE_VAULT_URL: base, VITE_VAULT_CLIENT_ID: 'local-agent-fixture', VITE_VAULT_REDIRECT_URI: `${base}/callback` }
const server = spawn(process.execPath, [fileURLToPath(new URL('../../node_modules/vite/bin/vite.js', import.meta.url)), '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
let output = '', browser
server.stdout.on('data', value => { output = (output + value).slice(-3000) })
server.stderr.on('data', value => { output = (output + value).slice(-3000) })

const metric = (value, partial = false) => ({ value, partial })
const metrics = (revenue, count, overrides = {}) => ({
  count: metric(count), revenue: metric(revenue), gross: metric(revenue), net: metric(833.64, true), received: metric(1933.64), cash: metric(1233.64), fees: metric(66.36, true), affiliate: metric(null), pending: metric(null), listPrice: metric(null),
  ticket: metric(458.41), digital: metric(833.64), digitalCount: metric(3), boleto: metric(1000), boletoCount: metric(1), commercial: metric(0), commercialCount: metric(0), refund: metric(420), refundCount: metric(1), disputeCount: metric(2), cancelledCount: metric(1), dailyRevenue: metric(611.21), dailyCount: metric(1.3), ...overrides,
})
const period = (startDate, endDate, label, overrides = {}) => ({ startDate, endDate, days: 3, label, monthAligned: false, truncatedToToday: false, inProgress: false, ...overrides })
const source = (id, label, status, count, revenue) => ({ id, label, platform: label, kind: 'sale', status, count: metric(count), revenue: metric(revenue) })
const side = (range, values, status, overrides = {}) => ({
  period: range, status, pendingSources: [], staleSources: [], unavailableSources: [], excludedUndated: 0, allocationMissing: false, metrics: values,
  sources: [source('hotmart', 'Hotmart', 'ready', 3, 833.64), source('tmb', 'TMB', status === 'ready' ? 'ready' : 'unavailable', status === 'ready' ? 1 : null, status === 'ready' ? 1000 : null)],
  asaasCash: { value: 1255.36, count: 3, partial: false }, dataSource: { kind: 'shared_history_cache', oldestSnapshotAt: '2026-11-02T07:00:00.000Z', newestSnapshotAt: '2026-11-02T07:00:00.000Z' }, notices: [], ...overrides,
})
const BASIS = { refunds: { guru: 'cancellation_date' }, cash: { tmb: 'tmb_sales_40_percent' } }
const comparison = {
  blockId: 'b1', kind: 'comparison', filters: { platform: null, family: null, payment: null, product: null }, basis: BASIS,
  a: side(period('2026-10-01', '2026-10-03', '01/10/2026 a 03/10/2026'), metrics(1833.64, 4), 'ready'),
  b: side(period('2026-09-01', '2026-09-03', '01/09/2026 a 03/09/2026'), metrics(833.64, 3, { revenue: metric(833.64, true), ticket: metric(null), net: metric(null) }), 'partial'),
  deltas: { revenue: { absolute: null, percent: null, reason: 'partial' }, count: { absolute: 1, percent: 33.33, reason: null }, ticket: { absolute: null, percent: null, reason: 'unavailable' }, gross: { absolute: 1000, percent: null, reason: 'zero-base' }, net: { absolute: null, percent: null, reason: 'unavailable' }, received: { absolute: 0, percent: 0, reason: null } },
  groups: { dimension: 'platform', truncated: false, rows: [
    { name: 'TMB', a: { count: metric(1), revenue: metric(1000) }, b: { count: metric(null), revenue: metric(null) }, revenueDelta: { absolute: null, percent: null, reason: 'unavailable' }, countDelta: { absolute: null, percent: null, reason: 'unavailable' } },
    { name: 'Hotmart', a: { count: metric(3), revenue: metric(833.64) }, b: { count: metric(3), revenue: metric(833.64, true) }, revenueDelta: { absolute: null, percent: null, reason: 'partial' }, countDelta: { absolute: 0, percent: 0, reason: null } },
  ] },
  series: { kind: 'daily', omittedA: 2, omittedB: 0, rows: [
    { label: 'Dia 1', aDate: '2026-10-01', bDate: '2026-09-01', aRevenue: 800, bRevenue: 300, aCount: 2, bCount: 1 },
    { label: 'Dia 2', aDate: '2026-10-02', bDate: '2026-09-02', aRevenue: 0, bRevenue: null, aCount: 0, bCount: null },
    { label: 'Dia 3', aDate: '2026-10-03', bDate: '2026-09-03', aRevenue: 1033.64, bRevenue: 533.64, aCount: 2, bCount: 2 },
  ] },
  notices: [
    { id: 'stale-cache', title: 'Fonte com falha', tone: 'warning', message: 'TMB não respondeu.', side: 'b' },
    { id: 'tmb-cash-rule', title: 'TMB entra com 40%', tone: 'info', message: 'Recebimentos da TMB usam 40% do valor da venda.' },
  ],
}
const summary = {
  blockId: 'b1', kind: 'summary', ...side(period('2026-10-15', '2026-10-15', '15/10/2026', { days: 1 }), metrics(277.88, 1, { ticket: metric(277.88), received: metric(277.88) }), 'ready'),
  filters: { platform: 'Hotmart', family: null, payment: null, product: null }, basis: BASIS, asaasCash: null,
  groups: { dimension: 'payment', truncated: false, rows: [{ name: 'Cartão', count: metric(1), revenue: metric(277.88) }] },
  series: { kind: 'hourly', omitted: 0, rows: Array.from({ length: 24 }, (_, hour) => ({ label: `${String(hour).padStart(2, '0')}h`, date: null, revenue: hour === 12 ? 277.88 : 0, count: hour === 12 ? 1 : 0 })) },
}
const startCall = { type: 'tool_start', callId: 'c1', name: 'compare_periods', label: 'Consultando 01/10/2026 a 03/10/2026 e 01/09/2026 a 03/09/2026' }
const meta = { type: 'meta', model: 'fixture', limits: { maxToolCalls: 6 } }
const done = (overrides = {}) => ({ type: 'done', stopReason: 'end_turn', truncated: false, pending: false, unverifiedNumbers: [], usage: { input: 1, cached: 0, output: 1 }, ...overrides })
const text = delta => ({ type: 'text', delta })
const failure = (status, code, error) => async (req, res) => json(res, status, { error, code })
// Holds the response open until the browser gives up on it.
const hold = steps => async (req, res) => {
  open(res)
  for (const step of steps) line(res, step)
  await new Promise(resolve => res.on('close', () => { closedEarly += 1; resolve() }))
}

try {
  let ready = false
  for (let i = 0; i < 100; i++) { try { ready = (await fetch(base)).ok } catch { /* local Vite startup */ } if (ready) break; if (server.exitCode !== null) throw new Error(output); await sleep(100) }
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
  const apiOrigin = new URL(env.VITE_API_URL).origin
  await context.route('**/*', async route => {
    const { origin } = new URL(route.request().url())
    if (origin === base || origin === apiOrigin) return route.continue()
    errors.push('Unexpected external request')
    return route.abort()
  })
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) errors.push(message.text()) })
  const composer = page.getByRole('textbox', { name: 'Pergunta para o agente' })
  const log = page.getByRole('log', { name: 'Conversa com o agente' })
  const stop = page.getByRole('button', { name: 'Parar' })
  const ask = async question => { await composer.fill(question); await composer.press('Enter') }
  const newConversation = () => page.getByRole('button', { name: 'Nova conversa' }).click()
  // An Enter right after Parar is still the one aimed at it; a person takes longer to ask again.
  const stopAnswer = async () => { await stop.click(); await page.waitForTimeout(550) }

  await page.goto(`${base}/agente`, { waitUntil: 'networkidle' })
  await expect(page.getByRole('link', { name: 'Agente' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'O que você quer comparar?' })).toBeVisible()
  await expect(page.getByText('A conversa não é salva.', { exact: false })).toBeVisible()
  assert.equal(requests.length, 0, 'Opening the page asks nothing')

  // An example, with the response held long enough to see the progress.
  replies.push(stream([meta, 300, startCall, { type: 'status', callId: 'c1', text: 'Aguardando 3 de 18 consultas às plataformas: Guru, TMB.' }, 600, { type: 'block', block: comparison }, 100, text('O bloco 1 mostra alta. '), text('O período B está parcial.'), done({ unverifiedNumbers: ['R$ 999,99'] })]))
  await page.getByRole('button', { name: 'Compare novembro de 2025 com novembro de 2026' }).click()
  await expect(page.getByText('Aguardando 3 de 18 consultas às plataformas: Guru, TMB.')).toBeVisible()
  await expect(stop).toBeVisible()
  await expect(log.getByText('Compare novembro de 2025 com novembro de 2026')).toBeInViewport()
  await expect(log.locator('.agent-turn')).toHaveAttribute('aria-busy', 'true')
  assert.deepEqual(requests[0], { message: 'Compare novembro de 2025 com novembro de 2026', history: [] })
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  await expect(log.locator('.agent-turn')).toHaveAttribute('aria-busy', 'false')
  await expect(stop).toHaveCount(0)
  await expect(page.getByText('Bloco 1 · Calculado pelo servidor')).toBeVisible()
  await expect(page.getByText('Leitura do agente')).toBeVisible()
  await expect(page.getByText('O bloco 1 mostra alta. O período B está parcial.')).toBeVisible()
  await expect(page.getByRole('note')).toContainText('Este número não consta nos dados calculados: R$ 999,99')
  const revenue = await page.getByRole('row', { name: /^Receita operacional/ }).innerText()
  assert.match(revenue, /Parcial/)
  assert.match(revenue, /Dados parciais/)
  assert.doesNotMatch(revenue, /R\$\s0,00/, 'A partial side is not a zero')
  const net = await page.getByRole('row', { name: /^Líquido informado/ }).innerText()
  assert.match(net, /—/)
  assert.match(net, /Sem dados comparáveis/)
  assert.match(await page.getByRole('row', { name: /^Valor das vendas/ }).innerText(), /Base B igual a zero/)
  assert.match(await page.getByRole('row', { name: /^Vendas/ }).first().innerText(), /\+1[\s\S]*\+33,3%/)
  await expect(page.getByRole('button', { name: /A · 01\/10\/2026 a 03\/10\/2026/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /B · 01\/09\/2026 a 03\/09\/2026/ }).first()).toBeVisible()
  await expect(page.getByText('Fora deste gráfico por falta de data individual: 2 em A e 0 em B.', { exact: false })).toBeVisible()
  await expect(page.getByText('Lacunas não são substituídas por zero.', { exact: false })).toBeVisible()
  await expect(page.getByText('Período B: TMB não respondeu.', { exact: false })).toBeVisible()
  assert.match(await page.getByRole('row', { name: /^Cash collected/ }).innerText(), /R\$\s1\.233,64/)
  assert.match(await page.getByRole('row', { name: /^Recebimentos das vendas/ }).innerText(), /R\$\s1\.933,64/)
  await expect(page.getByRole('row', { name: /^Contestações/ })).toBeHidden()
  await page.getByText('Composição financeira e outros indicadores').click()
  await expect(page.getByRole('row', { name: /^Contestações/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /^Reembolsos confirmados/ })).toBeVisible()
  await page.getByText('Composição financeira e outros indicadores').click()
  await expect(page.getByText('Recebimentos do Asaas no extrato', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('row', { name: /^TMB/ }).first()).toContainText('Sem dados comparáveis')
  const gap = await page.locator('.rr-chart').first().evaluate(node => node.querySelectorAll('path').length)
  assert.ok(gap > 0, 'The chart was drawn')

  for (const [theme, width] of [['light', 1440], ['dark', 1440], ['light', 360], ['dark', 360]]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value === 'dark'), theme)
    await page.waitForTimeout(150)
    await page.screenshot({ path: `${out}/${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    assert.ok(documentWidth <= width, `No horizontal overflow ${theme} ${width}: ${documentWidth}`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.evaluate(() => document.documentElement.classList.remove('dark'))

  // A follow-up carries the earlier turn as text, with the periods it consulted.
  replies.push(stream([meta, { type: 'tool_start', callId: 'c1', name: 'period_summary', label: 'Consultando 15/10/2026' }, { type: 'block', block: summary }, text('Uma venda.'), done()]))
  await composer.fill('e a Hotmart em 15/10?')
  await composer.press('Shift+Enter')
  assert.equal(requests.length, 1, 'Shift + Enter only breaks the line')
  await expect(composer).toHaveValue('e a Hotmart em 15/10?\n')
  await composer.press('Enter')
  await expect(page.getByText('Uma venda.')).toBeVisible()
  await expect(composer).toHaveValue('')
  assert.deepEqual(requests[1].history, [
    { role: 'user', text: 'Compare novembro de 2025 com novembro de 2026' },
    { role: 'assistant', text: `O bloco 1 mostra alta. O período B está parcial.\n\n[Consultas feitas: ${startCall.label}]` },
  ])
  assert.equal(JSON.stringify(requests[1]).includes('metrics'), false, 'Blocks stay on the screen')
  await expect(page.getByText('Plataforma: Hotmart')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Receita ao longo do dia' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Distribuição por pagamento' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Distribuição de 1 vendas/ })).toBeVisible()
  await expect(log.locator('.agent-user')).toHaveCount(2)

  // Stopping closes the request and keeps what arrived; the turn stays out of the history.
  replies.push(hold([meta, startCall, { type: 'block', block: comparison }, text('Parcial até aqui.')]))
  await ask('uma pergunta que será parada')
  await expect(page.getByText('Parcial até aqui.')).toBeVisible()
  await stopAnswer()
  await expect(log.getByText('Interrompido. O que já chegou foi mantido.')).toBeVisible()
  await expect.poll(() => closedEarly).toBe(1)
  replies.push(hold([meta]))
  await ask('outra, parada com Escape')
  await expect(stop).toBeVisible()
  await composer.press('Escape')
  await expect(log.getByText('Interrompido. O que já chegou foi mantido.')).toHaveCount(2)
  await expect.poll(() => closedEarly).toBe(2)

  // Stopping with a draft keeps the draft: it must not become the next question.
  replies.push(hold([meta, text('Em andamento.')]))
  const beforeDraft = requests.length
  await ask('pergunta em andamento')
  await expect(log.getByText('Em andamento.')).toBeVisible()
  await composer.fill('rascunho da próxima')
  await stopAnswer()
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  await expect(composer).toHaveValue('rascunho da próxima')
  await expect(composer).toBeFocused()
  await page.waitForTimeout(150)
  assert.equal(requests.length, beforeDraft + 1, 'Only the first question was sent')
  await expect.poll(() => closedEarly).toBe(3)
  replies.push(hold([meta]))
  await composer.press('Enter')
  await expect(stop).toBeVisible()
  await composer.fill('outro rascunho')
  await stop.focus()
  // A held key repeats after the stop has moved focus to the composer.
  await page.keyboard.down('Enter')
  await page.waitForTimeout(120)
  await page.keyboard.down('Enter')
  await page.keyboard.up('Enter')
  await expect(page.getByRole('button', { name: 'Enviar' })).toBeVisible()
  await expect(composer).toHaveValue('outro rascunho')
  await expect(composer).toBeFocused()
  await expect.poll(() => closedEarly).toBe(4)
  await page.waitForTimeout(150)
  assert.equal(requests.length, beforeDraft + 2, 'Keyboard stop does not send it either')

  // A double click on Enviar is one question: its second click does not cancel it, and typing goes on in the composer.
  await page.waitForTimeout(550)
  replies.push(stream([meta, 700, text('Sobreviveu ao clique duplo.'), done()]))
  await composer.fill('clique duplo')
  await page.getByRole('button', { name: 'Enviar' }).dblclick()
  await expect(stop).toBeVisible()
  await page.keyboard.type('e a hotmart')
  await expect(composer).toHaveValue('e a hotmart')
  await expect(log.getByText('Sobreviveu ao clique duplo.')).toBeVisible()
  assert.equal(requests.at(-1).message, 'clique duplo')
  assert.equal(requests.length, beforeDraft + 3)
  await expect(log.getByText('Interrompido. O que já chegou foi mantido.')).toHaveCount(4)

  // A click meant for Parar that lands right after the answer ended does not send the draft.
  await composer.fill('rascunho pela metade')
  await page.waitForTimeout(550)
  replies.push(stream([meta, 300, text('Terminou sozinha.'), done()]))
  await composer.press('Enter')
  await expect(stop).toBeVisible()
  await composer.fill('rascunho pela metade')
  const box = await stop.boundingBox()
  await expect(log.getByText('Terminou sozinha.')).toBeVisible()
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(composer).toHaveValue('rascunho pela metade')
  assert.equal(requests.length, beforeDraft + 4, 'Only the answered question was sent')
  await page.waitForTimeout(550)

  // A keyboard user on Parar when the answer ends stays in the composer, not on the page body.
  replies.push(stream([meta, 400, text('Fim com foco em Parar.'), done()]))
  await composer.fill('')
  await composer.fill('foco no parar')
  await composer.press('Enter')
  await expect(stop).toBeVisible()
  await composer.fill('rascunho guardado')
  await stop.focus()
  const scrolledBefore = await page.evaluate(() => window.scrollY)
  await expect(log.getByText('Fim com foco em Parar.')).toBeVisible()
  // Enter aimed at Parar a moment after the answer ended does not send the draft.
  await page.keyboard.press('Enter')
  await expect(composer).toBeFocused()
  await expect(composer).toHaveValue('rascunho guardado')
  assert.equal(await page.evaluate(() => window.scrollY), scrolledBefore, 'Focusing the dock does not move what is being read')
  await page.waitForTimeout(550)
  const answered = requests.length
  await composer.fill('')
  // A press on the disabled Enviar leaves the composer ready for typing.
  await page.getByRole('button', { name: 'Enviar' }).click({ force: true })
  await expect(composer).toBeFocused()
  assert.equal(requests.length, answered, 'An empty composer sends nothing')

  // Escape meant for a chart stays with the chart; in the composer it stops the answer.
  replies.push(hold([meta, text('Ainda respondendo.')]))
  await ask('escape no gráfico')
  await expect(log.getByText('Ainda respondendo.')).toBeVisible()
  await page.locator('.rr-chart-plot').first().focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await expect(stop).toBeVisible()
  assert.equal(closedEarly, 4, 'The answer goes on')
  await page.locator('.agent-block summary').first().focus()
  await page.keyboard.press('Escape')
  await expect.poll(() => closedEarly).toBe(5)
  await expect(composer).not.toBeDisabled()

  // An unavailable agent offers a retry, and the retry sends the same question.
  replies.push(failure(503, 'AGENT_UNAVAILABLE', 'O agente não está configurado neste ambiente.'))
  await ask('pergunta quando indisponível')
  const unavailable = page.getByRole('alert').filter({ hasText: 'O agente não está configurado neste ambiente.' })
  await expect(unavailable).toBeVisible()
  assert.equal(requests.at(-1).history.some(item => /será parada|Escape/.test(item.text)), false, 'Stopped turns are not history')
  replies.push(stream([meta, text('Voltou.'), done()]))
  await unavailable.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(page.getByText('Voltou.')).toBeVisible()
  assert.equal(requests.at(-1).message, 'pergunta quando indisponível')
  assert.equal(requests.at(-1).history.some(item => item.text === 'pergunta quando indisponível'), false, 'The failed attempt is not history')

  replies.push(failure(429, 'AGENT_RATE_LIMITED', 'Muitas perguntas em sequência. Aguarde alguns segundos e tente novamente.'))
  await ask('muitas perguntas')
  await expect(page.getByRole('alert').filter({ hasText: 'Muitas perguntas em sequência.' })).toBeVisible()
  replies.push(failure(429, 'AGENT_BUDGET_EXCEEDED', 'O limite diário de uso do agente foi atingido. Ele volta amanhã.'))
  await ask('sem orçamento')
  const budget = page.getByRole('alert').filter({ hasText: 'O limite diário' })
  await expect(budget).toBeVisible()
  await expect(budget.getByRole('button')).toHaveCount(0)

  // A cut connection and a mid-stream error both keep what already arrived.
  replies.push(async (req, res) => { open(res); line(res, meta); line(res, { type: 'block', block: { ...summary, blockId: 'b1' } }); await sleep(100); res.destroy() })
  await ask('a conexão cai')
  await expect(page.getByRole('alert').filter({ hasText: 'A conexão caiu antes do fim da resposta.' })).toBeVisible()
  replies.push(stream([meta, text('Vou tentar. '), { type: 'error', code: 'AGENT_REFUSED', error: 'O agente não pôde responder a este pedido.' }]))
  await ask('erro no meio')
  await expect(page.getByText('Vou tentar.')).toBeVisible()
  const refused = page.getByRole('alert').filter({ hasText: 'O agente não pôde responder a este pedido.' })
  await expect(refused).toBeVisible()
  await expect(refused.getByRole('button')).toHaveCount(0)

  // A broken line ends the reading, and the request closes so the server stops spending.
  replies.push(async (req, res) => {
    open(res); line(res, meta); res.write('{"type":"te\n')
    await new Promise(resolve => res.on('close', () => { closedEarly += 1; resolve() }))
  })
  await ask('uma linha quebrada')
  await expect(page.getByRole('alert').filter({ hasText: 'A conexão caiu antes do fim da resposta.' })).toHaveCount(2)
  await expect.poll(() => closedEarly).toBe(6)

  // While an answer is running, an older failure cannot start a second one.
  replies.push(hold([meta]))
  await ask('outra com a falha ainda na tela')
  await expect(stop).toBeVisible()
  await expect(page.getByRole('button', { name: 'Tentar de novo' }).first()).toBeDisabled()
  await stopAnswer()
  await expect.poll(() => closedEarly).toBe(7)
  await expect(page.getByRole('button', { name: 'Tentar de novo' }).first()).toBeEnabled()

  // A cold history is said plainly, with a way to ask again.
  replies.push(stream([meta, { type: 'block', block: { ...comparison, a: { ...comparison.a, status: 'pending', metrics: metrics(null, null) } } }, done({ pending: true })]))
  await ask('um mês frio')
  await expect(page.getByText('Histórico ainda carregando no servidor.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Perguntar de novo' })).toBeVisible()
  const cold = page.locator('.agent-period').filter({ hasText: 'Ainda em coleta' })
  await expect(cold).toHaveCount(1)
  await expect(cold.getByText('Indisponível', { exact: true })).toHaveCount(2)
  assert.doesNotMatch(await cold.innerText(), /R\$\s0,00/, 'A cold period is not a zero')
  // No rows on a cold side reads as unknown, not as no sales.
  replies.push(stream([meta, { type: 'block', block: { ...comparison, a: { ...comparison.a, status: 'pending', metrics: metrics(null, null) }, groups: { dimension: 'product', truncated: false, rows: [] } } }, done({ pending: true })]))
  await ask('um mês frio sem linhas')
  await expect(page.getByText('Distribuição indisponível até as fontes responderem.')).toBeVisible()
  // A share over the sources that answered is not drawn; a period still running says so.
  const running = { ...summary, ...side(period('2026-11-01', '2026-11-02', '01/11/2026 a 02/11/2026', { days: 2, inProgress: true }), metrics(277.88, 1, { revenue: metric(277.88, true) }), 'partial'), asaasCash: null, allocationMissing: true,
    groups: { dimension: 'payment', truncated: false, rows: [{ name: 'Cartão', count: metric(1, true), revenue: metric(277.88, true) }] } }
  replies.push(stream([meta, { type: 'block', block: running }, done()]))
  await ask('um mix parcial')
  await expect(page.getByText('até hoje, em andamento', { exact: false })).toBeVisible()
  await expect(page.getByText('Distribuição parcial:', { exact: false })).toBeVisible()
  const lastBlock = page.locator('.agent-block').last()
  await expect(lastBlock.locator('.analytics-mix')).toHaveCount(0)
  assert.doesNotMatch(await lastBlock.locator('.agent-foot').innerText(), /permanecem nos totais/, 'That block left a balance out')

  // A tool refusal is shown once, and an unknown block does not break the page.
  replies.push(stream([meta, { type: 'tool_error', callId: 'c1', message: 'Escolha períodos com a mesma duração.' }, { type: 'block', block: { blockId: 'b1', kind: 'chart3d' } }, text('Alinhei.'), done()]))
  await ask('períodos diferentes')
  await expect(page.getByText('Consulta recusada: Escolha períodos com a mesma duração.')).toBeVisible()
  await expect(page.getByText('Este resultado não pôde ser exibido.', { exact: false })).toBeVisible()

  // A long unbroken text never widens the page, and a headline value never breaks across lines.
  const narrow = { ...summary, ...side(period('2026-10-01', '2026-10-31', '01/10/2026 a 31/10/2026', { days: 31 }), metrics(1234567.89, 1, { ticket: metric(1234567.89), cash: metric(1234567.89) }), 'ready'), asaasCash: null,
    filters: { platform: null, family: null, payment: null, product: 'Formacao_FullStack_Com_IA_Turma_2026_Black_Friday_'.repeat(2) } }
  const longNames = { ...narrow, notices: [{ id: 'product-matched', title: 'Filtro somou mais de um produto', tone: 'warning', message: '2 produtos: ' + 'Formacao_FullStack_'.repeat(4) + '; ' + 'Formacao_DevClub__'.repeat(4) + '.' }] }
  replies.push(stream([meta, { type: 'tool_error', callId: 'c1', message: 'Período não reconhecido: ' + 'x'.repeat(110) + '.' }, { type: 'block', block: longNames }, done()]))
  await ask('um produto com nome enorme')
  await page.setViewportSize({ width: 360, height: 800 })
  await page.waitForTimeout(150)
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  assert.ok(documentWidth <= 360, `A long token does not widen the page: ${documentWidth}`)
  const broken = await page.locator('.agent-block').last().locator('.agent-stats .financial-value-content').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length > 1).map(node => node.textContent))
  assert.deepEqual(broken, [], 'No value breaks in the middle of its digits')
  await page.setViewportSize({ width: 1440, height: 1000 })

  // Keyboard focus never lands hidden under the sticky composer, even with the composer stretched.
  for (const [width, height, composerHeight] of [[1440, 900, 0], [1280, 720, 0], [360, 800, 0], [1280, 720, 220]]) {
    await page.setViewportSize({ width, height })
    await composer.evaluate((node, value) => { node.style.height = value ? `${value}px` : '' }, composerHeight)
    await page.waitForTimeout(60)
    await page.locator('.agent-user').first().scrollIntoViewIfNeeded()
    await page.locator('.agent-block').first().locator('summary').first().focus()
    for (let step = 0; step < 14; step++) {
      await page.keyboard.press('Tab')
      await page.waitForTimeout(30)
      const hidden = await page.evaluate(() => {
        const node = document.activeElement
        if (!node?.closest('.agent-block')) return null
        const box = node.getBoundingClientRect(), dock = document.querySelector('.agent-dock').getBoundingClientRect()
        return box.bottom > dock.top && box.top >= dock.top ? node.textContent.slice(0, 60) || node.tagName : null
      })
      assert.equal(hidden, null, `Focus hidden under the composer at ${width}x${height}`)
    }
  }
  await composer.evaluate(node => { node.style.height = '' })
  await page.setViewportSize({ width: 1440, height: 1000 })

  // Starting over discards the conversation.
  await newConversation()
  await expect(page.getByRole('heading', { name: 'O que você quer comparar?' })).toBeVisible()
  await expect(composer).toBeFocused()
  replies.push(stream([meta, text('Do zero.'), done()]))
  await ask('nova pergunta')
  await expect(page.getByText('Do zero.')).toBeVisible()
  assert.deepEqual(requests.at(-1), { message: 'nova pergunta', history: [] })

  // Without a financial screen there is no menu item, no page and no request.
  const before = requests.length
  permissions = ['materials']
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { name: 'Acesso não liberado' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Agente' })).toHaveCount(0)
  assert.equal(requests.length, before)

  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ agentSmoke: 'ok', requests: requests.length, screenshots: out }))
} finally { await browser?.close(); server.kill('SIGTERM'); api.closeAllConnections(); api.close() }
