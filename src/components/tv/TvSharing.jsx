import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, ExternalLink, Link2, RefreshCw, Unlink } from 'lucide-react'
import { requestApi } from '../../lib/api.js'

export default function TvSharing() {
  const [share, setShare] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const input = useRef(null)
  const mounted = useRef(false)
  const load = useCallback(async signal => {
    try {
      const next = await requestApi('/tv/share', { signal })
      if (mounted.current) { setShare(next); setError('') }
    } catch (error) { if (mounted.current && error.name !== 'AbortError') setError(error.message) }
  }, [])
  useEffect(() => { mounted.current = true; const controller = new AbortController(); load(controller.signal); return () => { mounted.current = false; controller.abort() } }, [load])
  const url = share?.enabled && /^\/tv\/[A-Za-z0-9_-]{16}$/.test(share.path || '') ? new URL(share.path, window.location.origin).href : ''
  const change = async action => {
    if (!share || busy) return
    setBusy(true); setError(''); setMessage('')
    try {
      const next = await requestApi('/tv/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedRevision: share.revision }) })
      if (mounted.current) { setShare(next); setMessage(action === 'disable' ? 'Link desativado. Os aparelhos conectados encerrarão a exibição na próxima atualização.' : action === 'rotate' ? 'Novo link criado. O link anterior não abre mais a TV.' : 'Link público pronto para compartilhar.') }
    } catch (error) {
      if (!mounted.current) return
      if (error.code === 'TV_SHARE_CONFLICT') { await load(); if (mounted.current) setError('Outro administrador alterou o link. A versão mais recente foi carregada; tente novamente.') }
      else setError(error.message)
    } finally { if (mounted.current) setBusy(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setMessage('Link copiado.'); setError('') }
    catch { input.current?.focus(); input.current?.select(); setMessage('Não foi possível copiar automaticamente. O link está selecionado para copiar.'); }
  }
  return <section className="tv-sharing" data-testid="tv-sharing" aria-labelledby="tv-sharing-title">
    <div className="tv-sharing-heading"><Link2 size={20}/><div><h2 id="tv-sharing-title">Link público da TV</h2><p>Abre a programação atual em qualquer aparelho, sem login.</p></div><span className="tv-sharing-state" data-enabled={Boolean(url)}>{share ? url ? 'Ativo' : 'Desativado' : 'Carregando…'}</span></div>
    {url ? <><div className="tv-share-url"><input ref={input} aria-label="Endereço público da TV" readOnly value={url} onFocus={event => event.target.select()}/><button onClick={copy} disabled={busy}><Copy size={16}/>Copiar link</button><a className="tv-share-open" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={16}/>Abrir TV pública</a></div><div className="tv-share-management"><p>Quem tiver o link poderá ver estes painéis. Trocar o link invalida o anterior.</p><button onClick={() => change('rotate')} disabled={busy}><RefreshCw size={14}/>Trocar link</button><button onClick={() => change('disable')} disabled={busy}><Unlink size={14}/>Desativar link</button></div></> : share && <div className="tv-share-management"><p>Crie um endereço curto para abrir a apresentação em uma TV ou outro dispositivo.</p><button className="tv-primary" onClick={() => change('create')} disabled={busy}><Link2 size={16}/>{busy ? 'Criando…' : 'Criar link público'}</button></div>}
    {busy && url && <p role="status" className="tv-sharing-message">Atualizando link…</p>}
    {message && <p role="status" className="tv-sharing-message">{message}</p>}
    {error && <div role="alert" className="tv-notice">{error}{!share && <button disabled={busy} onClick={() => load()}>Tentar novamente</button>}</div>}
  </section>
}
