/* eslint-disable react/prop-types -- Controlled, internal goal allocation fields. */
import { GOAL_AREAS, GOAL_TIERS, goalBreakdownPreview } from './goalConfig'
import { formatValue } from '../charts/chartFormatters'

export default function GoalBreakdownFields({ id, parts, metric, unit, onChange }) {
  const totals = goalBreakdownPreview(parts, metric)
  return <div className="goal-breakdown">
    <div className="goal-breakdown-summary" aria-label="Total da meta geral">
      <p>Meta geral <span>Marketing + Vendas</span></p>
      <div className="goal-breakdown-totals">{GOAL_TIERS.map(([field, label]) => <div key={field}><span>{label}</span><output className="goal-breakdown-total" data-field={field} data-pending={totals[field] === null} aria-label={`Meta geral · ${label}`}>{totals[field] === null ? 'Aguardando valores' : formatValue(totals[field], unit)}</output></div>)}</div>
      {totals.target > 0 && <div className="goal-breakdown-share" aria-label="Participação de cada área na meta base">{GOAL_AREAS.map(({ key, label }) => <span key={key} className={`goal-share-${key}`} title={`${label}: ${formatValue(Number(parts.find(part => part.key === key).target) / totals.target * 100, 'percent')}`} style={{ width: `${Number(parts.find(part => part.key === key).target) / totals.target * 100}%` }} />)}</div>}
    </div>
    {GOAL_AREAS.map(({ key, label }) => <section className={`goal-area goal-area-${key}`} aria-label={`Metas de ${label}`} key={key}>
      <h4>{label}<span>Parte da meta geral</span></h4>
      <div className="goal-tiers">{GOAL_TIERS.map(([field, tier]) => <label className="goal-tier" key={field} htmlFor={`${id}-${key}-${field}`}><span>{tier}{unit === 'currency' && <small>R$</small>}</span><input className="ds-input" id={`${id}-${key}-${field}`} aria-label={`${label} · ${tier}`} type="number" inputMode={unit === 'count' ? 'numeric' : 'decimal'} min="0" max="999999999999" step={unit === 'count' ? '1' : '.01'} value={parts.find(part => part.key === key)?.[field] ?? ''} onChange={event => onChange(key, field, event.target.value)} placeholder="Não definida" /></label>)}</div>
    </section>)}
    <p className="goal-breakdown-help">O total é calculado pela soma das duas áreas, em cada faixa. Informe 0 quando uma área não tiver meta.</p>
  </div>
}
