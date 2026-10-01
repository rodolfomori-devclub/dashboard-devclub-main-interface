/* eslint-disable react/prop-types -- Internal, shared notification list. */
import { useEffect, useRef } from 'react'
import { Bell, CircleAlert, Info } from 'lucide-react'
import './revenueHighlights.css'

export default function RevenueNotifications({ items = [] }) {
  const ref = useRef(null)
  const notices = [...new Map(items.filter(Boolean).map(item => [item.id, item])).values()]
  useEffect(() => {
    const close = event => { if (ref.current && !ref.current.contains(event.target)) ref.current.open = false }
    const escape = event => { if (event.key === 'Escape' && ref.current?.open) { ref.current.open = false; ref.current.querySelector('summary')?.focus() } }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [])
  return <details ref={ref} className="revenue-notifications">
    <summary aria-label={`Notificações${notices.length ? ` (${notices.length})` : ''}`}><Bell size={17} aria-hidden="true" /><span>Notificações</span>{notices.length > 0 && <b>{notices.length}</b>}</summary>
    <section className="revenue-notifications-panel" aria-label="Notificações dos dados"><header><h2>Notificações dos dados</h2><p>Cobertura das fontes e regras deste recorte.</p></header>
      {notices.length ? <ul>{notices.map(item => <li key={item.id} className={item.tone === 'warning' ? 'is-warning' : ''}>{item.tone === 'warning' ? <CircleAlert size={18} aria-hidden="true" /> : <Info size={18} aria-hidden="true" />}<div><h3>{item.title}</h3><p>{item.message}</p></div></li>)}</ul> : <p className="revenue-notifications-empty">Nenhum aviso para este recorte.</p>}
    </section>
  </details>
}
