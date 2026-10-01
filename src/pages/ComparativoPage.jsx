import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, CircleAlert, RefreshCw } from 'lucide-react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
import RefundSummary from '../components/charts/RefundSummary'
import { loadSalesRange, localDateKey } from '../components/daily/dailyData'
import { EMPTY_FILTERS, UNKNOWN, filterOptions } from '../utils/salesData'
import { buildComparisonSnapshot, compareMetrics, comparisonGroups, comparisonSeries, validateComparisonRanges } from '../utils/comparisonData'

const COLORS = { a: '#335cff', b: '#8a72ba' }
const dateLabel = value => value.split('-').reverse().join('/')
const rangeLabel = range => range.startDate === range.endDate ? dateLabel(range.startDate) : `${dateLabel(range.startDate)} a ${dateLabel(range.endDate)}`
const format = (value, unit = 'currency') => value == null ? '—' : new Intl.NumberFormat('pt-BR', unit === 'currency' ? { style: 'currency', currency: 'BRL' } : { maximumFractionDigits: 1 }).format(value)
const signed = (value, unit) => value == null ? '—' : `${value > 0 ? '+' : ''}${format(value, unit)}`
const addDays = (day, offset) => new Date(Date.parse(`${day}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
const sourceStatus = value => ({ ready: 'Disponível', partial: 'Parcial', unavailable: 'Indisponível' })[value] || 'Indisponível'
const metricDisplay = (metric, unit = 'currency') => <span className="tabular-nums">{format(metric?.value, unit)}{metric?.partial && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-300 mt-1">Parcial</span>}</span>
const deltaDisplay = (a, b, unit = 'currency') => {
  const delta = compareMetrics(a, b)
  if (delta.absolute === null) return <span className="text-xs text-slate-500">{delta.reason === 'partial' ? 'Dados parciais' : 'Sem dados comparáveis'}</span>
  return <span className="tabular-nums">{signed(delta.absolute, unit)}<span className="block text-xs text-slate-500 mt-1">{delta.percent === null ? 'Base B igual a zero · % indisponível' : `${delta.percent > 0 ? '+' : ''}${format(delta.percent, 'count')}%`}</span></span>
}
function initialDates() {
  const today = localDateKey()
  return {
    days: { a: { startDate: today, endDate: today }, b: { startDate: addDays(today, -1), endDate: addDays(today, -1) } },
    periods: { a: { startDate: addDays(today, -6), endDate: today }, b: { startDate: addDays(today, -13), endDate: addDays(today, -7) } },
  }
}
const PRIMARY_METRICS = [
  ['revenue', 'Receita operacional', 'currency'], ['count', 'Vendas', 'count'], ['ticket', 'Ticket médio', 'currency'],
  ['gross', 'Bruto informado', 'currency'], ['net', 'Líquido informado', 'currency'], ['received', 'Caixa informado', 'currency'],
]
const DETAIL_METRICS = [
  ['digital', 'Receita digital (Guru + Hotmart)', 'currency'], ['digitalCount', 'Vendas digitais', 'count'],
  ['boleto', 'Receita de boleto (TMB, Asaas e Boletex)', 'currency'], ['boletoCount', 'Vendas de boleto', 'count'],
  ['commercial', 'Receita do comercial identificado', 'currency'], ['commercialCount', 'Vendas do comercial identificado', 'count'],
  ['affiliate', 'Afiliação informada', 'currency'], ['fees', 'Taxas informadas', 'currency'],
  ['listPrice', 'Preço de tabela informado', 'currency'], ['pending', 'Pendente informado', 'currency'],
  ['dailyRevenue', 'Receita média por dia', 'currency'], ['dailyCount', 'Vendas médias por dia', 'count'],
  ['dailyBoleto', 'Receita de boleto média por dia', 'currency'], ['dailyBoletoCount', 'Vendas de boleto médias por dia', 'count'],
]

export default function ComparativoPage() {
  const [drafts, setDrafts] = useState(initialDates)
  const [mode, setMode] = useState('days')
  const [selection, setSelection] = useState(() => ({ mode: 'days', ...initialDates().days, force: false }))
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validation, setValidation] = useState('')
  const [chartMode, setChartMode] = useState('line')
  const [groupBy, setGroupBy] = useState('product')
  const [groupSearch, setGroupSearch] = useState('')
  const [groupPage, setGroupPage] = useState(1)
  const [topMetric, setTopMetric] = useState('revenue')

  useEffect(() => {
    let active = true
    setLoading(true); setError(''); setData(null)
    Promise.all([
      loadSalesRange(selection.a.startDate, selection.a.endDate, { force: selection.force }),
      loadSalesRange(selection.b.startDate, selection.b.endDate, { force: selection.force }),
    ]).then(([a, b]) => { if (active) setData({ a, b }) })
      .catch(() => { if (active) setError('Não foi possível carregar a comparação. Confira as datas e tente atualizar.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [selection])

  const allRecords = useMemo(() => [...(data?.a.records || []), ...(data?.b.records || [])], [data])
  const snapshots = useMemo(() => data ? {
    a: buildComparisonSnapshot(data.a, filters, selection.a), b: buildComparisonSnapshot(data.b, filters, selection.b),
  } : null, [data, filters, selection])
  const groups = useMemo(() => snapshots ? comparisonGroups(snapshots.a, snapshots.b, groupBy) : [], [snapshots, groupBy])
  const daily = useMemo(() => snapshots ? comparisonSeries(snapshots.a, snapshots.b) : null, [snapshots])
  const hourly = useMemo(() => snapshots ? comparisonSeries(snapshots.a, snapshots.b, { hourly: true }) : null, [snapshots])
  const groupRows = groups.filter(row => row.name.toLocaleLowerCase('pt-BR').includes(groupSearch.toLocaleLowerCase('pt-BR')))
  const groupPages = Math.max(1, Math.ceil(groupRows.length / 15))
  const currentPage = Math.min(groupPage, groupPages)
  const displayedGroups = groupRows.slice((currentPage - 1) * 15, currentPage * 15)
  const topGroups = [...groups].sort((a, b) => Math.max(b.a[topMetric].value || 0, b.b[topMetric].value || 0) - Math.max(a.a[topMetric].value || 0, a.b[topMetric].value || 0)).slice(0, 5)
  const sourceIds = snapshots ? [...new Set([...snapshots.a.sources, ...snapshots.b.sources].map(source => source.id))] : []
  const hasSourceFailures = snapshots && [...snapshots.a.sources, ...snapshots.b.sources].some(source => source.status !== 'ready')
  const hasAllocationWarning = snapshots && (snapshots.a.allocationMissing || snapshots.b.allocationMissing)
  const axis = selection.mode === 'days' ? hourly : daily
  const today = localDateKey()
  const isCurrent = selection.a.endDate >= today || selection.b.endDate >= today
  const chartSeries = (key, unit) => [
    { key: `a${key}`, label: `A · ${rangeLabel(selection.a)}`, unit, color: COLORS.a },
    { key: `b${key}`, label: `B · ${rangeLabel(selection.b)}`, unit, color: COLORS.b },
  ]
  function updateDate(side, field, value) {
    setValidation('')
    setDrafts(old => ({ ...old, [mode]: { ...old[mode], [side]: mode === 'days' ? { startDate: value, endDate: value } : { ...old[mode][side], [field]: value } } }))
  }
  function applyComparison(event) {
    event.preventDefault()
    try {
      validateComparisonRanges(drafts[mode].a, drafts[mode].b)
      if (drafts[mode].a.endDate > today || drafts[mode].b.endDate > today) throw new Error('Selecione datas até hoje para comparar vendas observadas.')
      setValidation(''); setGroupPage(1); setSelection({ mode, ...drafts[mode], force: false })
    } catch (problem) { setValidation(problem.message) }
  }
  function changeFilter(key, value) {
    setGroupPage(1)
    setFilters(old => ({ ...old, [key]: value, ...(key === 'family' ? { product: '' } : {}) }))
  }
  function comparisonTableRows(definitions) {
    return definitions.map(([key, label, unit]) => <tr key={key} className="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" className="py-4 pr-6 text-left font-medium">{label}</th>
      <td className="py-4 pr-6">{metricDisplay(snapshots.a.metrics[key], unit)}</td>
      <td className="py-4 pr-6">{metricDisplay(snapshots.b.metrics[key], unit)}</td>
      <td className="py-4">{deltaDisplay(snapshots.a.metrics[key], snapshots.b.metrics[key], unit)}</td>
    </tr>)
  }
  const tableHead = <thead><tr>{['Indicador', 'Período A', 'Período B · base', 'Variação A − B'].map(label => <th key={label} scope="col" className="text-left text-xs font-medium text-slate-500 py-3 pr-6">{label}</th>)}</tr></thead>

  return <div className="hub-page space-y-5">
    <header className="page-heading flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl font-semibold tracking-tight">Comparativo</h1><p className="text-sm text-slate-500 mt-2 max-w-2xl">Compare dois dias ou intervalos com as mesmas fontes da visão global.</p></div>
      <button type="button" className="btn btn-ghost disabled:opacity-40" disabled={loading} onClick={() => setSelection(old => ({ ...old, force: true }))}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} />Atualizar fontes</button>
    </header>

    <form className="surface-panel ds-card p-5 space-y-5" onSubmit={applyComparison}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 gap-1" role="group" aria-label="Tipo de comparação">
          {[['days', 'Dias'], ['periods', 'Intervalos']].map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setValidation('') }} className={`px-4 py-2 rounded-md text-sm font-medium ${mode === key ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{label}</button>)}
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setDrafts(old => ({ ...old, [mode]: { a: old[mode].b, b: old[mode].a } })); setValidation('') }}><ArrowLeftRight size={15} />Inverter períodos</button>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {['a', 'b'].map(side => <fieldset key={side} className="min-w-0 border-l-2 pl-4" style={{ borderColor: COLORS[side] }}>
          <legend className="text-sm font-semibold mb-3">Período {side.toUpperCase()}{side === 'b' ? ' · base de comparação' : ''}</legend>
          <div className={`grid gap-3 ${mode === 'periods' ? 'sm:grid-cols-2' : ''}`}>
            <label className="text-xs text-slate-500">{mode === 'days' ? 'Dia' : 'Início'}<input required aria-label={`${mode === 'days' ? 'Dia' : 'Início'} do período ${side.toUpperCase()}`} type="date" max={today} value={drafts[mode][side].startDate} onChange={e => updateDate(side, 'startDate', e.target.value)} className="ds-input mt-1 w-full" /></label>
            {mode === 'periods' && <label className="text-xs text-slate-500">Fim<input required aria-label={`Fim do período ${side.toUpperCase()}`} type="date" max={today} min={drafts[mode][side].startDate} value={drafts[mode][side].endDate} onChange={e => updateDate(side, 'endDate', e.target.value)} className="ds-input mt-1 w-full" /></label>}
          </div>
        </fieldset>)}
      </div>
      <div className="flex flex-wrap justify-between gap-3 items-center"><p className="text-xs text-slate-500">Intervalos incluem o primeiro e o último dia e devem ter a mesma duração.</p><button type="submit" className="btn btn-primary">Comparar períodos</button></div>
      {validation && <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">{validation}</p>}
    </form>

    <section className="filter-bar ds-card p-4 grid sm:grid-cols-2 xl:grid-cols-5 gap-3" aria-label="Filtros da comparação">
      {[['family', 'Família'], ['product', 'Produto'], ['platform', 'Plataforma'], ['payment', 'Pagamento']].map(([key, label]) => <label key={key} className="min-w-0 text-xs text-slate-500">{label}<select aria-label={label} className="ds-input mt-1 w-full" value={filters[key]} onChange={e => changeFilter(key, e.target.value)}><option value="">Todos</option>{filterOptions(key === 'product' && filters.family ? allRecords.filter(row => row.family === filters.family) : allRecords, key).filter(value => value !== 'Não informado').map(value => <option key={value} value={value}>{value}</option>)}<option value={UNKNOWN}>Não informado</option></select></label>)}
      <button type="button" className="btn btn-ghost self-end" disabled={!Object.values(filters).some(Boolean)} onClick={() => { setFilters({ ...EMPTY_FILTERS }); setGroupPage(1) }}>Limpar filtros</button>
    </section>
    {loading && <div className="ds-card p-10 text-center text-sm text-slate-500" role="status">Carregando os dois períodos e verificando as fontes…</div>}
    {error && <p className="ds-card p-5 text-sm text-amber-700 dark:text-amber-300" role="alert">{error}</p>}

    {snapshots && <>
      <section className="grid md:grid-cols-2 gap-4" aria-label="Períodos em comparação">
        {['a', 'b'].map(side => <div key={side} className="ds-card p-5 border-t-[3px]" style={{ borderTopColor: COLORS[side] }}><p className="text-sm font-semibold">Período {side.toUpperCase()}{side === 'b' ? ' · base' : ''}</p><p className="text-sm text-slate-500 mt-1">{rangeLabel(selection[side])} · {snapshots[side].days} {snapshots[side].days === 1 ? 'dia' : 'dias'}</p><p className="text-2xl font-semibold tracking-tight mt-5">{metricDisplay(snapshots[side].metrics.revenue)}</p><p className="text-xs text-slate-500 mt-2">Receita operacional · {format(snapshots[side].metrics.count.value, 'count')} vendas</p></div>)}
      </section>
      {(hasSourceFailures || hasAllocationWarning || isCurrent) && <div className="ds-card p-4 flex gap-3 text-sm text-slate-600 dark:text-slate-300" role="status"><CircleAlert size={18} className="shrink-0 mt-0.5" /><div className="space-y-1">{hasSourceFailures && <p>Algumas fontes não responderam. Os valores disponíveis aparecem como parciais e suas variações ficam suspensas.</p>}{hasAllocationWarning && <p>Há saldos sem identificação fora dos filtros. A distribuição completa por produto ou pagamento não está disponível.</p>}{isCurrent && <p>Hoje ainda está em andamento. Seus resultados representam o observado até a última atualização.</p>}</div></div>}

      <section className="ds-card p-5"><h2 className="text-base font-semibold">Resultado dos períodos</h2><div className="overflow-x-auto mt-3"><table className="data-table w-full text-sm min-w-[680px]">{tableHead}<tbody>{comparisonTableRows(PRIMARY_METRICS)}</tbody></table></div><p className="text-xs text-slate-500 mt-4 max-w-4xl">Receita operacional soma o líquido de Guru e Hotmart, o contratado de TMB, Asaas e Boletex e o líquido das vendas manuais. Bruto, líquido e caixa são informações separadas; valores parciais incluem apenas o que cada fonte informou. — significa indisponível.</p></section>

      <section className="ds-card p-5">
        <div className="flex flex-wrap justify-between gap-3 items-start mb-5"><div><h2 className="font-semibold">{selection.mode === 'days' ? 'Receita ao longo do dia' : 'Receita ao longo dos períodos'}</h2><p className="text-xs text-slate-500 mt-1">{selection.mode === 'days' ? 'Horários de Brasília, com horário de venda informado.' : 'Dias alinhados pela posição dentro de cada intervalo.'}</p></div><div className="flex gap-1" role="group" aria-label="Estilo do gráfico">{[['line', 'Linhas'], ['bar', 'Barras']].map(([value, label]) => <button key={value} type="button" className={`btn btn-sm ${chartMode === value ? 'btn-primary' : 'btn-ghost'}`} aria-pressed={chartMode === value} onClick={() => setChartMode(value)}>{label}</button>)}</div></div>
        <ReferenceChart rows={axis.rows} series={chartSeries('Revenue', 'currency')} title="Comparação de receita operacional" height={330} mode={chartMode} daily={false} />
        {(axis.omittedA > 0 || axis.omittedB > 0) && <p className="text-xs text-slate-500 mt-4">Fora deste gráfico por falta de {selection.mode === 'days' ? 'horário exato' : 'data individual'}: {axis.omittedA} registros em A e {axis.omittedB} em B. Eles permanecem no resultado do período.</p>}
        {(hasSourceFailures || snapshots.a.metrics.revenue.partial || snapshots.b.metrics.revenue.partial) && <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">O gráfico representa a parcela observada. Lacunas de valores não são substituídas por zero.</p>}
      </section>
      <section className="grid xl:grid-cols-2 gap-5">
        <div className="ds-card p-5"><h2 className="font-semibold mb-4">Volume de vendas {selection.mode === 'days' ? 'por hora' : 'por dia'}</h2><ReferenceChart rows={axis.rows} series={chartSeries('Count', 'count')} title="Comparação do volume de vendas" height={280} mode="bar" daily={false} /></div>
        <div className="ds-card p-5"><h2 className="font-semibold mb-4">Receita digital e de boleto</h2><ReferenceChart rows={['digital', 'boleto'].map(key => ({ label: key === 'digital' ? 'Digital' : 'Boleto', aRevenue: snapshots.a.metrics[key].value, bRevenue: snapshots.b.metrics[key].value }))} series={chartSeries('Revenue', 'currency')} title="Receita digital e de boleto" height={280} mode="bar" daily={false} /></div>
      </section>
      {selection.mode === 'periods' && <details className="ds-card p-5"><summary className="font-semibold cursor-pointer">Perfil por hora e alinhamento dos dias</summary><p className="text-xs text-slate-500 mt-3">As horas somam todos os dias de cada intervalo. Registros sem horário exato ficam fora deste perfil: A {hourly.omittedA}, B {hourly.omittedB}.</p><div className="grid xl:grid-cols-2 gap-5 mt-5"><ReferenceChart rows={hourly.rows} series={chartSeries('Revenue', 'currency')} title="Receita por hora nos intervalos" height={280} mode={chartMode} daily={false} /><ReferenceChart rows={hourly.rows} series={chartSeries('Count', 'count')} title="Vendas por hora nos intervalos" height={280} mode="bar" daily={false} /></div><div className="overflow-x-auto mt-4 max-h-80"><table className="data-table w-full text-xs min-w-[650px]"><thead><tr>{['Posição', 'Data A', 'Data B', 'Receita A', 'Receita B', 'Vendas A', 'Vendas B'].map(label => <th key={label} className="text-left text-slate-500 py-3 pr-4">{label}</th>)}</tr></thead><tbody>{daily.rows.map(row => <tr key={row.label} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3 pr-4">{row.label}</td><td>{dateLabel(row.aDate)}</td><td>{dateLabel(row.bDate)}</td><td>{format(row.aRevenue)}</td><td>{format(row.bRevenue)}</td><td>{format(row.aCount, 'count')}</td><td>{format(row.bCount, 'count')}</td></tr>)}</tbody></table></div></details>}

      <details className="ds-card p-5"><summary className="font-semibold cursor-pointer">Composição financeira e indicadores adicionais</summary><div className="overflow-x-auto mt-3"><table className="data-table w-full text-sm min-w-[740px]">{tableHead}<tbody>{comparisonTableRows(DETAIL_METRICS)}</tbody></table></div><p className="text-xs text-slate-500 mt-4">Comercial considera a identificação disponível na Guru. Os reembolsos e as contestações estão detalhados separadamente por período abaixo.</p></details>

      <div className="space-y-4">{['a', 'b'].map(side => <RefundSummary key={side} title={`Reembolsos · período ${side.toUpperCase()} · ${rangeLabel(selection[side])}`} records={snapshots[side].records} sources={snapshots[side].sources} platform={filters.platform} ready loading={loading} startDate={selection[side].startDate} endDate={selection[side].endDate} />)}</div>

      <section className="ds-card p-5"><h2 className="font-semibold">Fontes da comparação</h2><p className="text-xs text-slate-500 mt-1">Vendas manuais já vinculadas a uma transação importada não são contadas novamente.</p><div className="overflow-x-auto mt-4"><table className="data-table w-full text-sm min-w-[930px]"><thead><tr>{['Fonte', 'Estado A', 'Estado B', 'Vendas / registros A', 'Vendas / registros B', 'Valor A', 'Valor B', 'Variação A − B'].map(label => <th key={label} className="text-left text-xs font-medium text-slate-500 py-3 pr-4">{label}</th>)}</tr></thead><tbody>{sourceIds.map(id => {
        const a = snapshots.a.sources.find(source => source.id === id)
        const b = snapshots.b.sources.find(source => source.id === id)
        return <tr key={id} className="border-t border-slate-100 dark:border-slate-800"><th scope="row" className="text-left py-4 pr-4 font-medium">{a?.kind === 'refund' || b?.kind === 'refund' ? `Estornos / contestações · ${a?.platform || b?.platform}` : a?.label || b?.label || id}</th><td className={`pr-4 text-xs ${a?.status !== 'ready' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}`}>{sourceStatus(a?.status)}</td><td className={`pr-4 text-xs ${b?.status !== 'ready' ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}`}>{sourceStatus(b?.status)}</td><td className="pr-4">{metricDisplay(a?.count, 'count')}</td><td className="pr-4">{metricDisplay(b?.count, 'count')}</td><td className="pr-4">{metricDisplay(a?.revenue)}</td><td className="pr-4">{metricDisplay(b?.revenue)}</td><td>{deltaDisplay(a?.revenue, b?.revenue)}</td></tr>
      })}</tbody></table></div></section>

      <section className="ds-card p-5"><div className="flex flex-wrap justify-between gap-4 items-end"><div><h2 className="font-semibold">Distribuição comparada</h2><p className="text-xs text-slate-500 mt-1">Quantidade e receita dos registros identificados em cada grupo.</p></div><div className="flex flex-wrap gap-3"><label className="text-xs text-slate-500">Agrupar por<select className="ds-input mt-1" value={groupBy} onChange={e => { setGroupBy(e.target.value); setGroupPage(1); setGroupSearch('') }}>{[['product', 'Produto'], ['family', 'Família'], ['payment', 'Pagamento']].map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-xs text-slate-500">Buscar grupo<input className="ds-input mt-1" value={groupSearch} onChange={e => { setGroupSearch(e.target.value); setGroupPage(1) }} placeholder="Nome do grupo" /></label></div></div><div className="overflow-x-auto mt-4"><table className="data-table w-full text-sm min-w-[930px]"><thead><tr>{['Grupo', 'Vendas A', 'Vendas B', 'Variação de vendas', 'Receita A', 'Receita B', 'Variação da receita'].map(label => <th key={label} className="text-left text-xs font-medium text-slate-500 py-3 pr-5">{label}</th>)}</tr></thead><tbody>{displayedGroups.map(row => <tr key={row.name} className="border-t border-slate-100 dark:border-slate-800"><th scope="row" className="text-left font-medium py-4 pr-5 max-w-xs break-words">{row.name}</th><td className="pr-5">{metricDisplay(row.a.count, 'count')}</td><td className="pr-5">{metricDisplay(row.b.count, 'count')}</td><td className="pr-5">{deltaDisplay(row.a.count, row.b.count, 'count')}</td><td className="pr-5">{metricDisplay(row.a.revenue)}</td><td className="pr-5">{metricDisplay(row.b.revenue)}</td><td>{deltaDisplay(row.a.revenue, row.b.revenue)}</td></tr>)}</tbody></table></div>{!groupRows.length && <p className="text-center text-sm text-slate-500 py-8">Nenhuma venda encontrada para estes filtros.</p>}<div className="flex flex-wrap justify-between items-center gap-3 mt-4 text-xs text-slate-500"><span>{groupRows.length} grupos</span><div className="flex items-center gap-3"><button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" disabled={currentPage === 1} onClick={() => setGroupPage(currentPage - 1)}>Anterior</button>{currentPage} / {groupPages}<button type="button" className="btn btn-ghost btn-sm disabled:opacity-40" disabled={currentPage === groupPages} onClick={() => setGroupPage(currentPage + 1)}>Próxima</button></div></div></section>
      <section className="ds-card p-5"><div className="flex flex-wrap justify-between gap-3 items-center mb-4"><h2 className="font-semibold">Cinco maiores grupos</h2><label className="text-xs text-slate-500">Ordenar e comparar por<select className="ds-input mt-1" value={topMetric} onChange={e => setTopMetric(e.target.value)}><option value="revenue">Receita operacional</option><option value="count">Quantidade de vendas</option></select></label></div><ReferenceChart rows={topGroups.map(row => ({ label: row.name.length > 15 ? `${row.name.slice(0, 14)}…` : row.name, aValue: row.a[topMetric].value, bValue: row.b[topMetric].value }))} series={chartSeries('Value', topMetric === 'revenue' ? 'currency' : 'count')} title="Comparação dos cinco maiores grupos" mode="bar" daily={false} height={320} rotateDates /><p className="text-xs text-slate-500 mt-3">Os nomes completos dos grupos aparecem na tabela acima.</p></section>
      <p className="text-xs text-slate-500 pb-4">Atualizado às {new Date(Math.max(data.a.fetchedAt, data.b.fetchedAt)).toLocaleTimeString('pt-BR')}. Percentuais usam B como base. Valores sem produto ou data permanecem nos totais disponíveis e não são distribuídos por estimativa.</p>
    </>}
  </div>
}
