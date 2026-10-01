/* eslint-disable react/prop-types -- Internal UI props in React 19. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { RefreshCw, ArrowDownRight, ArrowUpRight, Target } from 'lucide-react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
import { formatValue } from '../components/charts/chartFormatters'
import { loadSalesRange } from '../components/daily/dailyData'
import { PRODUCT_FAMILIES } from '../utils/salesData'
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
  const [product, setProduct] = useState('all')
  const [selectedMetric, setSelectedMetric] = useState('operational')
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const [chartMode, setChartMode] = useState('line')
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
      future ? Promise.resolve({ records: [], sources: [], fetchedAt: Date.now() }) : loadSalesRange(bounds.start, today < bounds.end ? today : bounds.end, { force }),
    ])
    if (id !== requestId.current) return
    const goalResult = results[0], salesResult = results[1]
    const plans = goalResult.status === 'fulfilled' ? goalResult.value.data?.plans : null
    setState({ periodKey: `${year}-${month}`, plans: Array.isArray(plans) ? plans : [], plansError: !Array.isArray(plans), salesError: salesResult.status === 'rejected', sales: salesResult.status === 'fulfilled' ? salesResult.value : null })
    setLoading(false)
  }, [year, month, today, bounds])

  useEffect(() => { load(); return () => { requestId.current += 1 } }, [load])
  const current = state?.periodKey === periodKey ? state : null
  const plans = current?.plans || EMPTY
  const productPlans = plans.filter((item) => item.product === product)
  const selectedPlan = productPlans.find((item) => item.metric === selectedMetric) || null
  const metric = selectedPlan?.metric || selectedMetric
  const records = current?.sales?.records || EMPTY
  const sources = current?.sales?.sources || EMPTY
  const pace = useMemo(() => calculateGoalPace({ year, month, plan: selectedPlan || { product, metric }, records, sources, today }), [year, month, selectedPlan, product, metric, records, sources, today])
  const overview = useMemo(() => plans.filter((item) => item.metric === metric).map((plan) => ({ plan, pace: calculateGoalPace({ year, month, plan, records, sources, today }) })), [plans, metric, year, month, records, sources, today])
  const unit = pace.metric.unit
  const value = (number) => formatValue(number, unit)
  const percent = (number) => number === null ? '—' : `${number.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
  const partialLabel = pace.definitive ? '' : 'Parcial · '
  const familyOptions = [...new Set(['all', ...PRODUCT_FAMILIES.filter((family) => family !== 'Não informado'), ...plans.map((plan) => plan.product)])]
  const elapsedNote = pace.future ? 'O mês ainda não começou.' : `${pace.elapsedDays} de ${pace.totalDays} dias ${pace.basis === 'business' ? 'úteis' : 'corridos'} considerados.`

  return <div className="hub-page daily-page pace-page">
    <header className="page-heading daily-heading"><div><h1>Metas e ritmo de vendas</h1><p>Compare o realizado com o avanço esperado ao longo do mês.</p></div><div className="daily-refresh"><button className="button button-primary" onClick={() => load(true)} disabled={loading}><RefreshCw size={16} className={loading ? 'daily-spin' : ''} />{loading ? 'Atualizando' : 'Atualizar dados'}</button>{hasPermission('goals') && <Link to="/metas" className="pace-configure">Configurar metas</Link>}</div></header>

    <section className="surface-panel daily-filters" aria-label="Filtros de metas"><div className="daily-filter-grid pace-filter-grid">
      <label className="daily-field"><span>Ano</span><select aria-label="Ano" className="ds-input" value={year} onChange={(event) => setYear(Number(event.target.value))}>{[...new Set([year, ...Array.from({ length: 9 }, (_, index) => Number(today.slice(0, 4)) - 5 + index)])].sort((a,b)=>a-b).map((item) => <option key={item}>{item}</option>)}</select></label>
      <label className="daily-field"><span>Mês</span><select aria-label="Mês" className="ds-input" value={month} onChange={(event) => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      <label className="daily-field"><span>Família de produto</span><select aria-label="Família de produto" className="ds-input" value={product} onChange={(event) => setProduct(event.target.value)}>{familyOptions.map((family) => <option key={family} value={family}>{family === 'all' ? 'Geral · todas as famílias' : family}</option>)}</select></label>
      <label className="daily-field"><span>Base financeira</span><select aria-label="Base financeira" className="ds-input" value={metric} onChange={(event) => setSelectedMetric(event.target.value)}>{Object.entries(PACE_METRICS).map(([key, item]) => <option key={key} value={key}>{item.label}{!productPlans.some((plan) => plan.metric === key) ? ' · sem meta' : ''}</option>)}</select></label>
      <div className="daily-field"><span>Distribuição da meta</span><strong className="pace-basis">{selectedPlan ? pace.basis === 'business' ? 'Dias úteis · seg–sex' : 'Dias corridos' : 'Meta não definida'}</strong></div>
    </div><p className="daily-footnote">O dia atual conta como transcorrido. Dias úteis consideram segunda a sexta, sem calendário de feriados. Horário de Brasília.</p></section>

    <div className="daily-feedback" aria-live="polite">
      {loading && !current && <p className="daily-notice">Carregando metas e vendas do período.</p>}
      {current?.plansError && <p className="daily-notice is-warning" role="alert">Metas indisponíveis. Não foi possível consultar o plano deste mês.</p>}
      {current && !current.plansError && !selectedPlan && <p className="daily-notice">Ainda não há meta para esta família e base financeira. {hasPermission('goals') && <Link to="/metas">Configurar uma meta</Link>}</p>}
      {selectedPlan && !pace.validTarget && <p className="daily-notice is-warning">A meta está zerada ou sem valor válido. Percentual de ritmo e atingimento dependem de uma meta maior que zero.</p>}
      {pace.future && <p className="daily-notice">Período não iniciado. A curva mostra o planejamento; o realizado será acompanhado a partir de {MONTHS[month - 1].toLowerCase()}.</p>}
      {current && !pace.future && (!pace.definitive || current.salesError) && <p className="daily-notice is-warning">Leitura parcial: {pace.sourceIncomplete ? 'há fontes de vendas indisponíveis. ' : ''}{pace.missingRecords > 0 ? `${pace.missingRecords} registros não informam ${pace.metric.label.toLowerCase()}. ` : ''}Os resultados não representam um ritmo definitivo.</p>}
    </div>

    <section className="stat-grid daily-stats" aria-label="Ritmo da meta" aria-busy={loading}>
      <PaceCard title="Realizado no mês" value={pace.future ? 'Não iniciado' : value(pace.actual)} note={`${pace.future ? '' : partialLabel}${pace.metric.label}. ${pace.ended ? 'Mês encerrado.' : 'Até a data de hoje.'}`} tone="actual" />
      <PaceCard title="Esperado até hoje" value={pace.validTarget ? value(pace.expected) : 'Sem meta'} note={elapsedNote} />
      <PaceCard title="Ritmo da meta" value={percent(pace.pacePercent)} note={pace.pacePercent === null ? 'Disponível após início do mês e definição da meta.' : `${partialLabel}100% significa acompanhar o planejado.`} tone={pace.definitive && pace.pacePercent !== null ? pace.pacePercent >= 100 ? 'ahead' : 'behind' : undefined} />
      <PaceCard title={pace.ended ? 'Fechamento realizado' : 'Projeção do mês'} value={value(pace.projection)} note={pace.ended ? 'Valor observado no encerramento.' : `${partialLabel}Projeção linear pelo ritmo observado; não é uma previsão garantida.`} />
    </section>

    <section className="surface-panel daily-panel pace-hero">
      <div className="pace-summary"><div className="pace-summary-title"><Target size={18} /><h2>{product === 'all' ? 'Meta geral' : product}</h2></div><strong className="pace-target">{pace.validTarget ? value(pace.target) : 'Sem meta definida'}</strong><span className="daily-footnote">{MONTHS[month - 1]} de {year} · {pace.metric.label}</span>
        <div className="pace-progress" role="progressbar" aria-label="Atingimento da meta" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pace.attainment === null ? undefined : Math.max(0, Math.min(100, pace.attainment))}><i style={{ width: `${Math.max(0, Math.min(100, pace.attainment || 0))}%` }} /></div><p className="pace-attainment">{pace.attainment === null ? 'Atingimento indisponível' : `${percent(pace.attainment)} de atingimento${pace.definitive ? '' : ' parcial'}`}</p>
        <div className="pace-delta">{pace.delta !== null && (pace.delta >= 0 ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />)}<div><strong>{pace.delta === null ? 'Comparação indisponível' : `${value(Math.abs(pace.delta))} ${pace.delta >= 0 ? 'à frente' : 'atrás'}`}</strong><span>{pace.delta !== null && pace.pacePercent !== null ? `${percent(Math.abs(pace.pacePercent - 100))} ${pace.delta >= 0 ? 'acima' : 'abaixo'} do esperado${pace.definitive ? '' : ' · parcial'}` : 'O comparativo usa o planejamento acumulado.'}</span></div></div>
        <div className="pace-needed"><span>{pace.ended ? 'Saldo para atingir a meta' : 'Necessário por dia restante'}</span><strong>{value(pace.ended ? pace.remaining : pace.requiredPerDay)}</strong><small>{pace.ended ? 'O período está encerrado.' : `${pace.remainingDays} dias ${pace.basis === 'business' ? 'úteis' : 'corridos'} restantes.${pace.remaining === 0 ? ' Meta atingida.' : ''}`}</small></div>
        <div className="pace-levels">{[['Meta', pace.target], ['Supermeta', pace.superTarget], ['Ultrameta', pace.ultraTarget]].map(([label, target]) => <div key={label}><span>{label}</span><strong>{target > 0 ? value(target) : 'Não definida'}</strong><small>{target > 0 && pace.actual !== null ? percent(pace.actual / target * 100) : '—'}</small></div>)}</div>
        {selectedPlan?.notes && <p className="daily-footnote">{selectedPlan.notes}</p>}
      </div>
      <div className="pace-visual"><div className="daily-section-heading"><div><h2>Realizado × planejado</h2><p>Acumulado do mês; dias futuros não recebem vendas presumidas.</p></div><div className="daily-segment" role="group" aria-label="Formato do gráfico"><button className="button" aria-pressed={chartMode === 'line'} onClick={() => setChartMode('line')}>Linhas</button><button className="button" aria-pressed={chartMode === 'bar'} onClick={() => setChartMode('bar')}>Barras</button></div></div>
        <ReferenceChart title="Evolução acumulada da meta" rows={pace.rows} series={[{ key: 'actual', label: pace.definitive ? 'Realizado' : 'Realizado parcial', unit }, { key: 'planned', label: 'Planejado', unit, color: 'var(--chart-4, #2589b8)', dash: '5 4' }]} height={360} mode={chartMode} />
        {pace.unallocatedRecords > 0 && <p className="daily-footnote">{pace.unallocatedRecords} registros ({value(pace.unallocated)}) sem data identificável no mês estão no realizado total, mas não foram distribuídos na curva.</p>}
      </div>
    </section>

    {overview.length > 1 && <section className="surface-panel daily-panel"><div className="daily-section-heading"><div><h2>Metas por produto</h2><p>Comparativo das metas cadastradas na base {pace.metric.label.toLowerCase()}.</p></div></div><div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Família</th><th>Meta</th><th>Realizado</th><th>Esperado</th><th>Ritmo</th><th>Atingimento</th></tr></thead><tbody>{overview.map(({ plan, pace: item }) => <tr key={plan.id || `${plan.product}:${plan.metric}`}><td><button className="pace-table-link" onClick={() => setProduct(plan.product)}>{plan.product === 'all' ? 'Geral' : plan.product}</button>{!item.definitive && <small className="daily-cell-note">Parcial</small>}</td><td>{item.validTarget ? value(item.target) : 'Não definida'}</td><td>{value(item.actual)}</td><td>{value(item.expected)}</td><td>{percent(item.pacePercent)}</td><td>{percent(item.attainment)}</td></tr>)}</tbody></table></div></section>}

    <section className="surface-panel daily-panel"><div className="daily-section-heading"><div><h2>Dia a dia</h2><p>O ritmo compara acumulados. “—” indica um dia ainda não observado ou um valor indisponível.</p></div></div><div className="daily-table-scroll"><table className="data-table pace-day-table"><thead><tr><th>Dia</th><th>Planejado no dia</th><th>Realizado no dia</th><th>Planejado acumulado</th><th>Realizado acumulado</th><th>Diferença acumulada</th></tr></thead><tbody>{pace.rows.map((row) => <tr key={row.date} className={row.date === today ? 'pace-current-day' : ''}><td><strong>{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</strong><small className="daily-cell-note">{new Date(`${row.date}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short' })}{row.date === today ? ' · hoje' : ''}</small></td><td>{row.dailyTarget === null ? '—' : value(row.dailyTarget)}</td><td>{row.dailyActual === null ? '—' : value(row.dailyActual)}</td><td>{row.planned === null ? '—' : value(row.planned)}</td><td>{row.actual === null ? '—' : value(row.actual)}</td><td>{row.actual === null || row.planned === null ? '—' : value(row.actual - row.planned)}</td></tr>)}</tbody></table></div></section>
  </div>
}
