/* eslint-disable react/prop-types -- Internal scoped-goal editor contract. */
import { useEffect, useId, useState } from 'react'
import { Save } from 'lucide-react'
import { buildGoalPayload, emptyGoalBreakdown, goalDraft, GOAL_METRICS, GOAL_TIERS } from './goalConfig.js'
import GoalBreakdownFields from './GoalBreakdownFields'
import { formatValue } from '../charts/chartFormatters'

export default function GoalMetricEditor({ plan, scope, scopeId, scopeName, metric, editable, onSave }) {
  const id = useId(), definition = GOAL_METRICS[metric]
  const [draft, setDraft] = useState(() => ({ ...goalDraft(plan), ...(!plan && scope === 'overall' ? { breakdown: emptyGoalBreakdown() } : {}) }))
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  useEffect(() => { setDraft({ ...goalDraft(plan), ...(!plan && scope === 'overall' ? { breakdown: emptyGoalBreakdown() } : {}) }); setError('') }, [plan, scope])
  const change = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setMessage(''); setError('') }
  const changePart = (key, field, value) => { setDraft(previous => ({ ...previous, breakdown: previous.breakdown.map(part => part.key === key ? { ...part, [field]: value } : part) })); setMessage(''); setError('') }
  const divided = scope === 'overall' && Array.isArray(draft.breakdown)
  async function save(event) {
    event.preventDefault(); if (!editable || saving) return; setError(''); setMessage('')
    let payload
    try { payload = buildGoalPayload({ scope, scopeId, metric, draft }) } catch (failure) { setError(failure.message); return }
    setSaving(true)
    try { await onSave(payload); setMessage(`${definition.label} de ${scopeName} salvo.`) }
    catch (failure) { setError(failure.message || 'Não foi possível salvar a meta. Os valores preenchidos foram mantidos.') }
    finally { setSaving(false) }
  }
  const updatedAt = plan?.updatedAt && !Number.isNaN(Date.parse(plan.updatedAt)) ? new Date(plan.updatedAt).toLocaleString('pt-BR') : null
  return <form className={`goal-metric-editor goal-metric-${metric}`} onSubmit={save} aria-label={`Meta de ${definition.label}`}>
    <header><h3>{definition.label}</h3><p>{definition.description}</p><span className="goal-save-state">{plan ? updatedAt ? `Atualizada em ${updatedAt}` : 'Meta configurada' : 'Ainda não configurada'}</span></header>
    <fieldset disabled={!editable || saving}>
      {divided ? <>
        {plan && !plan.breakdown && <p className="goal-breakdown-previous">Meta geral atual: <strong>{formatValue(plan.target, definition.unit)}</strong>. A nova soma será aplicada ao salvar.</p>}
        <GoalBreakdownFields id={id} parts={draft.breakdown} metric={metric} unit={definition.unit} onChange={changePart} />
        {plan && !plan.breakdown && editable && <button type="button" className="goal-breakdown-toggle" onClick={() => { setDraft(goalDraft(plan)); setError(''); setMessage('') }}>Manter meta sem divisão</button>}
      </> : <>
        <div className="goal-tiers">{GOAL_TIERS.map(([field, label]) => <label className="goal-tier" key={field} htmlFor={`${id}-${field}`}><span>{label}{definition.unit === 'currency' && <small>R$</small>}</span><input className="ds-input" id={`${id}-${field}`} type="number" inputMode={definition.unit === 'count' ? 'numeric' : 'decimal'} min="0" max="999999999999" step={definition.unit === 'count' ? '1' : '.01'} value={draft[field]} onChange={event => change(field, event.target.value)} placeholder="Não definida" /></label>)}</div>
        {scope === 'overall' && <div className="goal-breakdown-legacy"><p>Esta meta geral ainda não foi dividida entre Marketing e Vendas.</p>{editable && <button type="button" className="button" onClick={() => change('breakdown', emptyGoalBreakdown())}>Configurar Marketing e Vendas</button>}</div>}
      </>}
      <label className="goal-field" htmlFor={`${id}-basis`}>Distribuição do ritmo<select className="ds-input" id={`${id}-basis`} value={draft.paceBasis} onChange={event => change('paceBasis', event.target.value)}><option value="calendar">Dias corridos</option><option value="business">Dias úteis</option></select><small>Dias úteis consideram segunda a sexta, sem feriados.</small></label>
      <label className="goal-field" htmlFor={`${id}-notes`}>Observações<textarea className="ds-input" id={`${id}-notes`} rows={2} maxLength={2000} value={draft.notes} onChange={event => change('notes', event.target.value)} placeholder="Premissas e objetivo deste mês" /></label>
    </fieldset>
    {error && <p className="goal-editor-error" role="alert">{error}</p>}{message && <p className="goal-editor-success" role="status">{message}</p>}
    <footer>{editable ? <button type="submit" className="button button-primary" disabled={saving}><Save size={15} />{saving ? 'Salvando…' : `Salvar ${definition.label.toLocaleLowerCase('pt-BR')}`}</button> : <span className="goal-save-state">Somente leitura</span>}</footer>
  </form>
}
