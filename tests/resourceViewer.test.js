import test from 'node:test'
import assert from 'node:assert/strict'
import { gzipSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import {
  VIEWER_SANDBOX, createObjectUrlScope, isViewerMessage,
  resolveResourceHref, safeExternalUrl, prepareResourceHtml, renderMarkdown,
} from '../src/components/onboarding/resourceViewer.js'

const files = [
  { id: 'home', path: 'site/index.html' },
  { id: 'diagnostic', path: 'site/diagnostico/index.html' },
  { id: 'generator', path: 'site/diagnostico/gerador.html' },
  { id: 'pdf', path: 'site/pdf/ementa.pdf' },
  { id: 'ebook', path: 'site/ebooks/ia-no-dia-a-dia-04-ti-dev-suporte.pdf' },
  { id: 'video', path: 'site/deck/reportagens-ia.mp4' },
  { id: 'script', path: 'conteudo/03_script_venda_direta_devclub_v2.md' },
]
const catalog = { files, resources: files.map(file => ({ id: file.id, title: file.id, file: { id: file.id } })) }
const resolve = (href, basePath = 'site/index.html', anchors = []) => resolveResourceHref(href, { catalog, basePath, anchors })

test('link externo aceita apenas HTTP(S) explícito sem credenciais nem caracteres ambíguos', () => {
  assert.equal(safeExternalUrl('https://drive.google.com/file/d/123/view'), 'https://drive.google.com/file/d/123/view')
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '//example.test', 'https://user:password@example.test', 'https://example.test/\nfile', 'https://example.test\\@other.test', '/api/private', ' https://example.test', 'https://example.test/a b']) assert.equal(safeExternalUrl(url), null, url)
})

test('links relativos usam a pasta do arquivo atual e IDs autorizados', () => {
  assert.equal(resolve('./reportagens-ia.mp4', 'site/deck/apresentacao.html').resource.id, 'video')
  assert.equal(resolve('../ebooks/ia-no-dia-a-dia-04-ti-dev-suporte.pdf', 'site/diagnostico/gerador.html').resource.id, 'ebook')
  assert.equal(resolve('pdf/ementa.pdf').resource.id, 'pdf')
})

test('diretórios e retorno com âncora abrem index.html correspondente', () => {
  assert.equal(resolve('diagnostico/').resource.id, 'diagnostic')
  assert.deepEqual(resolve('../#materiais', 'site/materiais/scripts.html'), { kind: 'resource', resource: catalog.resources[0], anchor: 'materiais' })
})

test('Markdown reconhece caminhos site/pdf e site/diagnostico da fonte', () => {
  assert.equal(resolve('pdf/ementa.pdf', 'conteudo/01_roteiro.md').resource.id, 'pdf')
  assert.equal(resolve('diagnostico/gerador.html', 'conteudo/03_sessao.md').resource.id, 'generator')
  assert.equal(resolve('03_script_venda_direta_devclub_v2.md', 'site/index.html').resource.id, 'script')
})

test('host legado só ganha acesso local para arquivo presente no catálogo', () => {
  assert.equal(resolve('https://onboarding-mba.site-onboarding.workers.dev/diagnostico/gerador.html').resource.id, 'generator')
  assert.equal(resolve('https://onboarding-mba.site-onboarding.workers.dev/segredo.pdf'), null)
  assert.equal(resolve('https://onboarding-mba.site-onboarding.workers.dev.evil.test/diagnostico/gerador.html').kind, 'external')
  assert.equal(resolve('https://user:password@onboarding-mba.site-onboarding.workers.dev/diagnostico/gerador.html'), null)
})

test('links desconhecidos, travessia sem alvo autorizado e protocolos ativos não viram arquivos', () => {
  for (const href of ['../../../private/token', '/api/onboarding/other/files/secret', '../ebooks/nao-catalogado.pdf', 'javascript:alert(1)', 'data:text/html,hello', 'file:///etc/passwd', '/%E0%A4%A', 'https://example.test/\nfile']) assert.equal(resolve(href), null, href)
})

test('âncoras locais precisam existir; scripts do guia abrem o Markdown correspondente', () => {
  assert.deepEqual(resolve('#regras', 'site/index.html', ['regras']), { kind: 'anchor', anchor: 'regras' })
  assert.equal(resolve('#desconhecida'), null)
  assert.equal(resolve('#s-venda').resource.id, 'script')
  assert.equal(resolve('#s-venda', 'site/diagnostico/index.html'), null)
  assert.equal(resolve('#%E0%A4%A'), null)
})

test('arquivo de mídia autorizado pode existir sem card de recurso', () => {
  const result = resolveResourceHref('./reportagens-ia.mp4', { catalog: { files, resources: [] }, basePath: 'site/deck/index.html' })
  assert.equal(result.kind, 'file')
  assert.equal(result.file.id, 'video')
})

test('mensagem deve vir do iframe atual, origem opaca e canal da abertura atual', () => {
  const frame = {}
  const valid = { source: frame, origin: 'null', data: { type: 'onboarding-resource-link', channel: 'session', href: '../pdf/ementa.pdf' } }
  assert.equal(isViewerMessage(valid, frame, 'session'), true)
  for (const patch of [{ source: {} }, { origin: 'https://other.test' }, { data: { ...valid.data, channel: 'old' } }, { data: { ...valid.data, href: { path: 'x' } } }, { data: { ...valid.data, href: 'x'.repeat(4097) } }, { data: { ...valid.data, type: 'fetch-with-token' } }]) assert.equal(isViewerMessage({ ...valid, ...patch }, frame, 'session'), false)
})

test('cleanup revoga cada blob, é idempotente e impede criar URL após cancelamento', () => {
  const revoked = []
  let count = 0
  const scope = createObjectUrlScope({ createObjectURL: () => `blob:fixture/${++count}`, revokeObjectURL: url => revoked.push(url) })
  assert.equal(scope.create({}), 'blob:fixture/1')
  assert.equal(scope.create({}), 'blob:fixture/2')
  scope.dispose(); scope.dispose()
  assert.deepEqual(revoked, ['blob:fixture/1', 'blob:fixture/2'])
  assert.throws(() => scope.create({}), { name: 'AbortError' })
})

test('sandbox mantém scripts, impressão e backup sem conceder origem do Dashboard', () => {
  const permissions = VIEWER_SANDBOX.split(' ')
  assert.ok(permissions.includes('allow-scripts'))
  assert.ok(permissions.includes('allow-downloads'))
  assert.ok(permissions.includes('allow-modals'))
  assert.ok(!permissions.includes('allow-same-origin'))
  assert.ok(!permissions.some(permission => permission.startsWith('allow-top-navigation')))
})


test('Markdown elimina scripts, eventos e links executáveis antes de entrar no Dashboard', () => {
  const dom = new JSDOM('')
  try {
    const html = renderMarkdown('# Roteiro\n\n<script>window.bad=true</script>\n\n<img src=x onerror="alert(1)">\n\n[Link](javascript:alert(1))', dom.window)
    const document = new dom.window.DOMParser().parseFromString(html, 'text/html')
    assert.equal(document.querySelector('script, [onerror], a[href^="javascript:"]'), null)
    assert.equal(document.querySelector('h1').textContent, 'Roteiro')
  } finally { dom.window.close() }
})

test('HTML renderiza Markdown no parent, mantém JS original isolado e autentica só mídia catalogada', async () => {
  const dom = new JSDOM('')
  const loaded = []
  try {
    const result = await prepareResourceHtml({
      html: '<html><head><base href="https://other.test/"><link rel="stylesheet" href="https://fonts.example.test"><script src="https://cdn.example.test/marked.js"></script></head><body><div id="script-body"></div><script type="text/markdown" data-target="script-body">## Conteúdo\n\nTexto seguro</script><video src="deck/reportagens-ia.mp4"></video><img src="https://other.test/image.jpg"><script>window.original=true</script></body></html>',
      catalog, resource: catalog.resources[0], loadFile: async file => { loaded.push(file.id); return `blob:fixture/${file.id}` },
      createObjectURL: () => 'blob:fixture/embedded', channel: 'test', parentOrigin: 'https://dashboard.test', browserWindow: dom.window,
    })
    const document = new dom.window.DOMParser().parseFromString(result.html, 'text/html')
    assert.equal(document.querySelector('base, link, script[src], script[type="text/markdown"]'), null)
    assert.equal(document.querySelector('#script-body h2').textContent, 'Conteúdo')
    assert.equal(document.querySelector('video').getAttribute('src'), 'blob:fixture/video')
    assert.equal(document.querySelector('img').hasAttribute('src'), false)
    assert.deepEqual(loaded, ['video'])
    assert.ok([...document.scripts].some(script => script.textContent.includes('window.original=true')))
    const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]').content
    assert.match(csp, /connect-src blob:/)
    assert.match(csp, /form-action 'none'/)
    assert.ok(!csp.includes('https:'))
  } finally { dom.window.close() }
})

test('apresentação empacotada preserva script/fontes e reescreve o vídeo local depois de abrir o template', async () => {
  const dom = new JSDOM('')
  const loaded = []
  try {
    const manifest = { 'font-asset': { data: gzipSync('font-data').toString('base64'), compressed: true, mime: 'font/woff2' } }
    const template = '<html><head><style>@font-face{font-family:Deck;src:url(font-asset)}</style></head><body><video src="./reportagens-ia.mp4"></video><script>window.slide=1</script></body></html>'
    const deckFile = { id: 'deck', path: 'site/deck/deck.html' }
    const deck = { id: 'deck', file: { id: 'deck' } }
    const result = await prepareResourceHtml({
      html: `<script type="__bundler/manifest">${JSON.stringify(manifest)}</script><script type="__bundler/template">${JSON.stringify(template).replace(/</g, '\\u003c')}</script>`,
      catalog: { files: [...files, deckFile], resources: [...catalog.resources, deck] }, resource: deck,
      loadFile: async file => { loaded.push(file.id); return 'blob:fixture/video' }, createObjectURL: () => 'blob:fixture/embed',
      channel: 'test', parentOrigin: 'https://dashboard.test', browserWindow: dom.window,
    })
    assert.deepEqual(loaded, ['video'])
    assert.ok(result.html.includes('data:font/woff2;base64,'))
    assert.ok(result.html.includes('window.slide=1'))
    assert.ok(result.html.includes('blob:fixture/video'))
    assert.ok(!result.html.includes('__bundler/manifest'))
  } finally { dom.window.close() }
})

test('bridge captura e-books criados dinamicamente sem permitir URL arbitrária virar fetch', async () => {
  const parser = new JSDOM('')
  let dom
  const messages = []
  try {
    const html = '<html><body><button id="create">Criar link</button><script>document.getElementById("create").onclick=()=>{const a=document.createElement("a");a.id="ebook";a.href="../ebooks/ia-no-dia-a-dia-04-ti-dev-suporte.pdf";a.textContent="E-book";document.body.append(a)}</script></body></html>'
    const prepared = await prepareResourceHtml({ html, catalog, resource: catalog.resources.find(resource => resource.id === 'generator'),
      loadFile: async () => { throw new Error('Links não são carregados antecipadamente') }, createObjectURL: () => 'blob:fixture/embed',
      channel: 'test', parentOrigin: 'https://dashboard.test', browserWindow: parser.window,
    })
    dom = new JSDOM(prepared.html, { url: 'https://dashboard.test', runScripts: 'dangerously', beforeParse(window) {
      window.postMessage = message => messages.push(message)
      window.HTMLElement.prototype.scrollIntoView = () => {}
    } })
    dom.window.document.getElementById('create').click()
    dom.window.document.getElementById('ebook').click()
    const message = messages.find(message => message.type === 'onboarding-resource-link')
    assert.equal(message.channel, 'test')
    assert.equal(resolve(message.href, 'site/diagnostico/gerador.html').resource.id, 'ebook')
  } finally { dom?.window.close(); parser.window.close() }
})
