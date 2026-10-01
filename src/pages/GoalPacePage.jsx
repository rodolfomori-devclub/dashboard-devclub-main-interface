/* eslint-disable react/prop-types -- Internal UI props in React 19. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw } from 'lucide-react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
import MonthlyPaceChart from '../components/goals/MonthlyPaceChart'
import { ChartPanel, RankedBars } from '../components/charts/AnalyticsVisuals'
import { formatValue } from '../components/charts/chartFormatters'
import { loadSalesRange } from '../components/daily/dailyData'
import { PRODUCT_FAMILIES } from '../utils/salesData'
import { GOAL_SCOPES, goalScope, goalScopeKey, goalScopeName } from '../utils/goalScopes'
import { prepareGoalData } from '../utils/goalData'
import { brazilDate, calculateGoalPace, monthBounds, PACE_METRICS } from '../utils/goalPace'
import '../components/daily/daily.css'
import '../components/daily/goalPace.css'

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const EMPTY = []

function PaceCard({ title, value, note, tone }) {
  return <article className={`stat-card daily-stat pace-stat${tone ? ` pace-${tone}` : ''}`}><h2>{title}</h2><strong>{value}</strong><p>{note}</p></article>
}

export default function GoalPacePage() {
  const [today] = useState(brazilDate)
  const { hasPermission } = useAuth()
  const [params] = useSearchParams()
  const initialYear = Number(params.get('year')), initialMonth = Number(params.get('month'))
  const [year, setYear] = useState(Number.isInteger(initialYear) && initialYear >= 2000 && initialYear <= 2100 ? initialYear : Number(today.slice(0, 4)))
  const [month, setMonth] = useState(Number.isInteger(initialMonth) && initialMonth >= 1 && initialMonth <= 12 ? initialMonth : Number(today.slice(5, 7)))
  const [scope, setScope] = useState('overall')
  const [targetId, setTargetId] = useState('')
  const [selectedMetric, setSelectedMetric] = useState('gross')
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const requestId = useRef(0)
  const bounds = useMemo(() => monthBounds(year, month), [year, month])
  const periodKey = `${year}-${month}`

  const load = useCallback(async (force = false) => {
    const id = ++requestId.current
    setLoading(true)
    const future = today < bounds.start
    const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
    const token = localStorage.getItem('vault_access_token')
    const results = await Promise.allSettled([
      axios.get(`${base}/goal-plans/${year}/${month}`, { timeout: 30_000, headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      axios.get(`${base}/goal-plans/options`, { timeout: 30_000, headers: token ? { Authorization: `Bearer ${token}` } : {} }),
      future ? Promise.resolve({ records: [], sources: [], fetchedAt: Date.now() }) : loadSalesRange(bounds.start, today < bounds.end ? today : bounds.end, { force }),
    ])
    if (id !== requestId.current) return
    const goalResult = results[0], salesResult = results[2], directoryResult = results[1]
    const plans = goalResult.status === 'fulfilled' ? goalResult.value.data?.plans : null
    setState({ periodKey: `${year}-${month}`, plans: Array.isArray(plans) ? plans : [], plansError: !Array.isArray(plans), directory: directoryResult.status === 'fulfilled' ? directoryResult.value.data : {}, directoryError: directoryResult.status !== 'fulfilled', salesError: salesResult.status === 'rejected', sales: salesResult.status === 'fulfilled' ? salesResult.value : null })
    setLoading(false)
  }, [year, month, today, bounds])

  useEffect(() => { load(); return () => { requestId.current += 1 } }, [load])
  const current = state?.periodKey === periodKey ? state : null
  const plans = current?.plans || EMPTY
  const directory = current?.directory || {}
  const targetOptions = useMemo(() => {
    const list = scope === 'overall' ? [] : scope === 'product'
      ? PRODUCT_FAMILIES.filter(family => family !== 'Não informado').map(id => ({ id, name: id, active: true }))
      : (scope === 'team' ? directory.teams : directory.individuals) || []
    const options = new Map(list.map(item => [item.id, item]))
    for (const plan of plans) {
      const target = goalScope(plan)
      if (target.scope === scope && !options.has(target.scopeId)) options.set(target.scopeId, { id: target.scopeId, name: goalScopeName(plan), active: false })
    }
    const result = [...options.values()]
    return ['team', 'individual'].includes(scope) ? result.sort((a, b) => Number(b.active !== false) - Number(a.active !== false) || a.name.localeCompare(b.name, 'pt-BR')) : result
  }, [scope, directory.teams, directory.individuals, plans])
  const scopeId = scope === 'overall' ? '' : targetOptions.some(item => item.id === targetId) ? targetId : targetOptions[0]?.id || ''
  const selection = { scope, scopeId, product: scope === 'product' ? scopeId : 'all', scopeName: targetOptions.find(item => item.id === scopeId)?.name }
  const scopePlans = plans.filter(item => goalScopeKey(item) === goalScopeKey(selection))
  const selectedPlan = scopePlans.find(item => item.metric === selectedMetric) || null
  const metric = selectedMetric
  const goalData = useMemo(() => prepareGoalData(current?.sales || {}, current?.directory || {}, !current?.directoryError), [current])
  const calculate = plan => calculateGoalPace({ year, month, plan, ...goalData, today })
  const pace = calculate(selectedPlan || { ...selection, metric })
  const financialSummary = ['gross', 'cash'].map(key => ({ metric: key, pace: calculate(scopePlans.find(plan => plan.metric === key) || { ...selection, metric: key }) }))
  const overview = plans.filter(item => item.metric === metric).map(plan => ({ plan, pace: calculate(plan) }))
  const deviationRows = pace.rows.map(row => ({ ...row, deviation: row.observed && row.actual !== null && row.planned !== null ? row.actual - row.planned : null }))
  const attainmentItems = overview.filter(({ pace: item }) => !item.future && item.attainment !== null).map(({ plan, pace: item }) => ({
    key: plan.id || `${goalScopeKey(plan)}:${plan.metric}`, label: `${GOAL_SCOPES[goalScope(plan).scope]} · ${goalScopeName(plan)}`,
    value: item.attainment, partial: !item.definitive, color: goalScopeKey(plan) === goalScopeKey(selection) ? 'var(--chart-1, #e64b63)' : 'var(--chart-4, #2589b8)',
  })).sort((a, b) => b.value - a.value)
  const selectOverviewPlan = key => {
    const selected = overview.find(({ plan }) => (plan.id || `${goalScopeKey(plan)}:${plan.metric}`) === (typeof key === 'object' ? key.key : key))
    if (selected) { const target = goalScope(selected.plan); setScope(target.scope); setTargetId(target.scopeId) }
  }
  const unit = pace.metric.unit
  const value = (number) => formatValue(number, unit)
  const percent = (number) => number === null ? '—' : `${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const partialLabel = pace.definitive ? '' : 'Parcial · '
  const elapsedNote = pace.future ? 'O mês ainda não começou.' : `${pace.elapsedDays} de ${pace.totalDays} dias ${pace.basis === 'business' ? 'úteis' : 'corridos'} considerados.`

  return <div className="hub-page daily-page pace-page">
    <header className="page-heading daily-heading"><div><h1>Metas e ritmo de vendas</h1><p>Acompanhe metas gerais, por time, produto e pessoa — com bruto e caixa separados.</p></div><div className="daily-refresh"><button className="button button-primary" onClick={() => load(true)} disabled={loading}><RefreshCw size={16} className={loading ? 'daily-spin' : ''} />{loading ? 'Atualizando' : 'Atualizar dados'}</button>{hasPermission('goals') && <Link to="/metas" className="pace-configure">Configurar metas</Link>}</div></header>

    <div className="tab-strip" role="group" aria-label="Escopo da meta">{Object.entries(GOAL_SCOPES).map(([key, label]) => <button key={key} aria-pressed={scope === key} onClick={() => { setScope(key); setTargetId('') }}>{label}</button>)}</div>

    <section className="surface-panel daily-filters" aria-label="Filtros de metas"><div className="daily-filter-grid pace-filter-grid">
      <label className="daily-field"><span>Ano</span><select aria-label="Ano" className="ds-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>{[...new Set([year, ...Array.from({ length: 9 }, (_, index) => Number(today.slice(0, 4)) - 5 + index)])].sort((a,b)=>a-b).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="daily-field"><span>Mês</span><select aria-label="Mês" className="ds-input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      {scope !== 'overall' && <label className="daily-field"><span>{GOAL_SCOPES[scope]}</span><select aria-label={scope === 'product' ? 'Família de produto' : GOAL_SCOPES[scope]} className="ds-input" value={scopeId} onChange={event => setTargetId(event.target.value)}>{!targetOptions.length && <option value="">Nenhum cadastro disponível</option>}{targetOptions.map(item => <option key={item.id} value={item.id}>{item.name}{item.active === false ? ' · histórico' : ''}</option>)}</select></label>}
      <label className="daily-field"><span>Base financeira</span><select aria-label="Base financeira" className="ds-input" value={metric} onChange={(event) => setSelectedMetric(event.target.value)}>{Object.entries(PACE_METRICS).map(([key, item]) => <option key={key} value={key}>{item.label}{!scopePlans.some((plan) => plan.metric === key) ? ' · sem meta' : ''}</option>)}</select></label>
      <div className="daily-field"><span>Distribuição da meta</span><strong className="pace-basis">{selectedPlan ? pace.basis === 'business' ? 'Dias úteis · seg–sex' : 'Dias corridos' : 'Meta não definida'}</strong></div>
    </div><p className="daily-footnote">O dia atual conta como transcorrido. Dias úteis consideram segunda a sexta, sem calendário de feriados. Horário de Brasília.</p></section>

    <MonthlyPaceChart pace={pace} ready={Boolean(current)} loading={loading} targetUnavailable={Boolean(current?.plansError)} breakdown={scope === 'overall' ? selectedPlan?.breakdown : null} scopeName={goalScopeName(selection)} periodLabel={`${MONTHS[month - 1]} de ${year}`} today={today} selectionKey={`${periodKey}:${goalScopeKey(selection)}:${metric}`} />

    <div className="daily-feedback" aria-live="polite">
      {loading && !current && <p className="daily-notice">Carregando metas e vendas do período.</p>}
      {current?.plansError && <p className="daily-notice is-warning" role="alert">Metas indisponíveis. Não foi possível consultar o plano deste mês.</p>}
      {current && !current.plansError && !selectedPlan && <p className="daily-notice">Ainda não há meta para este escopo e indicador. {hasPermission('goals') && <Link to="/metas">Configurar uma meta</Link>}</p>}
      {selectedPlan && !pace.validTarget && <p className="daily-notice is-warning">A meta está zerada ou sem valor válido. Percentual de ritmo e atingimento dependem de uma meta maior que zero.</p>}
      {pace.future && <p className="daily-notice">Período não iniciado. A curva mostra o planejamento; o realizado será acompanhado a partir de {MONTHS[month - 1].toLowerCase()}.</p>}
      {current && !pace.future && (!pace.definitive || current.salesError) && <p className="daily-notice is-warning">Leitura parcial: {pace.sourceIncomplete ? 'a cobertura deste indicador está incompleta. ' : ''}{pace.missingRecords > 0 ? `${pace.missingRecords} registros não informam ${pace.metric.label.toLowerCase()}. ` : ''}Os resultados não representam um ritmo definitivo.</p>}
      {current?.directoryError && ['team', 'individual'].includes(scope) && <p className="daily-notice is-warning" role="alert">Não foi possível consultar times e pessoas. {scope === 'team' ? 'O vínculo das vendas ao time está indisponível.' : 'Os nomes exibidos usam o histórico das metas.'}</p>}
      {current && !pace.future && pace.unassignedRecords > 0 && <p className="daily-notice is-warning">Há {value(pace.unassignedValue)} em {pace.unassignedRecords} registros sem {scope === 'team' ? 'time' : scope === 'individual' ? 'vendedor' : 'produto'} identificado na operação. Eles não foram atribuídos a esta meta. {hasPermission('attribution') && <Link to="/atribuicao">Revisar atribuições</Link>}</p>}
      {scope === 'team' && <p className="daily-footnote">O time reúne vendas atribuídas às pessoas que pertencem a ele atualmente. Alterar a composição do time também altera esta leitura histórica.</p>}
      {metric === 'cash' && goalData.excludedCashManuals.length > 0 && <p className="daily-notice is-warning">Há {goalData.excludedCashManuals.length} lançamentos manuais Asaas na operação sem vínculo com um recebimento do extrato. O caixa desses lançamentos não foi somado, para evitar possível duplicidade; seus valores brutos continuam nas vendas.</p>}
      {metric === 'cash' && <p className="daily-notice">Cash collected considera 40% do bruto vendido na TMB, na data da venda. Asaas mantém os recebimentos confirmados na data de entrada, antes das taxas, inclusive parcelas anteriores. Demais lançamentos manuais usam o caixa e a data informados. {goalData.cashUnavailableSources.length > 0 && `Sem extrato de recebimentos no período: ${goalData.cashUnavailableSources.join(', ')}.`} Valores do Asaas sem vínculo com produto ou vendedor entram apenas no geral.</p>}
    </div>

    <section className="pace-financial-grid" aria-label="Bruto e cash collected">
      {financialSummary.map(({ metric: key, pace: item }) => <button key={key} className={`surface-panel pace-financial-card${metric === key ? ' is-selected' : ''}`} onClick={() => setSelectedMetric(key)} aria-pressed={metric === key}>
        <span className="pace-financial-label">{key === 'gross' ? 'Valor bruto' : 'Cash collected'}</span><p>{key === 'gross' ? 'Valor total das vendas, antes das taxas.' : 'TMB: 40% do bruto; Asaas e demais recebimentos.'}</p>
        <strong>{item.future ? 'Não iniciado' : formatValue(item.actual, 'currency')}</strong><span>{!item.definitive && !item.future ? 'Realizado parcial' : 'Realizado no mês'}</span>
        <div><span>Meta <b>{current?.plansError ? 'Indisponível' : item.validTarget ? formatValue(item.target, 'currency') : 'Não definida'}</b></span><span>Pace <b>{percent(item.pacePercent)}</b></span></div>
      </button>)}
    </section>

    <section className="surface-panel pace-milestones" aria-label="Níveis da meta">
      <h2>Meta, supermeta e ultrameta</h2>
      <div className="pace-levels">{[['Meta', pace.target], ['Supermeta', pace.superTarget], ['Ultrameta', pace.ultraTarget]].map(([label, target]) => <div key={label}><span>{label}</span><strong>{current?.plansError ? 'Indisponível' : target > 0 ? value(target) : 'Não definida'}</strong><small>{target > 0 && pace.actual !== null && !pace.future ? percent(pace.actual / target * 100) : '—'}</small></div>)}</div>
      {selectedPlan?.notes && <p className="daily-footnote">{selectedPlan.notes}</p>}
    </section>

    <section className="stat-grid daily-stats pace-rhythm-strip" aria-label="Ritmo da meta" aria-busy={loading}>
      <PaceCard title="Realizado no mês" value={pace.future ? 'Não iniciado' : value(pace.actual)} note={`${pace.future ? '' : partialLabel}${pace.metric.label}. ${pace.ended ? 'Mês encerrado.' : 'Até a data de hoje.'}`} tone="actual" />
      <PaceCard title="Esperado até hoje" value={current?.plansError ? 'Indisponível' : pace.validTarget ? value(pace.expected) : 'Sem meta'} note={elapsedNote} />
      <PaceCard title="Ritmo da meta" value={percent(pace.pacePercent)} note={pace.pacePercent === null ? 'Disponível após início do mês e definição da meta.' : `${partialLabel}100% significa acompanhar o planejado.`} tone={pace.definitive && pace.pacePercent !== null ? pace.pacePercent >= 100 ? 'ahead' : 'behind' : undefined} />
      <PaceCard title={pace.ended ? 'Fechamento realizado' : 'Projeção do mês'} value={value(pace.projection)} note={pace.ended ? 'Valor observado no encerramento.' : `${partialLabel}Projeção linear pelo ritmo observado; não é uma previsão garantida.`} />
    </section>

    <div className="analytics-grid pace-analysis-grid">
      <ChartPanel title="Entrega de cada dia" description="Realizado diário e parcela planejada da meta, na mesma base financeira." footer={`${pace.definitive ? '' : 'Leitura parcial. '}Dias futuros exibem somente o planejamento; dias sem valor conhecido permanecem indisponíveis.`}>
        <ReferenceChart title="Realizado diário × meta diária" rows={pace.rows} series={[{ key: 'dailyActual', label: pace.definitive ? 'Realizado no dia' : 'Realizado parcial no dia', unit }, { key: 'dailyTarget', label: 'Meta diária', unit, color: 'var(--chart-4, #2589b8)' }]} height={300} mode="bar" />
      </ChartPanel>
      <ChartPanel title="Distância do planejado" description="Diferença acumulada: acima de zero, o realizado está à frente; abaixo, está atrás." footer={pace.validTarget ? `${pace.definitive ? '' : 'Leitura parcial. '}Comparação apenas dos dias observados e valores com data identificada.` : 'Defina uma meta para acompanhar a diferença. Nenhum valor foi substituído por zero.'}>
        <ReferenceChart title="Diferença acumulada da meta" rows={deviationRows} series={[{ key: 'deviation', label: pace.definitive ? 'Diferença acumulada' : 'Diferença acumulada parcial', unit, color: 'var(--chart-2, #8064d8)' }]} height={300} mode="area" />
      </ChartPanel>
    </div>

    {overview.length > 1 && <ChartPanel title="Atingimento das metas" description={`Compare o percentual realizado na base ${pace.metric.label.toLowerCase()}. Cada barra representa uma meta independente.`} footer={`${attainmentItems.length ? 'Selecione uma barra para acompanhar a meta. ' : 'Ainda não há atingimento disponível neste recorte. '}${overview.length > attainmentItems.length ? `${overview.length - attainmentItems.length} metas sem percentual disponível. ` : ''}Os escopos não são somados; metas parciais continuam identificadas.`} className="pace-attainment-panel">
      <RankedBars items={attainmentItems} unit="percent" limit={8} onSelect={selectOverviewPlan} />
    </ChartPanel>}

    {overview.length > 1 && <section className="surface-panel daily-panel"><div className="daily-section-heading"><div><h2>Metas da operação</h2><p>Metas independentes na base {pace.metric.label.toLowerCase()}. Os escopos não devem ser somados.</p></div></div><div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Escopo</th><th>Meta de</th><th>Meta</th><th>Realizado</th><th>Esperado</th><th>Ritmo</th><th>Atingimento</th></tr></thead><tbody>{overview.map(({ plan, pace: item }) => <tr key={plan.id || `${goalScopeKey(plan)}:${plan.metric}`}><td>{GOAL_SCOPES[goalScope(plan).scope]}</td><td><button className="pace-table-link" onClick={() => { const target = goalScope(plan); setScope(target.scope); setTargetId(target.scopeId) }}>{goalScopeName(plan)}</button>{!item.definitive && <small className="daily-cell-note">Parcial</small>}</td><td>{item.validTarget ? value(item.target) : 'Não definida'}</td><td>{value(item.actual)}</td><td>{value(item.expected)}</td><td>{percent(item.pacePercent)}</td><td>{percent(item.attainment)}</td></tr>)}</tbody></table></div></section>}

    <section className="surface-panel daily-panel"><div className="daily-section-heading"><div><h2>Dia a dia</h2><p>O ritmo compara acumulados. “—” indica um dia ainda não observado ou um valor indisponível.</p></div></div><div className="daily-table-scroll"><table className="data-table pace-day-table"><thead><tr><th>Dia</th><th>Planejado no dia</th><th>Realizado no dia</th><th>Planejado acumulado</th><th>Realizado acumulado</th><th>Diferença acumulada</th></tr></thead><tbody>{pace.rows.map((row) => <tr key={row.date} className={row.date === today ? 'pace-current-day' : ''}><td><strong>{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong><small className="daily-cell-note">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short' })}{row.date === today ? ' · hoje' : ''}</small></td><td>{row.dailyTarget === null ? '—' : value(row.dailyTarget)}</td><td>{row.dailyActual === null ? '—' : value(row.dailyActual)}</td><td>{row.planned === null ? '—' : value(row.planned)}</td><td>{row.actual === null ? '—' : value(row.actual)}</td><td>{row.actual === null || row.planned === null ? '—' : value(row.actual - row.planned)}</td></tr>)}</tbody></table></div></section>
  </div>
}
