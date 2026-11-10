import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { brazilDate } from '../src/utils/goalPace.js'

const project = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(new URL('../package.json', import.meta.url))
const currentMonth = Number(brazilDate().slice(5, 7))
const vault = { currentUser: { uid: 'vault-sub-a' } }
const hub = { user: { id: 'hub-profile-a', individual_goal: 999999, role: 'vendedor' } }
let runtime, directory, dom, root, client, handler
let requests = []
const metric = (id = 'gross', changes = {}) => ({ metric: id, configured: true, plan: { target: 10000, superTarget: 15000, ultraTarget: 20000, paceBasis: 'calendar' },
  pace: { target: 10000, actual: 2500, attainment: 25, expected: 5000, pacePercent: 50, remaining: 7500, requiredPerDay: 500, projection: 5000, delta: -2500,
    validTarget: true, definitive: true, scopeExcluded: false, available: true, sourceIncomplete: false, future: false, ended: false, basis: 'calendar',
    rows: [{ date: '2026-11-01', label: '01', actual: 2500, planned: 5000, observed: true }], ...changes } })
const absent = id => ({ ...metric(id, { target: null, validTarget: false, attainment: null, expected: null, pacePercent: null }), configured: false, plan: null })
const response = (path, changes = {}) => {
  const [year, month] = path.split('/').slice(-2).map(Number)
  return { year, month, today: '2026-11-15', loading: false, attributionAvailable: true, metrics: [metric(), metric('cash'), absent('count')], ...changes }
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://workspace.test/daily-kpis' })
  for (const name of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'MutationObserver']) globalThis[name] = dom.window[name]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  globalThis.__individualGoalVault = vault
  globalThis.__individualGoalHub = hub
  globalThis.__individualGoalRequest = (path, options) => { requests.push({ path, options }); return handler(path, options) }
  directory = await mkdtemp(join(tmpdir(), 'individual-goal-ui-'))
  const contents = `import React,{act}from'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Card from '${project}src/hub/components/IndividualGoalPace.tsx';export{React,act,createRoot,QueryClient,QueryClientProvider,Card};`
  const result = await build({ stdin: { contents, resolveDir: project, sourcefile: 'individual-goal-test.jsx', loader: 'jsx' }, bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, plugins: [{ name: 'individual-goal-fixtures', setup(builder) {
    builder.onResolve({ filter: /^\.\.\/\.\.\/contexts\/AuthContext$/ }, () => ({ path: 'vault', namespace: 'fixture' }))
    builder.onResolve({ filter: /^\.\.\/contexts\/AuthContext$/ }, () => ({ path: 'hub', namespace: 'fixture' }))
    builder.onResolve({ filter: /lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
    builder.onResolve({ filter: /components\/charts\/ReferenceChart(?:\.jsx)?$/ }, () => ({ path: 'chart', namespace: 'fixture' }))
    builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
      vault: 'export const useAuth=()=>globalThis.__individualGoalVault;', hub: 'export const useAuth=()=>globalThis.__individualGoalHub;',
      api: 'export const requestApi=(...args)=>globalThis.__individualGoalRequest(...args);',
      chart: 'import React from "react";export function ReferenceChart({title,rows,height}){return <div data-testid="individual-goal-chart" data-height={height}>{title}<span>{rows.length} dias</span></div>}',
    }[args.path], loader: 'jsx', resolveDir: project }))
    builder.onResolve({ filter: /^[^./]/ }, args => args.path.startsWith('node:') ? undefined : ({ path: require.resolve(args.path), external: true }))
  } }] })
  const entry = join(directory, 'entry.mjs')
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})
afterEach(async () => {
  if (root) { await runtime.act(async () => root.unmount()); root = null }
  client?.clear()
  requests = []
  vault.currentUser = { uid: 'vault-sub-a' }
  hub.user = { id: 'hub-profile-a', individual_goal: 999999, role: 'vendedor' }
})
after(async () => { dom?.window.close(); if (directory) await rm(directory, { recursive: true, force: true }) })
async function settle() { await runtime.act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) }) }
async function render(year = 2026, wait = true) {
  await runtime.act(async () => root.render(runtime.React.createElement(runtime.QueryClientProvider, { client }, runtime.React.createElement(runtime.Card, { year }))))
  if (wait) await settle()
}
async function mount() {
  client = new runtime.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  root = runtime.createRoot(document.getElementById('root'))
  handler ||= path => Promise.resolve(response(path))
  await render()
}
async function choose(label, value) {
  const select = document.querySelector(`select[aria-label="${label}"]`)
  assert.ok(select)
  await runtime.act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}
const stat = id => document.querySelector(`[data-testid="individual-goal-${id}"]`)?.textContent
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label)

test('seller reads only own monthly endpoint and sees2500/10000=25%, expected5000 and rhythm50%', async () => {
  handler = path => Promise.resolve({ ...response(path), ignoredOtherSeller: { name: 'OTHER_PERSON_PRIVATE', target: 8000000 } })
  await mount()
  assert.equal(stat('target').replace(/\s/g, ' '), 'R$ 10.000,00')
  assert.equal(stat('actual').replace(/\s/g, ' '), 'R$ 2.500,00')
  assert.equal(stat('attainment'), '25%')
  assert.equal(stat('expected').replace(/\s/g, ' '), 'R$ 5.000,00')
  assert.equal(stat('pace'), '50%')
  assert.deepEqual(requests.map(item => item.path), [`/goal-plans/me/2026/${currentMonth}`])
  assert.doesNotMatch(JSON.stringify(requests.map(({ path }) => path)), /vault-sub|hub-profile|options|period-cache|sellerId/)
  assert.doesNotMatch(document.body.textContent, /OTHER_PERSON_PRIVATE|999\.999|8\.000\.000/)
  assert.equal(document.querySelector('[data-testid="individual-goal-chart"]'), null)
  await runtime.act(async () => button('Ver evolução da meta').click())
  assert.equal(document.querySelector('[data-testid="individual-goal-chart"]').getAttribute('data-height'), '240')
})
test('month and KPI year select a new own period without global sales requests', async () => {
  handler = path => Promise.resolve(response(path))
  await mount()
  const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1
  await choose('Mês da minha meta', String(nextMonth))
  await render(2025)
  assert.deepEqual(requests.map(item => item.path), [`/goal-plans/me/2026/${currentMonth}`, `/goal-plans/me/2026/${nextMonth}`, `/goal-plans/me/2025/${nextMonth}`])
})
test('first configured valid metric is selected automatically; count does not use a legacy profile goal', async () => {
  handler = path => Promise.resolve(response(path, { metrics: [absent('gross'), metric('cash', { actual: 1000, target: 2000, attainment: 50, expected: 1500, pacePercent: 100 / 1.5 }), absent('count')] }))
  await mount()
  assert.equal(document.querySelector('select[aria-label="Indicador da minha meta"]').value, 'cash')
  assert.equal(stat('attainment'), '50%')
  await choose('Indicador da minha meta', 'count')
  assert.match(document.body.textContent, /Meta não definida para este mês e indicador/)
  assert.equal(stat('attainment'), '—')
  assert.equal(stat('pace'), '—')
  assert.doesNotMatch(document.body.textContent, /999999|999\.999/)
})
test('a configured zero target, unavailable amounts and partial coverage retain explicit empty percentages', async () => {
  handler = path => Promise.resolve(response(path, { attributionAvailable: false, metrics: [metric('gross', { target: 0, actual: null, validTarget: false, attainment: null, expected: null, pacePercent: null, available: false, definitive: false, sourceIncomplete: true }), absent('cash'), absent('count')] }))
  await mount()
  assert.match(document.body.textContent, /meta está zerada/)
  assert.match(document.body.textContent, /Leitura parcial|indisponível/)
  assert.equal(stat('actual'), '—')
  assert.equal(stat('attainment'), '—')
  assert.equal(stat('pace'), '—')
})
test('excluded and future periods never turn missing performance into0%', async () => {
  handler = path => Promise.resolve(response(path, { metrics: [metric('gross', { scopeExcluded: true, actual: null, attainment: null, pacePercent: null, definitive: false }), absent('cash'), absent('count')] }))
  await mount()
  assert.match(document.body.textContent, /fora dos cálculos de desempenho/)
  assert.equal(stat('attainment'), '—')
  handler = path => Promise.resolve(response(path, { metrics: [metric('gross', { future: true, actual: null, attainment: null, pacePercent: null }), absent('cash'), absent('count')] }))
  await render(2027)
  assert.match(document.body.textContent, /Mês não iniciado/)
  assert.equal(stat('attainment'), '—')
})
test('an account switch clears old values immediately and late old-account responses remain hidden', async () => {
  handler = path => Promise.resolve(response(path))
  await mount()
  const lateA = deferred(), lateB = deferred()
  handler = () => lateA.promise
  await runtime.act(async () => button('Atualizar minha meta').click())
  assert.equal(stat('attainment'), '25%')
  handler = () => lateB.promise
  vault.currentUser = { uid: 'vault-sub-b' }
  hub.user = { id: 'hub-profile-b', individual_goal: 888888, role: 'vendedor' }
  await render(2026, false)
  assert.doesNotMatch(document.body.textContent, /2\.500,00|25%|50%/)
  await runtime.act(async () => lateA.resolve(response(`/goal-plans/me/2026/${currentMonth}`)))
  await settle()
  assert.doesNotMatch(document.body.textContent, /2\.500,00|25%/)
  await runtime.act(async () => lateB.resolve(response(`/goal-plans/me/2026/${currentMonth}`, { metrics: [metric('gross', { actual: 1234, attainment: 12.34, pacePercent: 24.68 }), absent('cash'), absent('count')] })))
  await settle()
  assert.equal(stat('actual').replace(/\s/g, ' '), 'R$ 1.234,00')
  const keys = client.getQueryCache().getAll().map(query => query.queryKey)
  assert.ok(keys.some(key => key.includes('vault-sub-b') && key.includes('hub-profile-b')))
  vault.currentUser = null
  hub.user = null
  await render(2026, false)
  assert.equal(document.querySelector('[aria-label="Minha meta do mês"]'), null)
})
test('failed reads offer retry without displaying invented values', async () => {
  let failed = true
  handler = path => failed ? Promise.reject(new Error('unavailable')) : Promise.resolve(response(path))
  await mount()
  assert.match(document.querySelector('[role="alert"]').textContent, /Não foi possível carregar sua meta/)
  assert.equal(stat('actual'), undefined)
  failed = false
  await runtime.act(async () => button('Tentar novamente').click())
  await settle()
  assert.equal(stat('attainment'), '25%')
  assert.equal(requests.length, 2)
})
