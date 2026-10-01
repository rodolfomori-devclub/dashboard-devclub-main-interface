/* eslint-disable react/prop-types -- Internal React 19 components with explicit props. */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Building2, Package, UserRound, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { requestApi } from '../lib/api'
import { PageSkeleton } from '../components/WorkspaceLayout'
import GoalMetricEditor from '../components/goals/GoalMetricEditor'
import { GOAL_METRICS, GOAL_SCOPES, goalPlanKey, goalScopeTargets, normalizeGoalPlan } from '../components/goals/goalConfig'
import '../components/goals/goalsConfig.css'

const HubGoals = lazy(() => import('./HubGoals'))
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const SCOPE_ICONS = { overall: Building2, product: Package, team: Users, individual: UserRound }
const SELECT_LABELS = { product: 'Família de produtos', team: 'Time', individual: 'Indivíduo' }
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 })
const quantity = new Intl.NumberFormat('pt-BR')

export default function GoalsPage() {
  const { userRoles, hasPermission } = useAuth()
  const admin = Boolean(userRoles?.isAdmin)
  const [year, setYear] = useState(new Date().getFullYear()), [month, setMonth] = useState(new Date().getMonth() + 1)
  const [tab, setTab] = useState('plans'), [scope, setScope] = useState('overall')
  const [selection, setSelection] = useState({ product: 'MBA', team: '', individual: '' })
  const [metric, setMetric] = useState('operational'), [plans, setPlans] = useState([])
  const [options, setOptions] = useState({ teams: [], individuals: [] })
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0)
  const [optionsLoading, setOptionsLoading] = useState(true), [optionsError, setOptionsError] = useState(''), [optionsRevision, setOptionsRevision] = useState(0)
  const period = `${year}/${month}`, periodRef = useRef(period)
  periodRef.current = period

  useEffect(() => {
    if (tab !== 'plans') return
    const controller = new AbortController()
    setLoading(true); setPlans([]); setError('')
    requestApi(`/goal-plans/${year}/${month}`, { signal: controller.signal })
      .then(result => { if (!Array.isArray(result.plans)) throw new Error('A consulta não retornou as metas do período. Tente novamente.'); if (!controller.signal.aborted) setPlans(result.plans.map(normalizeGoalPlan)) })
      .catch(failure => { if (!controller.signal.aborted) setError(failure.message) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [year, month, revision, tab])

  useEffect(() => {
    const controller = new AbortController()
    setOptionsLoading(true); setOptionsError('')
    requestApi('/goal-plans/options', { signal: controller.signal })
      .then(result => { if (!Array.isArray(result.teams) || !Array.isArray(result.individuals)) throw new Error('A consulta não retornou os cadastros disponíveis.'); if (!controller.signal.aborted) setOptions({ teams: result.teams, individuals: result.individuals }) })
      .catch(failure => { if (!controller.signal.aborted) setOptionsError(failure.message || 'Não foi possível consultar os times e indivíduos.') })
      .finally(() => { if (!controller.signal.aborted) setOptionsLoading(false) })
    return () => controller.abort()
  }, [optionsRevision])

  const targets = goalScopeTargets(scope, options, plans)
  const scopeId = scope === 'overall' ? '' : selection[scope]
  const target = targets.find(item => item.id === scopeId)
  const needsOptions = scope === 'team' || scope === 'individual'
  const editable = admin && target?.active && (!needsOptions || (!optionsLoading && !optionsError))
  const selectedPlan = indicator => plans.find(plan => plan.scope === scope && plan.scopeId === scopeId && plan.metric === indicator)
  const scopePlans = plans.filter(plan => plan.scope === scope)
  async function save(payload) {
    const savedPeriod = period
    const result = await requestApi(`/goal-plans/${savedPeriod}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!result.plan) throw new Error('O servidor não confirmou a gravação da meta. Tente novamente.')
    const saved = normalizeGoalPlan(result.plan)
    if (periodRef.current === savedPeriod) setPlans(previous => [...previous.filter(plan => goalPlanKey(plan) !== goalPlanKey(saved)), saved])
  }
  const editor = indicator => <GoalMetricEditor key={`${period}:${scope}:${scopeId}:${indicator}`} plan={selectedPlan(indicator)} scope={scope} scopeId={scopeId} scopeName={target.name} metric={indicator} editable={editable && (!target.excludedFromRanking || Boolean(selectedPlan(indicator)))} onSave={save} />

  return <div className="hub-page goals-config-page">
    <header className="page-heading"><div><h1>Metas da operação</h1><p>Planeje o resultado geral, por produto, time e indivíduo.</p></div>{hasPermission('goal-pace') && <Link className="button button-primary" to={`/pace?year=${year}&month=${month}`}><ArrowUpRight size={17} />Acompanhar o ritmo</Link>}</header>
    <div className="tab-strip" role="tablist" aria-label="Grupo de metas">{[['plans', 'Planejamento mensal'], ['finance', 'Receita por pagamento'], ['legacy', 'Metas comerciais anteriores']].map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'legacy' ? <><p className="goal-plan-help">Configurações anteriores do módulo comercial. Elas mantêm seus próprios critérios e não alteram o planejamento mensal por escopo.</p><Suspense fallback={<PageSkeleton />}><HubGoals /></Suspense></> : <>
      <div className="filter-bar"><label>Mês<select value={month} onChange={event => setMonth(Number(event.target.value))}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label><label>Ano<input type="number" min="2000" max="2100" value={year} onChange={event => { const next = Number(event.target.value); if (next >= 2000 && next <= 2100) setYear(next) }} /></label></div>
      {tab === 'finance' ? <RevenueGoals year={year} month={month} admin={admin} /> : <>
        <nav className="goal-scope-nav" aria-label="Escopo da meta">{GOAL_SCOPES.map(item => { const Icon = SCOPE_ICONS[item.id]; return <button key={item.id} type="button" aria-pressed={scope === item.id} aria-label={item.label} onClick={() => setScope(item.id)}><Icon size={20} /><span><strong>{item.label}</strong><small>{item.description}</small></span></button> })}</nav>
        <p className="goal-plan-help">A meta geral é composta por Marketing + Vendas. Metas de produtos, times e indivíduos têm acompanhamento independente.</p>
        <section className="goal-scope-context" aria-label="Destino do planejamento"><div><h2>{target?.name || `Selecione um ${scope === 'individual' ? 'indivíduo' : 'time'}`}</h2><p>{MONTHS[month - 1]} de {year} · Bruto e cash collected têm metas e acompanhamento próprios.</p></div>{scope !== 'overall' && <label className="goal-selection">{SELECT_LABELS[scope]}<select className="ds-input" aria-label={SELECT_LABELS[scope]} value={scopeId} disabled={needsOptions && (optionsLoading || Boolean(optionsError))} onChange={event => setSelection(previous => ({ ...previous, [scope]: event.target.value }))}>{needsOptions && <option value="">Selecione {scope === 'team' ? 'um time' : 'um indivíduo'}</option>}{targets.map(item => <option key={item.id} value={item.id} disabled={!item.active}>{item.name}{item.excludedFromRanking ? ' · Fora dos cálculos · histórico' : !item.active ? ' · Inativo' : ''}</option>)}</select></label>}</section>
        {target?.excludedFromRanking && <p className="notice">Esta pessoa está fora dos cálculos de desempenho. As metas existentes podem ser consultadas e ajustadas; novos indicadores ficam disponíveis após sua reinclusão pelo administrador.</p>}
        {needsOptions && optionsLoading && <p className="notice" role="status">Carregando times e indivíduos…</p>}
        {needsOptions && optionsError && <div className="notice notice-error" role="alert">Times e indivíduos indisponíveis: {optionsError}<button className="underline ml-3" onClick={() => setOptionsRevision(value => value + 1)}>Consultar cadastros novamente</button></div>}
        {error && <div className="notice notice-error" role="alert">{error}<button className="underline ml-3" onClick={() => setRevision(value => value + 1)}>Tentar novamente</button></div>}
        {loading ? <PageSkeleton /> : !error && <>
          {target ? <><div className="surface-panel goal-financial-grid">{editor('gross')}{editor('cash')}</div><details className="surface-panel goal-extras"><summary>Outros indicadores</summary><p>As metas de valor operacional, líquido e quantidade continuam disponíveis separadamente.</p><label className="goal-selection">Indicador adicional<select className="ds-input" aria-label="Indicador adicional" value={metric} onChange={event => setMetric(event.target.value)}>{['operational', 'net', 'count'].map(indicator => <option key={indicator} value={indicator}>{GOAL_METRICS[indicator].label}</option>)}</select></label>{editor(metric)}</details></> : !optionsLoading && !optionsError && <div className="surface-panel goal-scope-empty">{targets.some(item => item.active) ? `Selecione ${scope === 'team' ? 'um time' : 'um indivíduo'} para configurar suas metas.` : scope === 'individual' ? 'Ainda não há indivíduos ativos disponíveis. As pessoas aparecem após o primeiro acesso ao módulo comercial.' : 'Ainda não há times ativos disponíveis no módulo comercial.'}</div>}
          {scopePlans.length > 0 && <section className="surface-panel"><div className="goal-history-heading"><h2>Metas configuradas · {GOAL_SCOPES.find(item => item.id === scope).label}</h2><span>{scopePlans.length} {scopePlans.length === 1 ? 'indicador configurado' : 'indicadores configurados'}</span></div><div className="goal-history"><table><thead><tr><th>Destino / indicador</th><th>Meta base</th><th>Supermeta</th><th>Ultrameta</th><th>Ritmo</th></tr></thead><tbody>{scopePlans.map(plan => { const destination = targets.find(item => item.id === plan.scopeId); const format = value => (plan.metric === 'count' ? quantity : currency).format(value); return <tr key={goalPlanKey(plan)}><td>{destination?.name || plan.scopeName || plan.scopeId}<small>{GOAL_METRICS[plan.metric]?.label || plan.metric}{destination?.excludedFromRanking ? ' · Fora dos cálculos' : destination?.active === false ? ' · Cadastro inativo' : ''}</small></td><td>{format(plan.target)}</td><td>{format(plan.superTarget)}</td><td>{format(plan.ultraTarget)}</td><td>{plan.paceBasis === 'business' ? 'Dias úteis' : 'Dias corridos'}</td></tr> })}</tbody></table></div></section>}
        </>}
      </>}
    </>}
  </div>
}
function RevenueGoals({year,month,admin}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[saving,setSaving]=useState(false),[message,setMessage]=useState('')
 useEffect(()=>{let active=true;setData(null);setError('');requestApi(`/goals/revenue/month/${year}/${month}`).then(result=>{if(active)setData(result.data)}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[year,month])
 const save=async()=>{setSaving(true);setError('');try{await requestApi(`/goals/revenue/month/${year}/${month}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});setMessage('Metas financeiras salvas.')}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <section className="surface-panel space-y-5"><h2 className="text-lg">Receita por meio de pagamento</h2><p className="text-sm text-muted-foreground">Metas financeiras existentes, preservadas no banco do Dashboard.</p>{error&&<p role="alert" className="notice notice-error">{error}</p>}{message&&<p role="status">{message}</p>}{!data&&!error?<PageSkeleton/>:data&&<><fieldset disabled={!admin||saving} className="space-y-5">{[['faturamentoCartao','Faturamento no cartão'],['faturamentoBoleto','Faturamento no boleto'],['investimentoTrafego','Orçamento de aquisição']].map(([key,label])=><div key={key}><h3 className="text-sm mb-2">{label}</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{['base','super','ultra'].map(level=><label key={level} className="ds-label">{level==='base'?'Meta base':level==='super'?'Supermeta':'Ultrameta'} (R$)<input className="ds-input mt-2" type="number" min="0" step=".01" value={data[key]?.[level]??0} onChange={e=>setData({...data,[key]:{...data[key],[level]:Number(e.target.value)}})}/></label>)}</div></div>)}</fieldset>{admin&&<button className="button button-primary" disabled={saving} onClick={save}>{saving?'Salvando…':'Salvar metas financeiras'}</button>}</>}</section>
}
