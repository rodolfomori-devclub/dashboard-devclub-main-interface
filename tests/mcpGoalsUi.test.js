import { test, before, beforeEach, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { defaultTvSettings } from '../src/components/tv/tvConfig.js'

const project = fileURLToPath(new URL('../', import.meta.url))
const proposalId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const auth = { currentUser: { uid: 'admin-1' }, userRoles: { isAdmin: true }, hasPermission: () => true, reload() {} }
const basePlan = { id: 'plan-1', scope: 'product', scopeId: 'MBA', scopeName: 'MBA', product: 'MBA', metric: 'gross', target: 100, superTarget: 200, ultraTarget: 300, paceBasis: 'calendar', notes: '', revision: 7 }
let runtime, directory, dom, root, enabled, writesEnabled, proposal, requests, conflict, disconnectFailure, monthlyRevision, goalPlans, goalReadFailure, periodSales, connectionScopes

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://dashboard.test/metas', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'localStorage', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver']) globalThis[name] = dom.window[name]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__mcpAuth = auth
  globalThis.__mcpRequest = async (path, options = {}) => {
    requests.push({ path, options })
    if (options.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    if (path === '/mcp/status') return { enabled, writesEnabled }
    if (path === '/mcp/connections') return { connections: [{ id: 'connection-1', clientName: 'Claude', clientId: 'https://claude.ai/oauth/mcp-oauth-client-metadata', scopes: connectionScopes, expiresAt: new Date(Date.now() + 86400000).toISOString(), createdAt: new Date().toISOString(), revokedAt: null }] }
    if (path === '/mcp/connections/connection-1') {
      if (disconnectFailure) throw new Error('Conexão indisponível. Tente novamente.')
      return { revoked: true }
    }
    if (path.startsWith('/mcp/history?')) return { history: ['approved', 'undone'].includes(proposal.status) ? [structuredClone(proposal)] : [] }
    if (path.startsWith('/mcp/proposals?')) return { proposals: proposal.status === 'pending' ? [structuredClone(proposal)] : [] }
    if (path === `/mcp/proposals/${proposalId}`) return { proposal: structuredClone(proposal) }
    if (path.startsWith(`/mcp/proposals/${proposalId}/`)) {
      if (conflict) { proposal.status = 'stale'; throw Object.assign(new Error('A meta foi alterada. Solicite uma nova proposta.'), { status: 409 }) }
      const action = path.split('/').at(-1)
      proposal.status = { approve: 'approved', reject: 'rejected', undo: 'undone' }[action]
      return { proposal: structuredClone(proposal) }
    }
    if (path === '/goal-plans/options') return { teams: [], individuals: [] }
    if (path.startsWith('/goal-plans/')) return { plans: structuredClone(goalPlans[path.slice('/goal-plans/'.length)] || []) }
    throw new Error(`Unexpected API request: ${path}`)
  }
  globalThis.__mcpAxios = {
    async get(url) {
      requests.push({ path: url, options: {} })
      if (url.endsWith('/goal-plans/options')) return { data: { teams: [], individuals: [] } }
      if (url.includes('/goal-plans/')) {
        if (goalReadFailure) throw new Error('Metas indisponíveis')
        return { data: { plans: structuredClone(goalPlans[url.split('/goal-plans/')[1]] || []) } }
      }
      return { data: { success: true, data: { meta: 100, superMeta: 200, ultraMeta: 300, revision: monthlyRevision } } }
    },
    async post(url, body) {
      requests.push({ path: url, options: { method: 'POST', body: JSON.stringify(body) } })
      if (conflict) { monthlyRevision += 1; throw Object.assign(new Error('A meta foi alterada em outra tela.'), { response: { status: 409, data: { error: 'A meta foi alterada em outra tela.' } } }) }
      monthlyRevision += 1
      return { data: { data: { meta: body.meta, superMeta: body.superMeta, ultraMeta: body.ultraMeta, revision: monthlyRevision } } }
    },
  }
  globalThis.__mcpPeriodSales = async (startDate, endDate) => ({ startDate, endDate, ...structuredClone(periodSales) })
  directory = await mkdtemp(join(tmpdir(), 'dashboard-mcp-ui-'))
  await symlink(join(project, 'node_modules'), join(directory, 'node_modules'), 'dir')
  const source = `import React,{act} from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import Goals from '${project}src/pages/GoalsPage.jsx';import Admin from '${project}src/pages/AdminPage.jsx';import Editor from '${project}src/components/goals/GoalMetricEditor.jsx';import Monthly from '${project}src/pages/PeriodDashboard.jsx';import Pace from '${project}src/pages/GoalPacePage.jsx';import{TvSettingsEditor as TvEditor}from '${project}src/components/tv/TvSettingsEditor.jsx';export{React,act,createRoot,MemoryRouter,Goals,Admin,Editor,Monthly,Pace,TvEditor};`
  const result = await build({
    stdin: { contents: source, resolveDir: project, sourcefile: 'mcp-ui-entry.jsx', loader: 'jsx' },
    bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' },
    plugins: [{ name: 'mcp-fixtures', setup(builder) {
      builder.onResolve({ filter: /contexts\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
      builder.onResolve({ filter: /lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      builder.onResolve({ filter: /^axios$/ }, () => ({ path: 'axios', namespace: 'fixture' }))
      builder.onResolve({ filter: /services\/periodSalesService$/ }, () => ({ path: 'sales', namespace: 'fixture' }))
      builder.onResolve({ filter: /components\/WorkspaceLayout$/ }, () => ({ path: 'skeleton', namespace: 'fixture' }))
      builder.onResolve({ filter: /components\/admin\/(RankingParticipation|UserManagement)$/ }, () => ({ path: 'empty', namespace: 'fixture' }))
      builder.onResolve({ filter: /components\/goals\/MonthlyPaceChart$/ }, () => ({ path: 'empty', namespace: 'fixture' }))
      builder.onResolve({ filter: /components\/charts\/(ReferenceChart|AnalyticsVisuals|RevenueHighlights|RefundSummary|RevenueNotifications|CommercialSalesPanel)$/ }, () => ({ path: 'charts', namespace: 'fixture' }))
      builder.onResolve({ filter: /^\.\/HubGoals$/ }, () => ({ path: 'empty', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'jsx', resolveDir: project, contents: {
        auth: 'export const useAuth=()=>globalThis.__mcpAuth',
        api: 'export const requestApi=(...args)=>globalThis.__mcpRequest(...args)',
        axios: 'export default globalThis.__mcpAxios',
        sales: 'export const loadPeriodSales=(...args)=>globalThis.__mcpPeriodSales(...args);export const bucketHasSalesSource=()=>false',
        skeleton: 'export const PageSkeleton=()=>null',
        empty: 'export default function Empty(){return null}',
        charts: 'export default function Empty(){return null};export const ReferenceChart=Empty,ChartPanel=Empty,RankedBars=Empty,MixChart=Empty',
      }[path] }))
    } }],
  })
  const entry = join(directory, 'entry.mjs')
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})

beforeEach(() => {
  enabled = true; writesEnabled = true; conflict = false; disconnectFailure = false; monthlyRevision = 7; requests = []
  goalPlans = {}; goalReadFailure = false; periodSales = { records: [], sources: [] }
  connectionScopes = ['dashboard.read', 'goals.propose']
  auth.currentUser = { uid: 'admin-1' }; auth.userRoles = { isAdmin: true }
  proposal = { id: proposalId, year: 2026, month: 12, scope: 'product', scopeId: 'MBA', metric: 'gross', status: 'pending', requestedBy: 'admin-1', connectionId: 'connection-1', before: basePlan, after: { ...basePlan, target: 140 }, flags: [], requiredConfirmation: { target: 140 }, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 1800000).toISOString() }
})
afterEach(async () => { if (root) { await runtime.act(async () => root.unmount()); root = null } })
after(async () => { dom?.window.close(); if (directory) await rm(directory, { recursive: true, force: true }) })
const button = (text, container = document) => [...container.querySelectorAll('button')].find(element => element.textContent.includes(text))
const mutations = () => requests.filter(request => request.options.method && request.options.method !== 'GET')
async function settle() { await runtime.act(async () => { await new Promise(resolve => setTimeout(resolve, 10)) }) }
async function mount(component = 'Goals', props = {}, path = `/metas?proposta=${proposalId}`) {
  const { React, act, createRoot, MemoryRouter } = runtime
  root = createRoot(document.getElementById('root'))
  await act(async () => root.render(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(runtime[component], props))))
  await settle()
}
async function click(element) { assert.ok(element, 'Expected clickable element'); await runtime.act(async () => element.click()); await settle() }
async function input(element, value) {
  assert.ok(element, 'Expected input')
  await runtime.act(async () => {
    const prototype = element.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function select(element, value) {
  assert.ok(element, 'Expected select')
  await runtime.act(async () => { element.value = value; element.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}

test('goals let an admin select Vitalício and create its own goal with revision zero', async () => {
  enabled = false
  await mount('Goals', {}, '/metas')
  await click(document.querySelector('button[aria-label="Produto"]'))
  const destination = document.querySelector('.goal-selection select')
  assert.ok([...destination.options].some(option => option.value === 'Vitalício' && !option.disabled))
  await select(destination, 'Vitalício')
  const form = document.querySelector('form[aria-label="Meta de Valor das vendas"]')
  const amounts = form.querySelectorAll('input[type="number"]')
  for (const [index, amount] of amounts.entries()) await input(amount, String((index + 1) * 100))
  await click(button('Salvar valor das vendas'))
  const saved = mutations().find(request => request.options.method === 'PUT')
  assert.ok(saved)
  assert.deepEqual(JSON.parse(saved.options.body), { scope: 'product', scopeId: 'Vitalício', product: 'Vitalício', metric: 'gross', target: 100, superTarget: 200, ultraTarget: 300, paceBasis: 'calendar', notes: '', expectedRevision: 0 })
})

test('pace offers Vitalício as an active product selection without an existing plan', async () => {
  await mount('Pace', {}, '/pace?year=2100&month=12')
  await click(button('Produto'))
  const destination = document.querySelector('select[aria-label="Família de produto"]')
  assert.ok([...destination.options].some(option => option.value === 'Vitalício' && option.textContent === 'Vitalício'))
  assert.equal(destination.disabled, false)
  await select(destination, 'Vitalício')
  assert.equal(destination.value, 'Vitalício')
  assert.match(document.body.textContent, /Ainda não há meta para este escopo/)
  assert.equal(mutations().length, 0)
})

test('TV pace can select and save Vitalício while retaining other product families', async () => {
  const saved = []
  await mount('TvEditor', { initial: { ...defaultTvSettings(), paceScope: 'product' }, directory: { teams: [], individuals: [] }, onSave: value => saved.push(value), onCancel() {} })
  const destination = [...document.querySelectorAll('label')].find(label => label.textContent.startsWith('Alvo do gráfico de pace')).querySelector('select')
  for (const product of ['Vitalício', 'DevClub', 'MBA', 'Operação 50K']) assert.ok([...destination.options].some(option => option.value === product && !option.disabled), product)
  await select(destination, 'Vitalício')
  await click(button('Salvar programação'))
  assert.equal(saved.length, 1)
  assert.equal(saved[0].paceScope, 'product')
  assert.equal(saved[0].paceScopeId, 'Vitalício')
})

test('disabled MCP hides proposals without reading proposal tables', async () => {
  enabled = false
  await mount()
  assert.equal(document.querySelector('[aria-label="Propostas de metas do Claude"]'), null)
  assert.equal(requests.some(request => /^\/mcp\/(proposals|history|connections)/.test(request.path)), false)
})

test('opening an approval link only previews server values and requires explicit retyping before approval', async () => {
  await mount()
  const panel = document.querySelector('[aria-label="Propostas de metas do Claude"]')
  assert.ok(panel)
  assert.match(panel.textContent, /MBA/)
  assert.match(panel.textContent, /140,00/)
  assert.match(panel.textContent, /100,00/)
  assert.equal(mutations().length, 0)
  assert.equal(button('Aprovar alteração').disabled, true)
  await input(panel.querySelector('input'), '14')
  assert.equal(button('Aprovar alteração').disabled, true)
  await input(panel.querySelector('input'), '140')
  await click(button('Aprovar alteração'))
  assert.deepEqual(mutations().map(({ path, options }) => [path, JSON.parse(options.body)]), [[`/mcp/proposals/${proposalId}/approve`, { confirmation: { target: 140 } }]])
  assert.match(panel.textContent, /Aplicada|aplicada/)
})

test('another admin cannot approve or undo someone else’s proposal', async () => {
  auth.currentUser = { uid: 'admin-2' }
  await mount()
  assert.equal(button('Aprovar alteração'), undefined)
  assert.equal(button('Recusar proposta'), undefined)
  assert.match(document.body.textContent, /quem solicitou/)
  assert.equal(mutations().length, 0)
})

test('refusing a proposal does not send edited amounts or require approval confirmation', async () => {
  await mount()
  await click(button('Recusar proposta'))
  assert.deepEqual(mutations().map(({ path, options }) => [path, JSON.parse(options.body)]), [[`/mcp/proposals/${proposalId}/reject`, {}]])
  assert.match(document.body.textContent, /Recusada/)
  assert.equal(button('Aprovar alteração'), undefined)
})

test('a reader never loads proposal or connection data', async () => {
  auth.userRoles = { isAdmin: false }
  await mount()
  assert.equal(requests.some(request => request.path.startsWith('/mcp/')), false)
  assert.equal(document.querySelector('[aria-label="Propostas de metas do Claude"]'), null)
})

test('expired proposals and paused writes cannot be applied', async () => {
  proposal.expiresAt = new Date(Date.now() - 1000).toISOString()
  await mount()
  assert.equal(button('Aprovar alteração'), undefined)
  assert.match(document.body.textContent, /Expirada/)
  assert.equal(mutations().length, 0)
})

test('disabled writes preserve the preview and explain the paused approval', async () => {
  writesEnabled = false
  await mount()
  assert.match(document.body.textContent, /alterações.*pausadas/i)
  assert.equal(button('Aprovar alteração'), undefined)
  assert.equal(mutations().length, 0)
})

test('conflict refreshes the proposal status without retrying the write', async () => {
  conflict = true
  await mount()
  await input(document.querySelector('[aria-label="Propostas de metas do Claude"] input'), '140')
  await click(button('Aprovar alteração'))
  assert.equal(mutations().length, 1)
  assert.match(document.body.textContent, /A meta foi alterada/)
  assert.equal(button('Aprovar alteração'), undefined)
})

test('history restores only after reviewing the previous values', async () => {
  proposal.status = 'approved'; proposal.approvedAt = new Date().toISOString()
  await mount()
  await click(button('Desfazer alteração'))
  assert.equal(mutations().length, 0)
  assert.match(document.body.textContent, /Restaurar valores anteriores/)
  await click(button('Confirmar restauração'))
  assert.equal(mutations()[0].path, `/mcp/proposals/${proposalId}/undo`)
  assert.match(document.body.textContent, /Desfeita/)
})

test('connections display buyer access only for an explicitly granted scope', async () => {
  await mount('Admin')
  assert.doesNotMatch(document.body.textContent, /Contatos de compradores/)
  await runtime.act(async () => root.unmount()); root = null
  connectionScopes.push('buyers.read')
  await mount('Admin')
  assert.match(document.body.textContent, /Contatos de compradores/)
})

test('disconnect failure keeps the connection visible and the user can retry', async () => {
  disconnectFailure = true
  await mount('Admin')
  await click(button('Desconectar'))
  assert.match(document.body.textContent, /Conexão indisponível/)
  assert.ok(button('Desconectar'))
  disconnectFailure = false
  await click(button('Desconectar'))
  assert.equal(mutations().filter(request => request.options.method === 'DELETE').length, 2)
  assert.match(document.body.textContent, /desconectada|Desconectada/)
})

test('the goal editor submits the read revision and stops stale retries until explicit reload', async () => {
  const saved = []; let reloads = 0
  await mount('Editor', { plan: basePlan, scope: 'product', scopeId: 'MBA', scopeName: 'MBA', metric: 'gross', editable: true,
    onSave: async payload => { saved.push(payload); throw Object.assign(new Error('A meta mudou.'), { status: 409 }) }, onReload: () => { reloads += 1 } })
  await click(button('Salvar valor das vendas'))
  assert.equal(saved[0].expectedRevision, 7)
  assert.equal(button('Salvar valor das vendas').disabled, true)
  await click(button('Recarregar meta'))
  assert.equal(reloads, 1)
  assert.equal(saved.length, 1)
})

const periodGoals = () => [...document.querySelectorAll('h2')].find(heading => heading.textContent === 'Metas do período').closest('section')
const monthlyPlan = { ...basePlan, scope: 'overall', scopeId: '', product: 'all', target: 1000, superTarget: 2000, ultraTarget: 4000, paceBasis: 'business', breakdown: [
  { key: 'marketing', target: 400, superTarget: 800, ultraTarget: 1600 },
  { key: 'sales', target: 600, superTarget: 1200, ultraTarget: 2400 },
] }

test('monthly goals use the saved overall sales tiers, business pace and selected month without changing the breakdown', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  goalPlans['2026/10'] = [basePlan, { ...monthlyPlan, metric: 'cash', target: 7000 }, { ...monthlyPlan, metric: 'operational', target: 9000 }, monthlyPlan]
  goalPlans['2026/9'] = [{ ...monthlyPlan, target: 2000, paceBasis: 'calendar' }]
  periodSales = { records: [{ id: 'sale-1', kind: 'sale', sourceId: 'tmb', platform: 'TMB', date: '2026-10-01', product: 'MBA', family: 'MBA', gross: 500, revenue: 40, quantity: 1, utm: {} }], sources: [{ id: 'tmb', platform: 'TMB', kind: 'sale', status: 'ready' }] }
  await mount('Monthly', { mode: 'month' }, '/mensal')
  const panel = periodGoals(), cards = [...panel.querySelectorAll('article')]
  assert.equal(cards.length, 3)
  for (const [index, amount] of ['1.000,00', '2.000,00', '4.000,00'].entries()) assert.ok(cards[index].textContent.includes(amount))
  for (const [index, percent] of ['50.0%', '25.0%', '12.5%'].entries()) assert.ok(cards[index].textContent.includes(percent))
  assert.match(panel.textContent, /dias úteis/)
  assert.match(panel.textContent, /Esperado.*50\.0%/)
  assert.equal(panel.querySelector('input'), null)
  assert.equal(button('Salvar faixas'), undefined)
  assert.equal(panel.querySelector('a').getAttribute('href'), '/metas?year=2026&month=10')
  assert.equal(requests.some(request => request.path.includes('/goals/month/')), false)
  assert.equal(mutations().length, 0)
  assert.equal(monthlyPlan.breakdown[0].target, 400)
  await input(document.getElementById('period-month'), '2026-09')
  await click(button('Aplicar período'))
  assert.ok(requests.some(request => request.path.endsWith('/goal-plans/2026/9')))
  assert.match(periodGoals().querySelector('article').textContent, /2\.000,00/)
  assert.equal(periodGoals().querySelector('a').getAttribute('href'), '/metas?year=2026&month=9')
})

test('monthly goals distinguish absent and zero plans without borrowing product, cash or operational goals', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  goalPlans['2026/10'] = [basePlan, { ...monthlyPlan, metric: 'cash' }, { ...monthlyPlan, metric: 'operational' }]
  await mount('Monthly', { mode: 'month' }, '/mensal')
  assert.match(periodGoals().textContent, /Meta geral de valor das vendas não configurada/)
  assert.equal(periodGoals().querySelectorAll('article').length, 0)
  goalPlans['2026/9'] = [{ ...monthlyPlan, target: 0, superTarget: 0, ultraTarget: 0 }]
  await input(document.getElementById('period-month'), '2026-09')
  await click(button('Aplicar período'))
  assert.doesNotMatch(periodGoals().textContent, /não configurada/)
  assert.equal(periodGoals().querySelectorAll('article').length, 3)
  assert.match(periodGoals().textContent, /Meta: R\$\s*0,00/)
  assert.doesNotMatch(periodGoals().textContent, /NaN|Infinity/)
})

test('monthly goal read failure remains an error and can be retried without a legacy write', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  goalPlans['2026/10'] = [monthlyPlan]; goalReadFailure = true
  await mount('Monthly', { mode: 'month' }, '/mensal')
  assert.match(periodGoals().querySelector('[role="alert"]').textContent, /Metas indisponíveis/)
  assert.doesNotMatch(periodGoals().textContent, /não configurada/)
  goalReadFailure = false
  await click(button('Recarregar metas'))
  assert.match(periodGoals().textContent, /1\.000,00/)
  assert.equal(mutations().length, 0)
})

test('monthly goals preserve filtered gross and partial or cash-only availability', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  goalPlans['2026/10'] = [monthlyPlan]
  periodSales = { records: [
    { id: 'sale-1', kind: 'sale', sourceId: 'tmb', platform: 'TMB', date: '2026-10-01', product: 'MBA', family: 'MBA', gross: 500, revenue: 40, quantity: 1, utm: {} },
    { id: 'sale-2', kind: 'sale', sourceId: 'tmb', platform: 'TMB', date: '2026-10-01', product: 'DevClub', family: 'DevClub', gross: null, revenue: 60, quantity: 1, utm: {} },
  ], sources: [{ id: 'tmb', platform: 'TMB', kind: 'sale', status: 'ready' }, { id: 'asaas', platform: 'Asaas', kind: 'sale', status: 'partial', salesAvailable: false }] }
  await mount('Monthly', { mode: 'month' }, '/mensal')
  assert.match(periodGoals().textContent, /[Pp]arcial/)
  assert.match(periodGoals().querySelector('article').textContent, /50\.0%/)
  await select(document.getElementById('period-platform'), 'TMB')
  assert.match(periodGoals().textContent, /[Pp]arcial/)
  await select(document.getElementById('period-family'), 'DevClub')
  assert.equal(periodGoals().querySelector('article > p').textContent, '—')
  await select(document.getElementById('period-family'), '')
  await select(document.getElementById('period-platform'), 'Asaas')
  assert.equal(periodGoals().querySelector('article > p').textContent, '—')
  assert.match(periodGoals().querySelector('article').textContent, /Projeção no ritmo atual: —/)
})

test('central goals honor the management link period and reject invalid date params', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  enabled = false
  goalPlans['2026/9'] = [monthlyPlan]
  await mount('Goals', {}, '/metas?year=2026&month=9')
  assert.ok(requests.some(request => request.path === '/goal-plans/2026/9'))
  assert.match(document.querySelector('[aria-label="Destino do planejamento"]').textContent, /Setembro de 2026/)
  assert.equal(document.querySelector('[aria-label="Meta de Valor das vendas"] input[type="number"]').value, '400')
  await runtime.act(async () => root.unmount()); root = null; requests = []
  await mount('Goals', {}, '/metas?year=9999&month=13')
  assert.ok(requests.some(request => request.path === '/goal-plans/2026/10'))
})

test('annual goals retain their legacy read and save contract', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-15T15:00:00Z') })
  await mount('Monthly', { mode: 'year' }, '/anual')
  assert.ok(requests.some(request => request.path.endsWith('/goals/year/2026')))
  assert.equal(requests.some(request => request.path.includes('/goal-plans/')), false)
  assert.equal(document.getElementById('goal-meta').value, '100')
  await input(document.getElementById('goal-meta'), '110')
  await click(button('Salvar faixas'))
  assert.equal(mutations()[0].path.endsWith('/goals/year/2026'), true)
  assert.deepEqual(JSON.parse(mutations()[0].options.body), { meta: 110, superMeta: 200, ultraMeta: 300 })
})

test('a new overall goal starts with editable manual totals and saves without a clear flag', async () => {
  const saved = []
  await mount('Editor', { scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: true, onSave: payload => saved.push(payload) })
  const amounts = [...document.querySelectorAll('input[type="number"]')]
  assert.equal(amounts.length, 3)
  assert.ok(amounts.every(element => element.value === '' && !element.disabled))
  for (const [index, amount] of amounts.entries()) await input(amount, String((index + 1) * 100))
  await click(button('Salvar valor das vendas'))
  assert.deepEqual(saved[0], { scope: 'overall', scopeId: '', product: 'all', metric: 'gross', target: 100, superTarget: 200, ultraTarget: 300, paceBasis: 'calendar', notes: '', expectedRevision: 0 })
})

test('an existing division requires confirmation before editing the total and clears it only on explicit save', async () => {
  const saved = [], plan = { ...monthlyPlan, notes: 'Premissas preservadas' }
  await mount('Editor', { plan, scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: true, onSave: payload => saved.push(payload) })
  assert.equal(document.querySelectorAll('input[type="number"]').length, 6)
  await click(button('Editar total manualmente'))
  assert.match(document.body.textContent, /substituir.*divisão.*Marketing e Vendas/i)
  assert.equal(document.querySelector('[aria-label="Marketing · Meta base"]').value, '400')
  assert.equal(button('Salvar valor das vendas').disabled, true)
  await click(button('Cancelar'))
  assert.equal(document.querySelector('[aria-label="Marketing · Meta base"]').value, '400')
  assert.equal(saved.length, 0)
  await click(button('Editar total manualmente'))
  await click(button('Confirmar edição manual'))
  assert.deepEqual([...document.querySelectorAll('input[type="number"]')].map(element => element.value), ['1000', '2000', '4000'])
  assert.equal(saved.length, 0)
  await input(document.querySelector('input[type="number"]'), '1100')
  await click(button('Salvar valor das vendas'))
  assert.deepEqual(saved[0], { scope: 'overall', scopeId: '', product: 'all', metric: 'gross', target: 1100, superTarget: 2000, ultraTarget: 4000, paceBasis: 'business', notes: 'Premissas preservadas', clearBreakdown: true, expectedRevision: 7 })
  assert.equal(plan.breakdown[0].target, 400)
})

test('reconfiguring Marketing and Vendas after a confirmed conversion removes the clear flag', async () => {
  const saved = []
  await mount('Editor', { plan: monthlyPlan, scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: true, onSave: payload => saved.push(payload) })
  await click(button('Editar total manualmente'))
  await click(button('Confirmar edição manual'))
  await click(button('Configurar Marketing e Vendas'))
  assert.equal(document.querySelector('[aria-label="Marketing · Meta base"]').value, '400')
  await click(button('Salvar valor das vendas'))
  assert.deepEqual(saved[0].breakdown, monthlyPlan.breakdown)
  assert.equal(Object.hasOwn(saved[0], 'clearBreakdown'), false)
  assert.equal(saved[0].expectedRevision, 7)
})

test('product prefilling previews included products and overlaps before changing only the overall draft', async () => {
  const saved = [], products = [{ ...basePlan, scopeId: 'DevClub', product: 'DevClub' }, { ...basePlan, scopeId: 'Vitalício', product: 'Vitalício', target: 50, superTarget: 100, ultraTarget: 150 }, { ...basePlan, metric: 'cash', target: 5000, superTarget: 6000, ultraTarget: 7000 }, { ...basePlan, scope: 'team', scopeId: 'team-1' }]
  await mount('Editor', { plan: monthlyPlan, scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: true, productPlans: products, periodLabel: 'Outubro de 2026', onSave: payload => saved.push(payload) })
  await input(document.querySelector('textarea'), 'Notas em edição')
  await click(button('Preencher com produtos'))
  let preview = document.querySelector('[aria-label="Prévia do preenchimento com produtos"]')
  assert.ok(preview)
  assert.match(preview.textContent, /Outubro de 2026/)
  assert.match(preview.textContent, /DevClub/)
  assert.match(preview.textContent, /Vitalício/)
  assert.match(preview.textContent, /sobreposição/i)
  assert.match(preview.textContent, /substituir.*divisão.*Marketing e Vendas/i)
  assert.doesNotMatch(preview.querySelector('tbody').textContent, /MBA|team-1|5\.000,00/)
  assert.match(preview.textContent, /150,00/)
  assert.equal(document.querySelector('[aria-label="Marketing · Meta base"]').value, '400')
  assert.equal(saved.length, 0)
  await click(button('Cancelar', preview))
  assert.equal(document.querySelector('[aria-label="Marketing · Meta base"]').value, '400')
  await click(button('Preencher com produtos'))
  preview = document.querySelector('[aria-label="Prévia do preenchimento com produtos"]')
  await click(button('Confirmar preenchimento', preview))
  assert.deepEqual([...document.querySelectorAll('input[type="number"]')].map(element => element.value), ['150', '300', '450'])
  assert.equal(document.querySelector('textarea').value, 'Notas em edição')
  assert.equal(document.querySelector('select').value, 'business')
  assert.equal(saved.length, 0)
  await click(button('Salvar valor das vendas'))
  assert.deepEqual(saved[0], { scope: 'overall', scopeId: '', product: 'all', metric: 'gross', target: 150, superTarget: 300, ultraTarget: 450, paceBasis: 'business', notes: 'Notas em edição', clearBreakdown: true, expectedRevision: 7 })
  assert.equal(products[0].target, 100)
})

test('empty product plans cannot fill a false zero while explicitly zero goals can be confirmed', async () => {
  const saved = [], props = { scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: true, onSave: payload => saved.push(payload) }
  await mount('Editor', props)
  await click(button('Preencher com produtos'))
  assert.match(document.body.textContent, /Nenhuma meta de produto/)
  assert.equal(button('Confirmar preenchimento').disabled, true)
  assert.ok([...document.querySelectorAll('input[type="number"]')].every(element => element.value === ''))
  await runtime.act(async () => root.unmount()); root = null
  await mount('Editor', { ...props, productPlans: [{ ...basePlan, target: 0, superTarget: 0, ultraTarget: 0 }] })
  await click(button('Preencher com produtos'))
  assert.equal(button('Confirmar preenchimento').disabled, false)
  await click(button('Confirmar preenchimento'))
  assert.deepEqual([...document.querySelectorAll('input[type="number"]')].map(element => element.value), ['0', '0', '0'])
  await click(button('Salvar valor das vendas'))
  assert.equal(saved[0].target, 0)
  assert.equal(Object.hasOwn(saved[0], 'clearBreakdown'), false)
})

test('read-only goals offer neither product prefilling nor division conversion', async () => {
  await mount('Editor', { plan: monthlyPlan, scope: 'overall', scopeId: '', scopeName: 'Meta geral', metric: 'gross', editable: false, productPlans: [basePlan], onSave: () => assert.fail('A reader cannot save') })
  assert.equal(button('Preencher com produtos'), undefined)
  assert.equal(button('Editar total manualmente'), undefined)
  assert.equal(button('Salvar valor das vendas'), undefined)
  assert.ok(document.querySelector('fieldset').disabled)
})

test('the Goals page supplies product goals from only its current month and keeps financial metrics independent', async () => {
  enabled = false
  goalPlans['2026/10'] = [basePlan, { ...basePlan, metric: 'cash', target: 5000, superTarget: 6000, ultraTarget: 7000 }]
  goalPlans['2026/9'] = [{ ...basePlan, target: 400, superTarget: 500, ultraTarget: 600 }]
  await mount('Goals', {}, '/metas?year=2026&month=10')
  let gross = document.querySelector('[aria-label="Meta de Valor das vendas"]')
  const cash = document.querySelector('[aria-label="Meta de Cash collected"]')
  await click(button('Preencher com produtos', gross))
  assert.doesNotMatch(gross.querySelector('[aria-label="Prévia do preenchimento com produtos"]').textContent, /5\.000,00/)
  await click(button('Confirmar preenchimento', gross))
  assert.deepEqual([...gross.querySelectorAll('input[type="number"]')].map(element => element.value), ['100', '200', '300'])
  assert.ok([...cash.querySelectorAll('input[type="number"]')].every(element => element.value === ''))
  await select(document.querySelector('.filter-bar select'), '9')
  gross = document.querySelector('[aria-label="Meta de Valor das vendas"]')
  await click(button('Preencher com produtos', gross))
  assert.match(gross.querySelector('[aria-label="Prévia do preenchimento com produtos"]').textContent, /Setembro de 2026/)
  await click(button('Confirmar preenchimento', gross))
  assert.equal(gross.querySelector('input[type="number"]').value, '400')
  assert.equal(mutations().length, 0)
})
