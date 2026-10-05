import { test, before, after, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'
import { SCREENS } from '../src/lib/navigation.js'

let runtime, directory, dom, root, queryClient, requestHandler
let requests = []
const auth = {
  currentUser: { uid: 'operator', displayName: 'Operador' }, userRoles: { isAdmin: false }, loading: false,
  hasPermission: permission => auth.userRoles.isAdmin || auth.userRoles[permission] === true,
  logout() {}, login() {}, reload() {}, vault: { vaultUrl: 'https://vault.test' },
}
const catalog = {
  id: 'mba', title: 'Time MBA', description: 'Material privado de treinamento.', completedStepIds: [],
  modules: [{ id: 'entry', title: 'Entrada', description: 'Prepare-se.', steps: [
    { id: 'culture', title: 'Estudar cultura', description: 'Leia o guia.' },
    { id: 'practice', title: 'Praticar atendimento', description: 'Faça o exercício.' },
  ] }], resources: [], notices: [], files: [],
}
const user = permissions => ({ id: 'seller', name: 'Vendedora', email: 'seller@example.test', isAdmin: false, permissions, revision: 'revision-1' })
const defaultRequest = async (path, options = {}) => {
  if (path.startsWith('/onboarding/')) return structuredClone({ ...catalog, id: path.split('/')[2] })
  throw new Error(`Unexpected request ${options.method || 'GET'} ${path}`)
}
function setAuth(id = 'operator', permissions = [], isAdmin = false) {
  auth.currentUser = { uid: id, displayName: id }
  auth.userRoles = { ...Object.fromEntries(permissions.map(permission => [permission, true])), isAdmin }
}
function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://workspace.test', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'DocumentFragment', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver', 'localStorage']) globalThis[name] = dom.window[name]
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window)
  globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window)
  globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window)
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.scrollTo = function () {}
  globalThis.__onboardingAccessAuth = auth
  globalThis.__onboardingAccessRequest = (path, options = {}) => {
    requests.push({ path, options })
    return requestHandler(path, options)
  }
  directory = await mkdtemp(fileURLToPath(new URL('../.onboarding-access-', import.meta.url)))
  const contents = `import React,{act} from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import{AppRouter}from'../src/PrivateWorkspace.jsx';import UserManagement from'../src/components/admin/UserManagement.jsx';import Materials from'../src/pages/MaterialsPage.jsx';export{React,act,createRoot,MemoryRouter,QueryClient,QueryClientProvider,AppRouter,UserManagement,Materials};`
  const result = await build({
    stdin: { contents, resolveDir: directory, sourcefile: 'entry.jsx', loader: 'jsx' }, bundle: true, write: false,
    format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' },
    define: { 'import.meta.env': '{}' }, plugins: [{ name: 'local-fixtures', setup(builder) {
      builder.onLoad({ filter: /\/src\/PrivateWorkspace\.jsx$/ }, async args => ({ contents: (await readFile(args.path, 'utf8')) + '\nexport { AppRouter };', loader: 'jsx', resolveDir: dirname(args.path) }))
      builder.onResolve({ filter: /contexts\/AuthContext$/ }, () => ({ path: 'auth', namespace: 'fixture' }))
      builder.onResolve({ filter: /lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      builder.onResolve({ filter: /onboarding\/ResourceViewer(?:\.jsx)?$/ }, () => ({ path: 'viewer', namespace: 'fixture' }))
      builder.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'supabase', namespace: 'fixture' }))
      builder.onResolve({ filter: /^\.\/hub\/components\/ui\// }, () => ({ path: 'providers', namespace: 'fixture' }))
      builder.onResolve({ filter: /^\.\/(?:pages|hub\/pages)\// }, args => ['OnboardingPage', 'MaterialsPage'].some(name => args.path.endsWith(name)) ? undefined : ({ path: 'unused-page', namespace: 'fixture' }))
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: {
        auth: 'export const useAuth=()=>globalThis.__onboardingAccessAuth;export const AuthProvider=({children})=>children;export const HubProvider=({children})=>children;',
        api: 'export const requestApi=(...args)=>globalThis.__onboardingAccessRequest(...args);export const API_URL="https://api.test";export const apiFetch=()=>{throw new Error("unexpected upload")};',
        viewer: 'export default function Viewer(){return null}',
        supabase: 'export const supabase={from:()=>({select:()=>({order:async()=>({data:[],error:null})})})};',
        providers: 'export const TooltipProvider=({children})=>children;export const Toaster=()=>null;',
        'unused-page': 'export default function Page(){return null}',
      }[args.path], loader: 'jsx', resolveDir: directory }))
    } }],
  })
  const path = `${directory}/entry.mjs`
  await writeFile(path, result.outputFiles[0].text)
  runtime = await import(path)
})
afterEach(async () => {
  if (root) { await runtime.act(async () => root.unmount()); root = null }
  queryClient?.clear()
  requests = []
})
after(async () => { dom?.window.close(); if (directory) await rm(directory, { recursive: true, force: true }) })

async function settle() { await runtime.act(async () => { await new Promise(resolve => setTimeout(resolve, 25)) }) }
async function mount(Component = runtime.AppRouter, path = '/onboarding/mba') {
  queryClient = new runtime.QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false, gcTime: 0 } } })
  root = runtime.createRoot(document.getElementById('root'))
  await render(Component, path)
}
async function render(Component = runtime.AppRouter, path = '/onboarding/mba') {
  const { React, QueryClientProvider, MemoryRouter } = runtime
  await runtime.act(async () => root.render(React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(Component)))))
  await settle()
}
async function click(element) {
  assert.ok(element, 'Expected clickable control')
  await runtime.act(async () => element.click())
  await settle()
}
const button = text => [...document.querySelectorAll('button')].find(element => element.textContent.includes(text))
const permissionBox = label => [...document.querySelectorAll('.admin-user-menu-group label')].find(element => element.textContent === label)?.querySelector('input')

function adminFixture(permissions) {
  let current = user(permissions)
  requestHandler = async (path, options) => {
    if (path === '/admin/users/catalog') return { permissions: SCREENS.filter(screen => screen.permission !== 'admin').map(screen => ({ id: screen.permission, label: screen.label })), teams: [] }
    if (path.startsWith('/admin/users?')) return { users: [current], total: 1, totalPages: 1 }
    if (path === '/admin/users/seller/access' && options.method === 'PUT') {
      const input = JSON.parse(options.body)
      current = { ...current, ...input, revision: 'revision-2' }
      return { user: current }
    }
    throw new Error(`Unexpected admin request ${path}`)
  }
}

test('admin grants MBA and DevClub independently while retaining existing sales and management permissions', async () => {
  setAuth('admin', [], true)
  const existing = ['hub-home', 'materials', 'sales-links', 'attribution', 'financial']
  adminFixture(existing)
  await mount(runtime.UserManagement, '/admin')
  await click(document.querySelector('[aria-label="Editar acessos: Vendedora"]'))
  assert.equal(permissionBox('Onboarding MBA').checked, false)
  assert.equal(permissionBox('Onboarding DevClub').checked, false)
  await click(permissionBox('Onboarding MBA'))
  await click(permissionBox('Onboarding DevClub'))
  await click(button('Salvar acessos'))
  const saved = requests.find(request => request.options.method === 'PUT')
  assert.deepEqual(JSON.parse(saved.options.body), { isAdmin: false, permissions: [...existing, 'onboarding-mba', 'onboarding-devclub'], expectedRevision: 'revision-1' })
  assert.match(document.querySelector('[role="dialog"]').textContent, /Acessos atualizados/)
})

test('revoking MBA keeps DevClub and every unrelated permission selected', async () => {
  setAuth('admin', [], true)
  const existing = ['hub-home', 'materials', 'sales-links', 'onboarding-mba', 'onboarding-devclub']
  adminFixture(existing)
  await mount(runtime.UserManagement, '/admin')
  await click(document.querySelector('[aria-label="Editar acessos: Vendedora"]'))
  await click(permissionBox('Onboarding MBA'))
  assert.equal(permissionBox('Onboarding DevClub').checked, true)
  await click(button('Salvar acessos'))
  const saved = JSON.parse(requests.find(request => request.options.method === 'PUT').options.body)
  assert.deepEqual(saved.permissions, existing.filter(permission => permission !== 'onboarding-mba'))
})

test('new seller defaults do not automatically grant either onboarding track', async () => {
  setAuth('admin', [], true)
  adminFixture(['hub-home'])
  await mount(runtime.UserManagement, '/admin')
  await click(button('Adicionar usuário'))
  assert.equal(permissionBox('Onboarding MBA').checked, false)
  assert.equal(permissionBox('Onboarding DevClub').checked, false)
  assert.equal(permissionBox('Materiais').checked, true)
})

test('a direct URL for the other track is blocked before its catalog is requested', async () => {
  setAuth('seller-mba', ['onboarding-mba'])
  requestHandler = defaultRequest
  await mount(runtime.AppRouter, '/onboarding/devclub')
  assert.match(document.body.textContent, /Acesso não liberado/)
  assert.equal(requests.length, 0)
  const links = [...document.querySelectorAll('.workspace-navlink')].map(link => link.getAttribute('href'))
  assert.deepEqual(links, ['/onboarding/mba'])
})

test('materials shortcuts expose only the authorized onboarding library', async () => {
  setAuth('seller-devclub', ['materials', 'onboarding-devclub'])
  requestHandler = defaultRequest
  await mount(runtime.Materials, '/materials')
  const links = [...document.querySelectorAll('.onboarding-materials-shortcuts a')].map(link => link.getAttribute('href'))
  assert.deepEqual(links, ['/onboarding/devclub?aba=biblioteca'])
})

test('a stale catalog refetch cannot undo a progress save that already succeeded', async () => {
  setAuth('seller-mba', ['onboarding-mba'])
  const lateRead = deferred()
  let reads = 0, signal
  requestHandler = async (path, options) => {
    if (options.method === 'PUT') return { completedStepIds: ['culture'] }
    if (++reads === 1) return structuredClone(catalog)
    signal = options.signal
    return lateRead.promise
  }
  await mount()
  let background
  await runtime.act(async () => { background = queryClient.refetchQueries({ queryKey: ['onboarding', 'seller-mba', 'mba'] }) })
  await click(document.querySelector('input[aria-label="Concluir: Estudar cultura"]'))
  assert.equal(signal.aborted, true, 'saving must cancel the prior catalog read')
  await runtime.act(async () => { lateRead.resolve(structuredClone(catalog)); await background })
  await settle()
  assert.equal(document.querySelector('input[aria-label="Concluir: Estudar cultura"]').checked, true)
  assert.equal(document.querySelector('.onboarding-progress strong').textContent, '1 / 2')
})

test('a late save from the prior account does not populate the new account progress', async () => {
  setAuth('seller-a', ['onboarding-mba'])
  const lateSave = deferred()
  requestHandler = async (path, options) => options.method === 'PUT' ? lateSave.promise : structuredClone(catalog)
  await mount()
  await click(document.querySelector('input[aria-label="Concluir: Estudar cultura"]'))
  setAuth('seller-b', ['onboarding-mba'])
  queryClient.clear()
  await render()
  assert.equal(document.querySelector('.onboarding-progress strong').textContent, '0 / 2')
  await runtime.act(async () => lateSave.resolve({ completedStepIds: ['culture'] }))
  await settle()
  assert.equal(document.querySelector('.onboarding-progress strong').textContent, '0 / 2')
  assert.deepEqual(queryClient.getQueryData(['onboarding', 'seller-b', 'mba']).completedStepIds, [])
})

test('permission revocation removes the active track instead of displaying its cached data', async () => {
  setAuth('seller-mba', ['onboarding-mba'])
  requestHandler = defaultRequest
  await mount()
  assert.ok(document.querySelector('.onboarding-page'))
  setAuth('seller-mba', [])
  await render()
  assert.match(document.body.textContent, /Acesso não liberado/)
  assert.equal(document.querySelector('.onboarding-page'), null)
  assert.equal(document.querySelectorAll('.workspace-navlink').length, 0)
})
