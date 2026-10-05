import { marked } from 'marked'
import createDOMPurify from 'dompurify'

export const VIEWER_SANDBOX = 'allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox allow-modals'
const unsafeCharacters = (value, includeSpace = false) => value.includes('\\') || [...value].some(character => character.charCodeAt(0) < (includeSpace ? 33 : 32))
const LOCAL_ORIGIN = 'https://onboarding-files.invalid'
const LEGACY_ORIGIN = 'https://onboarding-mba.site-onboarding.workers.dev'
const SCRIPT_ANCHORS = {
  's-prevenda': '01_script_pre_venda_devclub_v7.md',
  's-sessao': '02_script_sessao_estrategica_devclub_v2.md',
  's-venda': '03_script_venda_direta_devclub_v2.md',
  's-objecoes': '04_objecoes_devclub_v2.md',
  's-cadencia': '05_cadencia_devclub_v2.md',
  's-exaluno': '06_ex_aluno_e_renovacao.md',
  's-50k': '07_operacao_50k_guia_comercial.md',
  whatsapp: '01_roteiro_whatsapp_abordagem_mba.md',
  pitch: '02_pitch_oferta_ancoragem_mba.md',
  sessao: '03_sessao_diagnostico_passo_a_passo.md',
}

export function safeExternalUrl(value) {
  if (typeof value !== 'string' || unsafeCharacters(value, true) || !/^https?:\/\//i.test(value)) return null
  try {
    const url = new URL(value)
    return !url.username && !url.password && ['https:', 'http:'].includes(url.protocol) ? url.href : null
  } catch { return null }
}

export function catalogFiles(catalog) {
  return catalog?.files || catalog?.assets || []
}

export function resourceFile(catalog, resource) {
  return catalogFiles(catalog).find(file => file.id === resource?.file?.id) || null
}

export function resourceForFile(catalog, file) {
  return catalog?.resources?.find(resource => resource.file?.id === file.id) || null
}

function decodeAnchor(value) {
  try { return decodeURIComponent(value.replace(/^#/, '')) } catch { return '' }
}

/** Only paths present in the authorized catalog can become authenticated fetches. */
export function resolveResourceHref(href, { catalog, resource, basePath, anchors = [] }) {
  if (typeof href !== 'string' || !href.trim() || unsafeCharacters(href)) return null
  const value = href.trim()
  const files = catalogFiles(catalog)
  const currentPath = basePath || resourceFile(catalog, resource)?.path || 'site/index.html'
  const toResource = (file, anchor = '') => {
    const target = resourceForFile(catalog, file)
    return target ? { kind: 'resource', resource: target, anchor } : { kind: 'file', file, anchor }
  }
  if (value.startsWith('#')) {
    const anchor = decodeAnchor(value)
    if (!anchor) return null
    if (currentPath === 'site/index.html' && SCRIPT_ANCHORS[anchor]) {
      const file = files.find(file => file.path === `conteudo/${SCRIPT_ANCHORS[anchor]}`)
      if (file) return toResource(file)
    }
    return anchors.includes(anchor) ? { kind: 'anchor', anchor } : null
  }
  let url
  try { url = new URL(value, `${LOCAL_ORIGIN}/${currentPath}`) } catch { return null }
  if (![LOCAL_ORIGIN, LEGACY_ORIGIN].includes(url.origin)) {
    const external = safeExternalUrl(value)
    return external ? { kind: 'external', url: external } : null
  }
  if (url.username || url.password) return null
  let pathname
  try { pathname = decodeURIComponent(url.pathname).replace(/^\//, '') } catch { return null }
  if (url.origin === LEGACY_ORIGIN) pathname = `site/${pathname}`
  const anchor = decodeAnchor(url.hash)
  const candidates = [pathname.endsWith('/') ? `${pathname}index.html` : pathname]
  if (currentPath.startsWith('conteudo/')) {
    const sitePath = decodeURIComponent(new URL(value, `${LOCAL_ORIGIN}/site/index.html`).pathname).replace(/^\//, '')
    candidates.push(sitePath.endsWith('/') ? `${sitePath}index.html` : sitePath)
  }
  if (value.startsWith('site/') || value.startsWith('conteudo/')) candidates.push(value.split(/[?#]/)[0])
  let file = files.find(file => candidates.includes(file.path))
  // Original embedded scripts refer to sibling Markdown files from site/index.html.
  // This alias is deliberately limited to a unique, cataloged Markdown basename.
  if (!file && /^[^/]+\.md(?:#.*)?$/.test(value)) {
    const matches = files.filter(file => file.path === `conteudo/${pathname.split('/').at(-1)}`)
    if (matches.length === 1) file = matches[0]
  }
  if (!file) return null
  if (file.path === currentPath && anchor && anchors.includes(anchor)) return { kind: 'anchor', anchor }
  return toResource(file, anchor)
}

export function renderMarkdown(source, browserWindow = window) {
  return createDOMPurify(browserWindow).sanitize(marked.parse(String(source || ''), { async: false }), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'srcset'],
  })
}

export function createObjectUrlScope(urlApi = URL) {
  const urls = new Set()
  let disposed = false
  return {
    create(blob) {
      if (disposed) throw new DOMException('Material fechado.', 'AbortError')
      const url = urlApi.createObjectURL(blob)
      urls.add(url)
      return url
    },
    dispose() {
      disposed = true
      for (const url of urls) urlApi.revokeObjectURL(url)
      urls.clear()
    },
  }
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('Carregamento cancelado.', 'AbortError')
}

/** Unpack the supplied presentation before rewriting its local video references. */
async function unpackPresentation(document, createObjectURL, signal, browserWindow) {
  const template = document.querySelector('script[type="__bundler/template"]')
  const manifest = document.querySelector('script[type="__bundler/manifest"]')
  if (!template || !manifest) return document
  const pages = document.querySelector('script[type="__bundler/page_order"]')
  if (pages && JSON.parse(pages.textContent).length) throw new Error('Esta apresentação contém páginas que precisam de uma nova versão do visualizador.')
  let html = JSON.parse(template.textContent)
  const entries = Object.entries(JSON.parse(manifest.textContent))
  for (const [id, asset] of entries) {
    abortIfNeeded(signal)
    if (!/^[a-zA-Z0-9-]+$/.test(id) || typeof asset.data !== 'string' || typeof asset.mime !== 'string') throw new Error('Arquivo da apresentação inválido.')
    const binary = atob(asset.data)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    let blob = new Blob([bytes], { type: asset.mime })
    if (asset.compressed) {
      if (typeof DecompressionStream === 'undefined') throw new Error('Atualize seu navegador para abrir esta apresentação.')
      blob = new Blob([await new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()], { type: asset.mime })
    }
    abortIfNeeded(signal)
    let url
    if (/^(font\/|application\/(font-|x-font-))/.test(asset.mime)) {
      const data = new Uint8Array(await blob.arrayBuffer())
      let text = ''
      for (let index = 0; index < data.length; index += 8192) text += String.fromCharCode(...data.subarray(index, index + 8192))
      url = `data:${asset.mime};base64,${btoa(text)}`
    } else url = createObjectURL(blob)
    html = html.split(id).join(url)
  }
  return new browserWindow.DOMParser().parseFromString(html, 'text/html')
}

const scriptLiteral = value => JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')

function bridgeScript({ channel, parentOrigin, initialAnchor }) {
  // No credentials, API URLs, account data or storage bridge enter the iframe.
  // The parent validates every requested link against its authorized catalog.
  return `(() => {
    const channel = ${scriptLiteral(channel)};
    const parentOrigin = ${scriptLiteral(parentOrigin)};
    const send = href => parent.postMessage({type:'onboarding-resource-link',channel,href}, parentOrigin);
    const jump = anchor => {
      const node = document.getElementById(anchor);
      if (!node) return;
      const details = node.closest('details'); if (details) details.open = true;
      node.scrollIntoView({block:'start'});
    };
    document.addEventListener('click', event => {
      const link = event.target.closest?.('a[href]'); if (!link) return;
      const href = link.getAttribute('href'); if (!href) return;
      if (href.startsWith('blob:') && link.hasAttribute('download')) return;
      if (/^https?:\\/\\//i.test(href) && !href.startsWith(${JSON.stringify(`${LEGACY_ORIGIN}/`)})) {
        try { const url = new URL(href); if (url.username || url.password) { event.preventDefault(); return; } } catch { event.preventDefault(); return; }
        link.target = '_blank'; link.rel = 'noopener noreferrer'; return;
      }
      event.preventDefault(); event.stopImmediatePropagation(); send(href);
    }, true);
    window.addEventListener('message', event => {
      if (event.source !== parent || event.origin !== parentOrigin || event.data?.channel !== channel) return;
      if (event.data.type === 'onboarding-resource-anchor' && typeof event.data.anchor === 'string') jump(event.data.anchor);
    });
    const ready = () => { jump(${scriptLiteral(initialAnchor || '')}); parent.postMessage({type:'onboarding-resource-ready',channel}, parentOrigin); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready, {once:true}); else ready();
  })();`
}

/** Prepare trusted source HTML for an opaque-origin sandbox, never the parent DOM. */
export async function prepareResourceHtml({ html, catalog, resource, loadFile, createObjectURL, signal, channel, parentOrigin, anchor = '', browserWindow = window }) {
  let document = new browserWindow.DOMParser().parseFromString(html, 'text/html')
  document = await unpackPresentation(document, createObjectURL, signal, browserWindow)
  const basePath = resourceFile(catalog, resource)?.path || 'site/index.html'
  const anchors = [...document.querySelectorAll('[id]')].map(node => node.id)
  const hasLocalStorage = /\blocalStorage\b/.test(document.documentElement.outerHTML)
  document.querySelectorAll('base, meta[http-equiv], script[src], link').forEach(node => node.remove())
  for (const source of document.querySelectorAll('script[type="text/markdown"]')) {
    const target = document.getElementById(source.dataset.target)
    if (target) target.innerHTML = renderMarkdown(source.textContent, browserWindow)
    source.remove()
  }
  const media = [...document.querySelectorAll('img[src], video[src], audio[src], source[src], track[src], video[poster]')]
  const loaded = new Map()
  for (const node of media) {
    for (const attribute of ['src', 'poster']) {
      const value = node.getAttribute(attribute)
      if (!value || /^(data:|blob:)/i.test(value)) continue
      const destination = resolveResourceHref(value, { catalog, resource, basePath })
      const file = destination?.kind === 'resource' ? resourceFile(catalog, destination.resource) : destination?.kind === 'file' ? destination.file : null
      if (!file) { node.removeAttribute(attribute); continue }
      if (!loaded.has(file.id)) loaded.set(file.id, Promise.resolve(loadFile(file)))
      node.setAttribute(attribute, await loaded.get(file.id))
      node.removeAttribute('crossorigin')
      node.removeAttribute('integrity')
      abortIfNeeded(signal)
    }
  }
  document.querySelectorAll('[srcset]').forEach(node => node.removeAttribute('srcset'))
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href')
    const destination = resolveResourceHref(href, { catalog, resource, basePath, anchors })
    if (destination?.kind === 'external') { link.target = '_blank'; link.rel = 'noopener noreferrer' }
    else if (!destination && !href.startsWith('#')) { link.removeAttribute('href'); link.setAttribute('title', 'Material não disponível nesta biblioteca.') }
  })
  const policy = document.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = "default-src 'none'; script-src 'unsafe-inline' blob:; style-src 'unsafe-inline'; img-src blob: data:; font-src blob: data:; media-src blob: data:; connect-src blob:; frame-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'"
  const bridge = document.createElement('script')
  bridge.textContent = bridgeScript({ channel, parentOrigin, initialAnchor: anchors.includes(anchor) ? anchor : '' })
  document.head.prepend(bridge)
  document.head.prepend(policy)
  abortIfNeeded(signal)
  return { html: `<!doctype html>\n${document.documentElement.outerHTML}`, anchors, hasLocalStorage }
}

export function isViewerMessage(event, frameWindow, channel) {
  return event.source === frameWindow && event.origin === 'null' && event.data?.channel === channel
    && ['onboarding-resource-link', 'onboarding-resource-ready'].includes(event.data?.type)
    && (event.data.type !== 'onboarding-resource-link' || (typeof event.data.href === 'string' && event.data.href.length <= 4096))
}
