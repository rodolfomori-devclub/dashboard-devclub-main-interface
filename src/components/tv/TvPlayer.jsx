import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import { TvPanel } from './TvPanels.jsx'
import { activeTvPanels, TV_METRICS, TV_PANELS, tvMonthLabel } from './tvConfig.js'

export function TvPlayer({ settings, data, onClose }) {
  const panels = useMemo(() => activeTvPanels(settings), [settings])
  const [index, setIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [visible, setVisible] = useState(!document.hidden)
  const [height, setHeight] = useState(window.innerHeight)
  const container = useRef(null)
  const active = panels[index % panels.length] || panels[0]
  const advance = useCallback(direction => { setIndex(old => (old + direction + panels.length) % panels.length); setElapsed(0) }, [panels.length])
  const rotating = settings.mode === 'rotate' && panels.length > 1

  useEffect(() => { setIndex(0); setElapsed(0) }, [panels])
  useEffect(() => {
    if (!rotating || paused || !visible || data.loading || !active) return
    const timer = window.setInterval(() => setElapsed(old => old + 1), 1000)
    return () => window.clearInterval(timer)
  }, [rotating, paused, visible, data.loading, active])
  useEffect(() => { if (active && elapsed >= active.durationSeconds) advance(1) }, [elapsed, active, advance])
  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    container.current?.focus()
    const visibility = () => setVisible(!document.hidden)
    const resize = () => setHeight(window.innerHeight)
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('resize', resize)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('resize', resize)
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])
  const keys = event => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.defaultPrevented) return
    if (event.key === 'Tab') {
      const focusable = [...container.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')]
      const first = focusable[0], last = focusable.at(-1)
      if (event.shiftKey && (document.activeElement === first || document.activeElement === container.current)) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === container.current)) { event.preventDefault(); first?.focus() }
      return
    }
    if (event.target.closest('button,input,select,textarea,[role="group"],[contenteditable="true"]')) return
    if (event.key === 'ArrowRight' && panels.length > 1) { event.preventDefault(); advance(1) }
    if (event.key === 'ArrowLeft' && panels.length > 1) { event.preventDefault(); advance(-1) }
    if (event.code === 'Space' && rotating) { event.preventDefault(); setPaused(old => !old) }
  }
  const title = TV_PANELS.find(panel => panel.id === active?.id)?.title || 'TV Mode'
  return createPortal(<div ref={container} tabIndex={-1} role="dialog" aria-modal="true" aria-label="TV Mode em apresentação" className="tv-surface tv-player" data-testid="tv-player" data-tv-theme={settings.theme} data-metric={settings.metric} data-panel-id={active?.id} onKeyDown={keys}>
    <header className="tv-broadcast-header"><div className="tv-broadcast-brand"><span className="tv-live-dot"/>DevClub <span>Workspace / TV</span></div><div className="tv-broadcast-context"><span>{tvMonthLabel(data.model?.month || settings.month)}</span><span>{TV_METRICS[settings.metric]}</span></div><button className="tv-icon-button" aria-label="Sair da TV" onClick={onClose}><X size={22}/></button></header>
    <main className="tv-broadcast-main"><div className="tv-scene-heading"><span className="tv-eyebrow">{String((index % panels.length) + 1).padStart(2, '0')} / {String(panels.length).padStart(2, '0')}</span><h1>{title}</h1>{data.refreshing && <span className="tv-refresh-label" role="status">Atualizando…</span>}</div><div key={active?.id} className="tv-scene"><TvPanel panelId={active?.id} model={data.model} loading={data.loading} chartHeight={Math.max(230, Math.min(620, height - 520))}/></div></main>
    <footer className="tv-broadcast-footer"><div className="tv-source-status">{data.error ? <span role="status">{data.error}</span> : <><span className="tv-live-dot"/>{data.updatedAt ? `Leitura às ${new Date(data.updatedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}` : 'Aguardando dados'}{data.model?.totals.partial && ' · dados parciais'}</>}</div><div className="tv-playback-controls"><button className="tv-icon-button" aria-label="Painel anterior" disabled={panels.length < 2} onClick={() => advance(-1)}><ChevronLeft size={23}/></button><button className="tv-icon-button" aria-label={paused ? 'Retomar apresentação' : 'Pausar apresentação'} disabled={!rotating} onClick={() => setPaused(old => !old)}>{paused || !rotating ? <Play size={19}/> : <Pause size={19}/>}</button><button className="tv-icon-button" aria-label="Próximo painel" disabled={panels.length < 2} onClick={() => advance(1)}><ChevronRight size={23}/></button><span className="tv-countdown">{!rotating ? 'Painel fixo' : paused ? 'Pausado' : `${Math.max(0, active.durationSeconds - elapsed)}s`}</span></div></footer>
    <div className="tv-player-progress" aria-hidden="true"><i style={{ width: rotating ? `${Math.min(100, elapsed / active.durationSeconds * 100)}%` : '100%' }}/></div>
  </div>, document.body)
}
