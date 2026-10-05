import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { JSDOM } from 'jsdom'
import { build } from 'esbuild'

let runtime, directory, dom, root
const requests = []
const created = []
const revoked = []
const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL
const files = [
  { id: 'generator', path: 'site/diagnostico/gerador.html', mimeType: 'text/html' },
  { id: 'video', path: 'site/deck/reportagens.mp4', mimeType: 'video/mp4' },
  { id: 'pdf', path: 'site/pdf/ementa.pdf', mimeType: 'application/pdf' },
]
const resources = files.map(file => ({
  id: file.id, title: file.id, description: 'Material de teste', format: file.id === 'generator' ? 'html' : file.id === 'video' ? 'mp4' : 'pdf',
  file: { id: file.id, name: file.path.split('/').at(-1), mimeType: file.mimeType },
}))
const catalog = { id: 'mba', files, resources, completedStepIds: [] }

before(async () => {
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://workspace.test/onboarding/mba', pretendToBeVisual: true })
  for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'NodeFilter', 'Event', 'MouseEvent', 'CustomEvent', 'MutationObserver', 'DOMParser', 'getComputedStyle']) globalThis[name] = dom.window[name]
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  URL.createObjectURL = () => { const url = `blob:fixture/${created.length + 1}`; created.push(url); return url }
  URL.revokeObjectURL = url => revoked.push(url)
  globalThis.__resourceViewerFetch = async (url, options) => {
    requests.push({ url, options })
    const body = url.endsWith('/generator')
      ? '<html><body><input id="notes"><video src="../deck/reportagens.mp4"></video></body></html>'
      : 'fixture bytes'
    return new Response(body, { status: 200 })
  }
  directory = await mkdtemp(fileURLToPath(new URL('../.resource-viewer-test-', import.meta.url)))
  const source = `import React,{act} from 'react';import{createRoot}from'react-dom/client';import Viewer from '../src/components/onboarding/ResourceViewer.jsx';export{React,act,createRoot,Viewer};`
  const result = await build({
    stdin: { contents: source, resolveDir: directory, sourcefile: 'entry.jsx', loader: 'jsx' },
    bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' },
    plugins: [{ name: 'fixture-api', setup(build) {
      build.onResolve({ filter: /lib\/api$/ }, () => ({ path: 'api', namespace: 'fixture' }))
      build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const API_URL="https://api.test/api";export const apiFetch=(...args)=>globalThis.__resourceViewerFetch(...args)' }))
    } }],
  })
  const entry = `${directory}/entry.mjs`
  await writeFile(entry, result.outputFiles[0].text)
  runtime = await import(entry)
})

after(async () => {
  if (root) await runtime.act(async () => root.unmount())
  URL.createObjectURL = originalCreateObjectURL
  URL.revokeObjectURL = originalRevokeObjectURL
  dom?.window.close()
  if (directory) await rm(directory, { recursive: true, force: true })
})

async function render(currentCatalog, resource = resources[0]) {
  if (!root) root = runtime.createRoot(document.getElementById('root'))
  await runtime.act(async () => root.render(runtime.React.createElement(runtime.Viewer, {
    track: 'mba', catalog: currentCatalog, resource, onClose() {}, onSelectResource() {},
  })))
  await runtime.act(async () => { await new Promise(resolve => setTimeout(resolve, 15)) })
}

test('salvar somente progresso mantém iframe, anotações, fetches e blobs do gerador aberto', async () => {
  await render(catalog)
  const frame = document.querySelector('iframe')
  assert.ok(frame)
  const frameWindow = frame.contentWindow
  const notes = frame.contentDocument.createElement('input')
  notes.value = 'Diagnóstico em preenchimento'
  frame.contentDocument.body.append(notes)
  const fetchCount = requests.length
  const blobCount = created.length
  assert.equal(fetchCount, 2, 'HTML e vídeo local foram buscados')
  assert.equal(blobCount, 1, 'O vídeo usa um blob autenticado')

  // Mesmo shape produzido por setQueryData quando a gravação do checklist termina.
  await render({ ...catalog, completedStepIds: ['etapa-1'] })
  assert.ok(document.querySelector('iframe') === frame, 'O iframe não deve ser recriado ao salvar progresso')
  assert.ok(frame.contentWindow === frameWindow, 'A janela do material deve ser preservada')
  assert.equal(notes.isConnected, true)
  assert.equal(notes.value, 'Diagnóstico em preenchimento')
  assert.equal(requests.length, fetchCount)
  assert.equal(created.length, blobCount)
  assert.equal(revoked.length, 0)
  assert.ok(requests.every(request => !request.options.signal.aborted))

  // Uma mudança real de material continua cancelando e liberando o anterior.
  await render({ ...catalog, completedStepIds: ['etapa-1'] }, resources[2])
  assert.ok(requests[0].options.signal.aborted)
  assert.ok(revoked.includes(created[0]))
  assert.equal(requests.length, fetchCount + 1)
  assert.match(document.querySelector('iframe').src, /^blob:fixture\//)
  await runtime.act(async () => root.unmount())
  root = null
  assert.deepEqual(revoked, created)
})
