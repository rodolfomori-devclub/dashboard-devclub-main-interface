import { useCallback, useEffect, useRef, useState } from 'react'
import { History, LoaderCircle, Percent, Plus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { requestApi } from '../../lib/api'
import { invalidateSalesCache } from '../daily/dailyData'
import { draftFromSchedule, percentInput, ruleLabel, scheduleFromDraft, withSchedule } from './saleFeeForm'
import './saleFees.css'

const MAX_INSTALLMENTS = 24
const money = value => value == null ? '—' : Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const dateBR = value => value ? value.slice(0, 10).split('-').reverse().join('/') : '—'
const localToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
const yearAgo = date => `${Number(date.slice(0, 4)) - 1}${date.slice(4, 8)}01`
const json = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export default function SaleFeeSettings() {
  const [saved, setSaved] = useState(null)
  const [schedules, setSchedules] = useState([])
  const [draft, setDraft] = useState(null)
  const [range, setRange] = useState(() => ({ startDate: yearAgo(localToday()), endDate: localToday() }))
  const [preview, setPreview] = useState(null)
  const [history, setHistory] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('')
  const mounted = useRef(false)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await requestApi('/sale-fees', { cache: 'no-store' })
      if (!Array.isArray(result?.settings?.schedules) || !Number.isInteger(result.revision)) throw new Error('Não foi possível validar a tabela de taxas. Tente novamente.')
      if (mounted.current) { setSaved(result); setSchedules(result.settings.schedules); setDraft(null); setPreview(null); setConfirming(false) }
    } catch (failure) { if (mounted.current) setError(failure.message) }
    finally { if (mounted.current) setLoading(false) }
  }, [])
  useEffect(() => { mounted.current = true; load(); return () => { mounted.current = false } }, [load])

  const changed = Boolean(saved) && JSON.stringify(schedules) !== JSON.stringify(saved.settings.schedules)
  const edit = effectiveFrom => { setDraft(draftFromSchedule(schedules.find(item => item.effectiveFrom === effectiveFrom))); setMessage('') }
  const startDraft = () => { setDraft(draftFromSchedule({ ...(schedules.at(-1) || saved.defaults), effectiveFrom: localToday() })); setMessage('') }
  const changeDraft = patch => setDraft(previous => ({ ...previous, ...patch }))
  const changeScenario = (index, patch) => setDraft(previous => ({ ...previous, scenarios: previous.scenarios.map((scenario, position) => position === index ? { ...scenario, ...patch } : scenario) }))
  const resizeCard = delta => setDraft(previous => ({ ...previous, scenarios: previous.scenarios.map(scenario => ({ ...scenario,
    card: delta > 0 ? [...scenario.card, ''] : scenario.card.slice(0, -1) })) }))
  const applyDraft = () => {
    const result = scheduleFromDraft(draft)
    if (result.error) { setError(result.error); return }
    setSchedules(list => withSchedule(list, result.schedule)); setDraft(null); setError(''); setPreview(null); setConfirming(false)
  }
  const remove = effectiveFrom => { setSchedules(list => list.filter(item => item.effectiveFrom !== effectiveFrom)); setPreview(null); setConfirming(false) }

  async function runPreview() {
    if (busy) return
    setBusy('preview'); setError('')
    try { const result = await requestApi('/sale-fees/preview', json({ settings: { version: 1, schedules }, ...range })); if (mounted.current) setPreview(result) }
    catch (failure) { if (mounted.current) setError(failure.message) }
    finally { if (mounted.current) setBusy('') }
  }
  async function save() {
    if (busy) return
    if (!confirming && schedules.some(item => item.effectiveFrom < localToday())) { setConfirming(true); return }
    setBusy('save'); setError(''); setMessage('')
    try {
      const result = await requestApi('/sale-fees', { ...json({ settings: { version: 1, schedules }, expectedRevision: saved.revision }), method: 'PUT' })
      invalidateSalesCache()
      if (mounted.current) {
        setSaved(previous => ({ ...previous, ...result })); setSchedules(result.settings.schedules); setConfirming(false); setHistory(null)
        setMessage('Tabela salva. As telas passam a usar a nova tabela em até 2 minutos.')
      }
    } catch (failure) { if (mounted.current) { setError(failure.message); setConfirming(false) } }
    finally { if (mounted.current) setBusy('') }
  }
  async function showHistory() {
    setBusy('history'); setError('')
    try { const result = await requestApi('/sale-fees/history', { cache: 'no-store' }); if (mounted.current) setHistory(result.entries || []) }
    catch (failure) { if (mounted.current) setError(failure.message) }
    finally { if (mounted.current) setBusy('') }
  }

  const rows = draft ? Math.max(...draft.scenarios.map(scenario => scenario.card.length)) : 0
  return <section className="surface-panel sale-fees" data-testid="sale-fee-settings" aria-label="Tabela de taxas das vendas" aria-busy={loading || Boolean(busy)}>
    <div className="sale-fees-heading"><span className="sale-fees-icon"><Percent size={22} aria-hidden="true" /></span><div>
      <h2>Tabela de taxas das vendas</h2>
      <p>Define o líquido das vendas do Guru (Pagar.me por cartão, Pix e boleto; Mercado Pago pelo líquido informado pela Guru) e o percentual de cash collected da TMB. Cada vigência vale para as vendas a partir da sua data. Sem vigência, vale a regra anterior. A base das comissões não muda.</p>
    </div></div>
    {error && <p role="alert" className="notice notice-error">{error}{error.includes('outro administrador') && <button type="button" className="button" onClick={load}><RefreshCw size={15} />Recarregar</button>}</p>}
    {message && <p role="status" className="sale-fees-message">{message}</p>}
    {loading && <p role="status" className="sale-fees-muted"><LoaderCircle size={16} className="sale-fees-spin" aria-hidden="true" />Carregando a tabela…</p>}
    {saved && <>
      <p className="sale-fees-muted">{saved.revision ? `Revisão ${saved.revision}, salva em ${dateBR(saved.updatedAt)}.` : 'Nenhuma tabela salva: todas as vendas usam a regra anterior.'}</p>
      <div className="sale-fees-table-wrap"><table className="sale-fees-table">
        <thead><tr><th>Vigência a partir de</th><th>Cenário ativo</th><th>Cartão 12x</th><th>Pix</th><th>Boleto</th><th>TMB</th><th><span className="sr-only">Ações</span></th></tr></thead>
        <tbody>{schedules.map(item => { const scenario = item.scenarios.find(option => option.id === item.activeScenario); return <tr key={item.effectiveFrom}>
          <td>{dateBR(item.effectiveFrom)}</td><td>{scenario.label}</td><td>{scenario.pagarme.card[11] === undefined ? 'Sem taxa' : `${percentInput(scenario.pagarme.card[11])}%`}</td>
          <td>{percentInput(scenario.pagarme.pix.rate)}% + {money(scenario.pagarme.pix.fixed)}</td><td>{money(scenario.pagarme.boleto.fixed)}</td><td>{percentInput(item.tmb.cashRate)}%</td>
          <td className="sale-fees-actions"><button type="button" className="button" onClick={() => edit(item.effectiveFrom)} disabled={Boolean(draft)}>Editar</button><button type="button" className="button" onClick={() => remove(item.effectiveFrom)} aria-label={`Remover a vigência de ${dateBR(item.effectiveFrom)}`}><Trash2 size={15} /></button></td>
        </tr> })}{!schedules.length && <tr><td colSpan={7} className="sale-fees-muted">Nenhuma vigência. Salvar a tabela vazia volta todas as vendas para a regra anterior.</td></tr>}</tbody>
      </table></div>
      {!draft && <button type="button" className="button" onClick={startDraft}><Plus size={16} />Nova vigência</button>}
      {draft && <fieldset className="sale-fees-editor"><legend>Vigência</legend>
        <div className="sale-fees-fields">
          <label>Começa em<input type="date" value={draft.effectiveFrom} onChange={event => changeDraft({ effectiveFrom: event.target.value })} /></label>
          <label>Cenário ativo<select value={draft.activeScenario} onChange={event => changeDraft({ activeScenario: event.target.value })}>{draft.scenarios.map(scenario => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select></label>
          <label>TMB (% do contratado)<input inputMode="decimal" value={draft.tmbCashRate} onChange={event => changeDraft({ tmbCashRate: event.target.value })} /></label>
        </div>
        <div className="sale-fees-table-wrap"><table className="sale-fees-table sale-fees-grid">
          <thead><tr><th>Pagar.me</th>{draft.scenarios.map(scenario => <th key={scenario.id}>{scenario.label} (%)</th>)}</tr></thead>
          <tbody>{Array.from({ length: rows }, (_, index) => <tr key={index}><th scope="row">Cartão {index ? `${index + 1}x` : 'à vista'}</th>{draft.scenarios.map((scenario, position) => <td key={scenario.id}><input inputMode="decimal" aria-label={`${scenario.label} cartão ${index + 1}x`} value={scenario.card[index] ?? ''} onChange={event => changeScenario(position, { card: Object.assign([...scenario.card], { [index]: event.target.value }) })} /></td>)}</tr>)}
            {[['Pix (%)', 'pixRate'], ['Pix (R$ por venda)', 'pixFixed'], ['Boleto (%)', 'boletoRate'], ['Boleto (R$ por venda)', 'boletoFixed']].map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{draft.scenarios.map((scenario, position) => <td key={scenario.id}><input inputMode="decimal" aria-label={`${scenario.label} ${label}`} value={scenario[key]} onChange={event => changeScenario(position, { [key]: event.target.value })} /></td>)}</tr>)}
          </tbody>
        </table></div>
        <div className="sale-fees-actions-row">
          <button type="button" className="button" onClick={() => resizeCard(1)} disabled={rows >= MAX_INSTALLMENTS}><Plus size={15} />Parcela</button>
          <button type="button" className="button" onClick={() => resizeCard(-1)} disabled={rows <= 1}>Remover última parcela</button>
          <button type="button" className="button button-primary" onClick={applyDraft}>Usar esta vigência</button>
          <button type="button" className="button" onClick={() => { setDraft(null); setError('') }}>Cancelar</button>
        </div>
      </fieldset>}
      <div className="sale-fees-preview">
        <div className="sale-fees-fields">
          <label>Prévia de<input type="date" value={range.startDate} onChange={event => { setRange(previous => ({ ...previous, startDate: event.target.value })); setPreview(null) }} /></label>
          <label>Até<input type="date" value={range.endDate} max={localToday()} onChange={event => { setRange(previous => ({ ...previous, endDate: event.target.value })); setPreview(null) }} /></label>
          <button type="button" className="button" onClick={runPreview} disabled={Boolean(busy) || Boolean(draft)}>{busy === 'preview' ? <LoaderCircle size={16} className="sale-fees-spin" /> : <RefreshCw size={16} />}Prévia do impacto</button>
        </div>
        {preview && <>
          {!preview.complete && <p className="notice">Ainda há {preview.pending + preview.missing} mês(es) sem dados disponíveis no cache. Repita a prévia em alguns minutos.</p>}
          <div className="sale-fees-table-wrap"><table className="sale-fees-table">
            <thead><tr><th>Mês</th><th>Vendas Guru</th><th>Valor cobrado</th><th>Regra anterior</th><th>Tabela salva</th><th>Com esta tabela</th><th>Diferença</th></tr></thead>
            <tbody>{preview.months.map(row => <tr key={row.month}><td>{row.month.split('-').reverse().join('/')}</td><td>{row.count}</td><td>{money(row.charged)}</td><td>{money(row.previous)}</td><td>{money(row.current)}</td><td>{money(row.proposed)}</td><td>{money(row.proposed - row.current)}</td></tr>)}</tbody>
          </table></div>
          <details className="sale-fees-rules"><summary>Como cada venda foi calculada</summary><ul>{preview.rules.map(rule => <li key={rule.rule}><span>{ruleLabel(rule.rule)}</span><span>{rule.count} venda(s) · cobrado {money(rule.charged)} · líquido {money(rule.proposed)}</span></li>)}</ul></details>
        </>}
      </div>
      {confirming && <p role="alert" className="notice">Há vigências com data passada: meses já fechados serão recalculados em todas as telas, inclusive metas e TV. Confirme para salvar.</p>}
      <div className="sale-fees-actions-row">
        <button type="button" className="button button-primary" onClick={save} disabled={!changed || Boolean(busy) || Boolean(draft)}>{busy === 'save' ? <LoaderCircle size={16} className="sale-fees-spin" /> : <Save size={16} />}{confirming ? 'Confirmar e salvar' : 'Salvar tabela'}</button>
        {changed && <button type="button" className="button" onClick={load} disabled={Boolean(busy)}>Descartar alterações</button>}
        <button type="button" className="button" onClick={showHistory} disabled={Boolean(busy)}><History size={16} />Histórico</button>
      </div>
      {history && <ul className="sale-fees-history">{history.map(entry => <li key={`${entry.revision}-${entry.createdAt}`}><strong>Revisão {entry.revision}</strong><span>{dateBR(entry.createdAt)} · {entry.actor} · {entry.after?.schedules?.length ?? 0} vigência(s)</span></li>)}{!history.length && <li className="sale-fees-muted">Nenhuma alteração registrada.</li>}</ul>}
    </>}
  </section>
}
