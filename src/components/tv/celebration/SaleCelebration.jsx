/* eslint-disable react/prop-types -- Internal React 19 presentation with the explicit sale contract below. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { BadgeCheck, PartyPopper, Trophy, X } from 'lucide-react'
import './saleCelebration.css'

// eslint-disable-next-line react-refresh/only-export-components -- The selector and renderer deliberately share one animation catalog.
export const CELEBRATION_ANIMATIONS = [
  { id: 'confetti', title: 'Chuva de confetes', description: 'Uma comemoração em tela inteira, com o valor da venda no centro.' },
  { id: 'spotlight', title: 'Vendedor em destaque', description: 'O vendedor ocupa o palco, acompanhado de um troféu e do valor da venda.' },
  { id: 'ticker', title: 'Faixa discreta', description: 'Um aviso no canto da tela, mantendo os indicadores à vista.' },
]

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const particles = Array.from({ length: 30 }, (_, index) => ({
  left: `${(index * 37 + 7) % 101}%`,
  '--sale-celebration-drift': `${(index % 7 - 3) * 5}cqw`,
  '--sale-celebration-spin': `${(index % 2 ? -1 : 1) * (270 + index * 19)}deg`,
  '--sale-celebration-delay': `${index % 6 * 65}ms`,
  '--sale-celebration-particle-color': ['#54ead4', '#8c9cff', '#c297ff', '#f1f5ff'][index % 4],
}))
const text = value => typeof value === 'string' ? value.trim() : ''

/**
 * Mount with a new key for each preview or sale. Audio and sale detection live outside this component.
 * @param {{ animation?: string, sale?: { sellerName?: string, amount: number, product?: string }, durationSeconds?: number, onComplete?: () => void, onDismiss?: () => void, preview?: boolean }} props
 */
export function SaleCelebration({ animation = 'confetti', sale, durationSeconds = 5, onComplete, onDismiss, preview = false, testSale = false }) {
  const kind = CELEBRATION_ANIMATIONS.some(item => item.id === animation) ? animation : 'confetti'
  const sellerName = text(sale?.sellerName)
  const product = text(sale?.product)
  const amount = Number.isFinite(sale?.amount) ? money.format(sale.amount) : '—'
  const duration = Number.isFinite(durationSeconds) ? Math.max(.5, durationSeconds) : 5
  const [leaving, setLeaving] = useState(false)
  const [complete, setComplete] = useState(false)
  const completed = useRef(false)
  const callbacks = useRef({ onComplete, onDismiss })

  useEffect(() => { callbacks.current = { onComplete, onDismiss } }, [onComplete, onDismiss])
  const finish = useCallback(reason => {
    if (completed.current) return
    completed.current = true
    setComplete(true)
    const callback = reason === 'dismiss' ? callbacks.current.onDismiss || callbacks.current.onComplete : callbacks.current.onComplete
    callback?.()
  }, [])
  useEffect(() => {
    if (complete) return
    const leaveTimer = window.setTimeout(() => setLeaving(true), Math.max(0, duration * 1000 - 220))
    const completeTimer = window.setTimeout(() => finish('complete'), duration * 1000)
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(completeTimer) }
  }, [duration, finish, complete])
  useEffect(() => {
    if (complete) return
    const dismiss = event => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      finish('dismiss')
    }
    // Let a parent fullscreen player handle Escape before this fallback.
    window.addEventListener('keydown', dismiss)
    return () => window.removeEventListener('keydown', dismiss)
  }, [finish, complete])

  if (complete) return null
  return <section className={`sale-celebration sale-celebration--${kind}`} data-animation={kind} data-preview={preview || undefined} data-leaving={leaving || undefined}
    style={{ '--sale-celebration-duration': `${duration}s` }} aria-label="Comemoração de nova venda" data-testid="tv-celebration">
    <span className="sale-celebration__announcement" role="status" aria-live="polite" aria-atomic="true">
      {testSale ? 'Venda de teste.' : 'Nova venda!'} {amount}.{sellerName ? ` Vendedor: ${sellerName}.` : ' Venda confirmada.'}{product ? ` Produto: ${product}.` : ''}
    </span>
    {kind === 'confetti' && <div className="sale-celebration__confetti" aria-hidden="true">{particles.map((style, index) => <i key={index} style={style}/>)}</div>}
    <div className="sale-celebration__surface">
      <button type="button" className="sale-celebration__dismiss" onClick={() => finish('dismiss')} aria-label="Encerrar comemoração" title="Encerrar comemoração (Esc)"><X aria-hidden="true" size={18}/></button>
      <div className="sale-celebration__content" aria-hidden="true">
        {kind === 'spotlight' && <div className="sale-celebration__award">
          <svg className="sale-celebration__rings" viewBox="0 0 240 240" fill="none"><circle cx="120" cy="120" r="112"/><circle cx="120" cy="120" r="94" strokeDasharray="1 14"/></svg>
          <Trophy className="sale-celebration__trophy" strokeWidth={1.35}/>
        </div>}
        {kind === 'ticker' && <BadgeCheck className="sale-celebration__check" strokeWidth={1.7}/>}
        <div className="sale-celebration__copy">
          <h2 className="sale-celebration__title">{kind === 'confetti' && <PartyPopper aria-hidden="true" strokeWidth={1.6}/>} {testSale ? 'Venda de teste' : 'Nova venda!'}</h2>
          {kind === 'spotlight' && <p className="sale-celebration__seller">{sellerName || 'Venda confirmada'}</p>}
          <strong className="sale-celebration__amount" data-testid="sale-celebration-amount">{amount}</strong>
          {kind !== 'spotlight' && <p className="sale-celebration__seller">{sellerName || 'Venda confirmada'}</p>}
          {product && <p className="sale-celebration__product">{product}</p>}
        </div>
      </div>
      {kind === 'ticker' && <span className="sale-celebration__countdown" aria-hidden="true"/>}
    </div>
  </section>
}

export default SaleCelebration
