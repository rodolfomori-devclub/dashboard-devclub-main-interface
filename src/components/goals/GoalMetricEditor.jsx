/* eslint-disable react/prop-types -- Internal scoped-goal editor contract. */
import { useEffect, useId, useState } from 'react'
import { Save } from 'lucide-react'
import { buildGoalPayload, emptyGoalBreakdown, goalBreakdownPreview, goalDraft, goalProductPreview, GOAL_METRICS, GOAL_TIERS } from './goalConfig.js'
import GoalBreakdownFields from './GoalBreakdownFields'
import { formatValue } from '../charts/chartFormatters'

export default function GoalMetricEditor({ plan, scope, scopeId, scopeName, metric, editable, productPlans = [], periodLabel, onSave, onReload }) {
  const id = useId(), definition = GOAL_METRICS[metric]
  const [draft, setDraft] = useState(() => goalDraft(plan))
  const [saving, setSaving] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  const [conflict, setConflict] = useState(false)
  const [preview, setPreview] = useState(null)
  useEffect(() => { setDraft(goalDraft(plan)); setError(''); setConflict(false); setPreview(null) }, [plan, scope])
  const change = (field, value) => { setDraft(previous => ({ ...previous, [field]: value })); setMessage(''); setError('') }
  const changePart = (key, field, value) => { setDraft(previous => ({ ...previous, breakdown: previous.breakdown.map(part => part.key === key ? { ...part, [field]: value } : part) })); setMessage(''); setError('') }
  const divided = scope === 'overall' && Array.isArray(draft.breakdown)
  function showPreview(kind) {
    if (!editable || saving || conflict || scope !== 'overall') return
    setError(''); setMessage('')
    try { setPreview({ kind, ...(kind === 'products' ? goalProductPreview(productPlans, metric) : { totals: goalBreakdownPreview(draft.breakdown, metric) }) }) }
    catch (failure) { setError(failure.message) }
  }
  function confirmPreview() {
    if (!preview?.totals || !editable || saving || conflict) return
    setDraft(previous => ({ ...previous, ...Object.fromEntries(GOAL_TIERS.map(([field]) => [field, preview.totals[field] ?? ''])), breakdown: null, clearBreakdown: Array.isArray(plan?.breakdown) }))
    setPreview(null); setError(''); setMessage('Rascunho preenchido. Revise os valores e clique em Salvar para gravar.')
  }
  function configureBreakdown() {
    setDraft(previous => ({ ...previous, breakdown: goalDraft(plan).breakdown || emptyGoalBreakdown(), clearBreakdown: false }))
    setError(''); setMessage('')
  }
  async function save(event) {
    event.preventDefault(); if (!editable || saving || conflict || preview) return; setError(''); setMessage('')
    let payload
    try {
      if (plan && (!Number.isInteger(plan.revision) || plan.revision < 1)) { setConflict(true); throw new Error('Recarregue a meta para consultar a versão atual antes de salvar.') }
      payload = { ...buildGoalPayload({ scope, scopeId, metric, draft }), expectedRevision: plan?.revision ?? 0 }
    } catch (failure) { setError(failure.message); return }
    setSaving(true)
    try { await onSave(payload); setMessage(`${definition.label} de ${scopeName} salvo.`) }
    catch (failure) { setConflict(failure.status === 409); setError(failure.status === 409 ? 'A meta foi alterada em outra tela. Recarregue os valores atuais e revise sua edição antes de salvar.' : failure.message || 'Não foi possível salvar a meta. Os valores preenchidos foram mantidos.') }
    finally { setSaving(false) }
  }
  const updatedAt = plan?.updatedAt && !Number.isNaN(Date.parse(plan.updatedAt)) ? new Date(plan.updatedAt).toLocaleString('pt-BR') : null
  return <form className={`goal-metric-editor goal-metric-${metric}`} onSubmit={save} aria-label={`Meta de ${definition.label}`}>
    <header><h3>{definition.label}</h3><p>{definition.description}</p><span className="goal-save-state">{plan ? updatedAt ? `Atualizada em ${updatedAt}${plan.updatedVia === 'mcp' ? ' · via Claude' : ''}` : 'Meta configurada' : 'Ainda não configurada'}</span></header>
    <fieldset disabled={!editable || saving || Boolean(preview)}>
      {divided ? <>
        {plan && !plan.breakdown && <p className="goal-breakdown-previous">Meta geral atual: <strong>{formatValue(plan.target, definition.unit)}</strong>. A nova soma será aplicada ao salvar.</p>}
        <GoalBreakdownFields id={id} parts={draft.breakdown} metric={metric} unit={definition.unit} onChange={changePart} />
        {editable && (plan?.breakdown ? <button type="button" className="goal-breakdown-toggle" disabled={conflict} onClick={() => showPreview('manual')}>Editar total manualmente</button> : <button type="button" className="goal-breakdown-toggle" onClick={() => change('breakdown', null)}>Manter meta sem divisão</button>)}
      </> : <>
        <div className="goal-tiers">{GOAL_TIERS.map(([field, label]) => <label className="goal-tier" key={field} htmlFor={`${id}-${field}`}><span>{label}{definition.unit === 'currency' && <small>R$</small>}</span><input className="ds-input" id={`${id}-${field}`} type="number" inputMode={definition.unit === 'count' ? 'numeric' : 'decimal'} min="0" max="999999999999" step={definition.unit === 'count' ? '1' : '.01'} value={draft[field]} onChange={event => change(field, event.target.value)} placeholder="Não definida" /></label>)}</div>
        {scope === 'overall' && <div className="goal-breakdown-legacy"><p>{draft.clearBreakdown ? 'Ao salvar, o total manual substituirá a divisão entre Marketing e Vendas.' : 'Total geral informado diretamente, sem divisão entre Marketing e Vendas.'}</p>{editable && <button type="button" className="button" onClick={configureBreakdown}>Configurar Marketing e Vendas</button>}</div>}
      </>}
      {scope === 'overall' && editable && <div className="goal-proposal-actions"><button type="button" className="button" disabled={conflict} onClick={() => showPreview('products')}>Preencher com produtos</button></div>}
      <label className="goal-field" htmlFor={`${id}-basis`}>Distribuição do ritmo<select className="ds-input" id={`${id}-basis`} value={draft.paceBasis} onChange={event => change('paceBasis', event.target.value)}><option value="calendar">Dias corridos</option><option value="business">Dias úteis</option></select><small>Dias úteis consideram segunda a sexta, sem feriados.</small></label>
      <label className="goal-field" htmlFor={`${id}-notes`}>Observações<textarea className="ds-input" id={`${id}-notes`} rows={2} maxLength={2000} value={draft.notes} onChange={event => change('notes', event.target.value)} placeholder="Premissas e objetivo deste mês" /></label>
    </fieldset>
    {preview && <section className="goal-breakdown-summary mt-4" aria-label={preview.kind === 'products' ? 'Prévia do preenchimento com produtos' : 'Confirmação de edição manual'}>
      <h4 className="text-sm font-semibold mb-3">{preview.kind === 'products' ? 'Preencher o total com metas de produtos' : 'Editar o total geral manualmente'}</h4>
      <p className="goal-plan-help">{periodLabel} · {definition.label}</p>
      {preview.kind === 'products' && (preview.products.length ? <div className="goal-history"><table><thead><tr><th>Produto</th>{GOAL_TIERS.map(([field, label]) => <th key={field}>{label}</th>)}</tr></thead><tbody>{preview.products.map(product => <tr key={product.scopeId}><td>{product.scopeId}</td>{GOAL_TIERS.map(([field]) => <td key={field}>{formatValue(product[field], definition.unit)}</td>)}</tr>)}</tbody><tfoot><tr><th>Total</th>{GOAL_TIERS.map(([field]) => <td key={field}>{formatValue(preview.totals[field], definition.unit)}</td>)}</tr></tfoot></table></div> : <p className="goal-plan-help">Nenhuma meta de produto configurada para este indicador neste mês. Nenhum valor será preenchido.</p>)}
      {preview.kind === 'manual' && <div className="goal-breakdown-totals">{GOAL_TIERS.map(([field, label]) => <div key={field}><span>{label}</span><strong>{formatValue(preview.totals[field], definition.unit)}</strong></div>)}</div>}
      {preview.products?.some(product => product.scopeId === 'Vitalício') && <p className="goal-plan-help mt-3">A soma inclui Vitalício. Esse recorte pode ter sobreposição com DevClub, MBA e outros produtos; as metas listadas serão somadas sem descontar essa sobreposição.</p>}
      {(divided || draft.clearBreakdown) && <p className="goal-plan-help mt-3">Ao salvar, este total vai substituir a divisão entre Marketing e Vendas. As metas de cada produto serão mantidas.</p>}
      <p className="goal-plan-help mt-3">Confirmar altera somente o rascunho. Revise as três faixas e use Salvar para gravar a meta geral.</p>
      <div className="goal-proposal-actions"><button type="button" className="button" onClick={() => setPreview(null)}>Cancelar</button><button type="button" className="button button-primary" disabled={!preview.totals || !editable || saving || conflict} onClick={confirmPreview}>{preview.kind === 'products' ? 'Confirmar preenchimento' : 'Confirmar edição manual'}</button></div>
    </section>}
    {error && <p className="goal-editor-error" role="alert">{error}</p>}{message && <p className="goal-editor-success" role="status">{message}</p>}
    <footer>{editable ? <><button type="submit" className="button button-primary" disabled={saving || conflict || Boolean(preview)}><Save size={15} />{saving ? 'Salvando…' : `Salvar ${definition.label.toLocaleLowerCase('pt-BR')}`}</button>{conflict && <button type="button" className="button mt-3" onClick={onReload}>Recarregar meta</button>}</> : <span className="goal-save-state">Somente leitura</span>}</footer>
  </form>
}
