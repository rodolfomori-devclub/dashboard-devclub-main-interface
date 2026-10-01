/* eslint-disable react/prop-types -- Shared presentation components with explicit data props. */
import { useState } from 'react'
import { finiteNumber } from './chartMath'
import { formatValue } from './chartFormatters'
import './analyticsVisuals.css'

const colorAt = index => `var(--chart-${index % 6 + 1})`

export function ChartPanel({ title, description, action, footer, className = '', children }) {
  return <section className={`analytics-panel ${className}`}>
    <header className="analytics-panel-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action && <div className="analytics-panel-actions">{action}</div>}</header>
    <div className="analytics-panel-body">{children}</div>
    {footer && <footer className="analytics-panel-footer">{footer}</footer>}
  </section>
}

export function RankedBars({ items = [], unit = 'currency', limit = 7, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  const sorted = items.map((item, index) => ({ ...item, value: finiteNumber(item.value), color: item.color || colorAt(index) })).sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity))
  const shown = expanded ? sorted : sorted.slice(0, limit)
  const min = Math.min(0, ...sorted.map(item => item.value ?? 0)), max = Math.max(unit === 'percent' ? 100 : 0, ...sorted.map(item => item.value ?? 0))
  const span = max - min || 1, zero = -min / span * 100
  if (!items.length) return <p className="analytics-empty">Nenhum registro neste recorte.</p>
  return <div className="analytics-ranking">
    <div className="analytics-ranking-rows">{shown.map((item, index) => {
      const Wrapper = onSelect ? 'button' : 'div'
      return <Wrapper key={item.key ?? item.label ?? index} className="analytics-rank" style={{ '--series-color': item.color }} {...(onSelect ? { type: 'button', onClick: () => onSelect(item), title: `Filtrar por ${item.label}` } : {})}>
        <div className="analytics-rank-caption"><span><i aria-hidden="true" />{item.label}</span><strong>{formatValue(item.value, unit)}</strong></div>
        <div className={`analytics-rank-track${item.value === null ? ' is-unknown' : ''}`} aria-hidden="true"><i style={{ left: `${item.value !== null && item.value < 0 ? (item.value - min) / span * 100 : zero}%`, width: `${item.value === null ? 0 : Math.abs(item.value) / span * 100}%` }} />{min < 0 && <b style={{ left: `${zero}%` }} />}{unit === 'percent' && <b className="analytics-rank-target" title="100%" style={{ left: `${(100 - min) / span * 100}%` }} />}</div>
        {(item.count !== undefined || item.partial) && <small>{item.count !== undefined ? `${formatValue(item.count)} vendas` : ''}{item.partial ? `${item.count !== undefined ? ' · ' : ''}Valor parcial` : ''}</small>}
      </Wrapper>
    })}</div>
    {items.length > limit && <button type="button" className="analytics-expand" onClick={() => setExpanded(value => !value)}>{expanded ? 'Mostrar menos' : `Ver todos (${items.length})`}</button>}
  </div>
}

export function MixChart({ items = [], totalLabel = 'vendas', emptyLabel = 'Nenhuma venda neste recorte.' }) {
  const [selected, setSelected] = useState(null)
  const [preview, setPreview] = useState(null)
  const values = items.map((item, index) => ({ ...item, value: finiteNumber(item.value), color: item.color || colorAt(index) })).filter(item => item.value !== null && item.value >= 0)
  const total = values.reduce((sum, item) => sum + item.value, 0)
  const active = values.find(item => (item.key ?? item.label) === (preview ?? selected))
  let offset = 0
  const segments = values.map(item => { const share = total ? item.value / total * 100 : 0; const start = offset; offset += share; return { ...item, share, start } })
  return <div className="analytics-mix">
    <div className="analytics-donut" onPointerLeave={() => setPreview(null)}>
      <svg viewBox="0 0 220 220" role="img" aria-label={total ? `Distribuição de ${formatValue(total)} ${totalLabel}` : emptyLabel}>
        <circle className="analytics-donut-track" cx="110" cy="110" r="85" fill="none" strokeWidth="20" />
        <g transform="rotate(-90 110 110)">{segments.filter(item => item.value > 0).map(item => <circle key={item.key ?? item.label} cx="110" cy="110" r="85" fill="none" stroke={item.color} strokeWidth={active && (active.key ?? active.label) === (item.key ?? item.label) ? 26 : 20} pathLength="100" strokeDasharray={`${item.share - (segments.length > 1 ? Math.min(.8, item.share * .15) : 0)} 100`} strokeDashoffset={-item.start} opacity={active && (active.key ?? active.label) !== (item.key ?? item.label) ? .3 : 1} onPointerEnter={() => setPreview(item.key ?? item.label)} />)}</g>
      </svg>
      <div className="analytics-donut-center"><strong>{total ? formatValue(active?.value ?? total) : '—'}</strong><span>{active?.label || (total ? totalLabel : 'Sem dados')}</span>{active && <small>{formatValue(active.value / total * 100, 'percent')}</small>}</div>
    </div>
    <div className="analytics-mix-legend">{total ? segments.map(item => <button type="button" key={item.key ?? item.label} aria-pressed={selected === (item.key ?? item.label)} onClick={() => setSelected(value => value === (item.key ?? item.label) ? null : item.key ?? item.label)} onFocus={() => setPreview(item.key ?? item.label)} onBlur={() => setPreview(null)}>
      <i aria-hidden="true" style={{ background: item.color }} /><span>{item.label}</span><strong>{formatValue(item.value)}</strong><small>{formatValue(item.share, 'percent')}</small>
    </button>) : <p className="analytics-empty">{emptyLabel}</p>}</div>
  </div>
}
