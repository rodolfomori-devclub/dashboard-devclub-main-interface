/* eslint-disable react/prop-types -- Resources and files come from the authorized onboarding catalog. */
import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Download, ExternalLink, LoaderCircle, RefreshCw, X } from 'lucide-react'
import { API_URL, apiFetch } from '../../lib/api'
import {
  VIEWER_SANDBOX, createObjectUrlScope, isViewerMessage, prepareResourceHtml,
  renderMarkdown, resolveResourceHref, resourceFile, safeExternalUrl,
} from './resourceViewer.js'
import './resourceViewer.css'

const FORMATS = { html: 'Material interativo', markdown: 'Roteiro de consulta', pdf: 'Documento PDF', mp4: 'Vídeo', link: 'Material externo' }

export default function ResourceViewer({ track, catalog, resource, anchor = '', onClose, onSelectResource }) {
  const [content, setContent] = useState(null)
  const [error, setError] = useState('')
  const [navigationError, setNavigationError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const iframe = useRef(null)
  const article = useRef(null)
  const channel = useRef(crypto.randomUUID())
  const currentCallbacks = useRef({ onSelectResource })
  currentCallbacks.current = { onSelectResource }
  const currentAnchor = useRef(anchor)
  currentAnchor.current = (anchor || '').replace(/^#/, '')
  const externalUrl = resource.format === 'link' ? safeExternalUrl(resource.url) : null

  useEffect(() => {
    const controller = new AbortController()
    const scope = createObjectUrlScope()
    const blobs = new Map()
    let live = true
    setContent(null); setError(''); setNavigationError('')
    const getBlob = async file => {
      if (!file?.id) throw new Error('Este arquivo não está disponível na biblioteca.')
      if (!blobs.has(file.id)) blobs.set(file.id, (async () => {
        const response = await apiFetch(`${API_URL}/onboarding/${encodeURIComponent(track)}/files/${encodeURIComponent(file.id)}`, {
          signal: controller.signal, cache: 'no-store',
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || data.message || (response.status === 403 ? 'Você não tem acesso a este material.' : 'Não foi possível carregar este material. Tente novamente.'))
        }
        const blob = await response.blob()
        if (controller.signal.aborted) throw new DOMException('Carregamento cancelado.', 'AbortError')
        return new Blob([blob], { type: file.mimeType || blob.type })
      })())
      return blobs.get(file.id)
    }
    const fileUrls = new Map()
    const loadFile = async file => {
      if (!fileUrls.has(file.id)) fileUrls.set(file.id, getBlob(file).then(blob => scope.create(blob)))
      return fileUrls.get(file.id)
    }
    const load = async () => {
      try {
        let next
        if (resource.format === 'link') {
          if (!safeExternalUrl(resource.url)) throw new Error('O endereço deste material não é válido.')
          next = { kind: 'link' }
        } else {
          const file = resourceFile(catalog, resource)
          if (!file) throw new Error('O arquivo não está no catálogo de materiais disponíveis para você.')
          if (resource.format === 'markdown') {
            const source = typeof resource.markdown === 'string' ? resource.markdown : await (await getBlob(file)).text()
            const document = new DOMParser().parseFromString(renderMarkdown(source), 'text/html')
            document.querySelectorAll('img').forEach(node => node.remove())
            document.querySelectorAll('a[href]').forEach(link => {
              const url = safeExternalUrl(link.getAttribute('href'))
              if (url) { link.target = '_blank'; link.rel = 'noopener noreferrer' }
            })
            next = { kind: 'markdown', html: document.body.innerHTML, anchors: [...document.querySelectorAll('[id]')].map(node => node.id) }
          } else if (resource.format === 'html') {
            const html = await (await getBlob(file)).text()
            next = { kind: 'html', ...await prepareResourceHtml({
              html, catalog, resource, loadFile, createObjectURL: scope.create, signal: controller.signal,
              channel: channel.current, parentOrigin: window.location.origin, anchor: currentAnchor.current,
            }) }
          } else if (['pdf', 'mp4'].includes(resource.format)) {
            next = { kind: resource.format, url: await loadFile(file), filename: resource.file.name || file.name || file.filename }
          } else throw new Error('Este formato ainda não está disponível no visualizador.')
        }
        if (live && !controller.signal.aborted) setContent(next)
      } catch (failure) {
        if (live && !controller.signal.aborted) setError(failure.message || 'Não foi possível abrir este material.')
      }
    }
    load()
    return () => { live = false; controller.abort(); scope.dispose() }
  }, [track, catalog, resource, attempt])

  useEffect(() => {
    const currentFrame = iframe.current?.contentWindow
    if (content?.kind !== 'html' || !currentFrame) return
    const sendAnchor = value => {
      if (content.anchors.includes(value)) currentFrame.postMessage({ type: 'onboarding-resource-anchor', channel: channel.current, anchor: value }, '*')
    }
    const receive = event => {
      if (!isViewerMessage(event, currentFrame, channel.current)) return
      if (event.data.type === 'onboarding-resource-ready') { sendAnchor(currentAnchor.current); return }
      const destination = resolveResourceHref(event.data.href, { catalog, resource, anchors: content.anchors })
      if (destination?.kind === 'resource') currentCallbacks.current.onSelectResource(destination.resource.id, destination.anchor)
      else if (destination?.kind === 'anchor') sendAnchor(destination.anchor)
      else setNavigationError('Esse link não está disponível nesta biblioteca. Consulte a liderança para confirmar o material.')
    }
    window.addEventListener('message', receive)
    sendAnchor(currentAnchor.current)
    return () => window.removeEventListener('message', receive)
  }, [content, catalog, resource, anchor])

  useEffect(() => {
    if (content?.kind !== 'markdown' || !currentAnchor.current) return
    const target = [...(article.current?.querySelectorAll('[id]') || [])].find(node => node.id === currentAnchor.current)
    target?.scrollIntoView?.({ block: 'start' })
  }, [content, anchor])

  const followMarkdownLink = event => {
    const link = event.target.closest('a[href]')
    if (!link) return
    const destination = resolveResourceHref(link.getAttribute('href'), { catalog, resource, anchors: content?.anchors || [] })
    if (destination?.kind === 'external') return
    event.preventDefault()
    if (destination?.kind === 'resource') onSelectResource(destination.resource.id, destination.anchor)
    else if (destination?.kind === 'anchor') [...article.current.querySelectorAll('[id]')].find(node => node.id === destination.anchor)?.scrollIntoView?.({ block: 'start' })
    else setNavigationError('Esse link não está disponível nesta biblioteca. Consulte a liderança para confirmar o material.')
  }

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
    <Dialog.Portal><Dialog.Overlay className="onboarding-viewer-overlay"/><Dialog.Content className="onboarding-viewer-dialog" aria-describedby="onboarding-viewer-description">
      <header className="onboarding-viewer-header"><div><span className="onboarding-viewer-eyebrow">{FORMATS[resource.format] || 'Material'} · {resource.audience === 'lead' ? 'Para o lead' : 'Uso interno'}</span><Dialog.Title>{resource.title}</Dialog.Title></div><Dialog.Close className="onboarding-viewer-close" aria-label="Fechar material"><X size={21}/></Dialog.Close></header>
      <Dialog.Description id="onboarding-viewer-description" className="onboarding-viewer-description">{resource.description || 'Material da biblioteca de onboarding do seu time.'}</Dialog.Description>
      {resource.reviewNote && <p className="onboarding-viewer-note"><strong>Antes de usar:</strong> {resource.reviewNote}</p>}
      {content?.hasLocalStorage && <p className="onboarding-viewer-note" role="status">As anotações desta ferramenta ficam abertas só enquanto você usa este material. Se preencher o gerador, use <strong>Baixar backup</strong> antes de fechar e <strong>Importar</strong> para continuar depois.</p>}
      {navigationError && <p className="onboarding-viewer-note" role="alert">{navigationError}</p>}
      <div className={`onboarding-viewer-body onboarding-viewer-body-${resource.format}`}>
        {error ? <div className="onboarding-viewer-state" role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={16}/>Tentar novamente</button></div>
          : !content ? <div className="onboarding-viewer-state" role="status"><LoaderCircle size={24} className="onboarding-viewer-spin"/><p>Abrindo material…</p></div>
            : content.kind === 'markdown' ? <article ref={article} className="onboarding-viewer-markdown" onClick={followMarkdownLink} dangerouslySetInnerHTML={{ __html: content.html }}/>
              : content.kind === 'html' ? <iframe ref={iframe} title={resource.title} className="onboarding-viewer-frame" srcDoc={content.html} sandbox={VIEWER_SANDBOX} allow="fullscreen; clipboard-write" allowFullScreen referrerPolicy="no-referrer"/>
                : content.kind === 'pdf' ? <iframe title={resource.title} className="onboarding-viewer-frame" src={content.url} referrerPolicy="no-referrer"/>
                  : content.kind === 'mp4' ? <video className="onboarding-viewer-video" controls preload="metadata" src={content.url} aria-label={resource.title}>Seu navegador não reproduziu o vídeo. Use o botão de download.</video>
                    : <div className="onboarding-viewer-external"><ExternalLink size={30}/><h3>Abrir material externo</h3><p>O material abre em outra aba. A ferramenta pode pedir seu login.</p><a className="button button-primary" href={externalUrl} target="_blank" rel="noopener noreferrer">Abrir {resource.title}<ExternalLink size={16}/></a></div>}
      </div>
      {content?.url && <footer className="onboarding-viewer-footer"><span>{content.kind === 'pdf' ? 'Se o PDF não aparecer, abra o arquivo pelo download.' : 'Assista aqui ou baixe o vídeo para consultar depois.'}</span><a className="button" href={content.url} download={content.filename}><Download size={16}/>{content.kind === 'pdf' ? 'Baixar PDF' : 'Baixar vídeo'}</a></footer>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>
}
