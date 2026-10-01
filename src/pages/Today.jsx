/* eslint-disable react/prop-types -- Internal UI props; React 19 does not use runtime propTypes. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
import { ChartPanel, RankedBars, MixChart } from '../components/charts/AnalyticsVisuals'
import RevenueHighlights from '../components/charts/RevenueHighlights'
import FinancialValue from '../components/charts/FinancialValue'
import RefundSummary from '../components/charts/RefundSummary'
import RevenueNotifications from '../components/charts/RevenueNotifications'
import { buildRevenueNotices } from '../utils/revenueBreakdown'
import { ArrowLeft, ArrowRight, ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { formatCurrency } from '../utils/currencyUtils'
import { EMPTY_FILTERS, filterOptions, filterSales, groupSales, hourlySales, PRODUCT_FAMILIES, summarizeSales, UNKNOWN, UTM_FIELDS } from '../utils/salesData'
import { loadDailySales, localDateKey } from '../components/daily/dailyData'
import '../components/daily/daily.css'
import AsaasCashPanel from '../components/daily/AsaasCashPanel'
import { sourceHasSales } from '../utils/sourceAvailability'

const PAGE_SIZE = 20
const NO_RECORDS = []
const money = (value) => value === null || value === undefined ? 'Não informado' : formatCurrency(value)
const clock = (value) => value ? new Date(value).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : 'Sem horário'

function FilterSelect({ label, value, onChange, options, unknown = false }) {
  return <label className="daily-field"><span>{label}</span><select aria-label={label} className="ds-input" value={value} onChange={(event) => onChange(event.target.value)}>
    <option value="">Todos</option>{options.filter((item) => item !== 'Não informado').map((item) => <option key={item} value={item}>{item}</option>)}
    {(unknown || options.includes('Não informado')) && <option value={UNKNOWN}>Não informado</option>}
  </select></label>
}

function SectionHeading({ title, description, children }) {
  return <div className="daily-section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>
}

export default function Today() {
  const [date, setDate] = useState(localDateKey)
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [utmDimension, setUtmDimension] = useState('source')
  const [listKind, setListKind] = useState('sale')
  const [chartMode, setChartMode] = useState('area')
  const [chartView, setChartView] = useState('cumulative')
  const [page, setPage] = useState(1)
  const requestId = useRef(0)

  const refresh = useCallback(async (force = false) => {
    const id = ++requestId.current
    setLoading(true)
    setLoadError(false)
    try {
      const result = await loadDailySales(date, { force })
      if (requestId.current === id) setData(result)
    } catch {
      if (requestId.current === id) setLoadError(true)
    } finally {
      if (requestId.current === id) setLoading(false)
    }
  }, [date])

  useEffect(() => { refresh(); return () => { requestId.current += 1 } }, [refresh])
  useEffect(() => {
    if (!autoRefresh || date !== localDateKey()) return undefined
    const timer = setInterval(() => { if (!document.hidden) refresh(true) }, 5 * 60_000)
    return () => clearInterval(timer)
  }, [autoRefresh, date, refresh])

  const current = data?.date === date ? data : null
  const records = current?.records || NO_RECORDS
  const filtered = useMemo(() => filterSales(records, filters), [records, filters])
  const sales = useMemo(() => filtered.filter((row) => row.kind === 'sale'), [filtered])
  const summary = useMemo(() => summarizeSales(sales), [sales])
  const products = useMemo(() => groupSales(sales, 'product'), [sales])
  const platforms = useMemo(() => groupSales(sales, 'sourceId'), [sales])
  const payments = useMemo(() => groupSales(sales, 'payment'), [sales])
  const attribution = useMemo(() => groupSales(sales, utmDimension), [sales, utmDimension])
  const hourly = useMemo(() => hourlySales(sales), [sales])
  const relevantSources = (current?.sources || []).filter((source) => !filters.platform || source.platform === filters.platform || source.id === 'manual')
  const saleSources = relevantSources.filter((source) => source.kind === 'sale')
  const refundSources = relevantSources.filter((source) => source.kind === 'refund')
  const salesAvailable = saleSources.some((source) => sourceHasSales(source) && (source.id !== 'manual' || sales.some((row) => row.sourceId === 'manual')))
  const refundsAvailable = refundSources.some((source) => source.status === 'ready')
  const partial = saleSources.some((source) => source.status !== 'ready') || summary.revenue.missing > 0
  const activeFilters = Object.values(filters).filter(Boolean).length
  const list = useMemo(() => filtered.filter((row) => row.kind === listKind).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)), [filtered, listKind])
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const visiblePage = Math.min(page, pages)
  const visibleRows = list.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)
  const listAvailable = listKind === 'sale' ? salesAvailable : refundsAvailable
  const updateFilter = (key, value) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1) }
  const resetFilters = () => { setFilters({ ...EMPTY_FILTERS }); setPage(1) }
  const displayMetric = (metric, available = salesAvailable) => !available ? 'Indisponível' : metric.known || !metric.missing ? money(metric.value) : 'Não informado'
  const knownUtmCount = sales.filter((row) => row.utm[utmDimension]).reduce((sum, row) => sum + row.quantity, 0)
  const observedHour = date === localDateKey() ? Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(current?.fetchedAt || Date.now()))) : 23
  const chartHours = useMemo(() => {
    let cumulative = 0, complete = true
    return hourly.hours.map((hour, index) => {
      const future = index > observedHour
      if (!future) {
        if (hour.value === null) complete = false
        else cumulative += hour.value
      }
      return { ...hour, label: hour.hour, future, value: future ? null : hour.value, count: future ? null : hour.count, cumulative: future || !complete ? null : cumulative }
    })
  }, [hourly, observedHour])
  const hasTimedSales = summary.count === 0 || hourly.unknown < summary.count
  const amountGaps = chartHours.some(hour => !hour.future && hour.missingAmounts > 0)
  const productBars = products.map(product => ({ key: product.name, label: product.name, value: product.revenue.known ? product.revenue.value : null, count: product.count, partial: product.revenue.missing > 0, ...(product.name === 'Não informado' ? { color: 'var(--muted)' } : {}) }))
  const originBars = attribution.map(group => ({ key: group.name, label: group.name, value: group.count, ...(group.name === 'Não informado' ? { color: 'var(--muted)' } : {}) })).sort((a, b) => b.value - a.value)
  const paymentMix = payments.map(group => ({ key: group.name, label: group.name, value: group.count, ...(group.name === 'Não informado' ? { color: 'var(--muted)' } : {}) })).sort((a, b) => b.value - a.value)
  const paymentMixValid = paymentMix.every(item => Number.isFinite(item.value) && item.value >= 0)
  const notifications = current ? buildRevenueNotices(relevantSources, filters, { partial, records: filtered }) : []

  return <div className="hub-page daily-page">
    <header className="page-heading daily-heading"><div><h1>Diário de vendas</h1><p>Acompanhe o dia, os produtos e a origem de cada venda.</p></div><div className="daily-heading-actions"><RevenueNotifications items={notifications} /><div className="daily-refresh"><button className="button button-primary" onClick={() => refresh(true)} disabled={loading}><RefreshCw size={16} className={loading ? 'daily-spin' : ''} />{loading ? 'Atualizando' : 'Atualizar dados'}</button><span>{current ? `Atualizado às ${clock(current.fetchedAt)}` : 'Aguardando dados'}</span></div></div></header>

    <RevenueHighlights records={filtered} sources={relevantSources} filters={filters} title="Valor das vendas" loading={loading} ready={Boolean(current)} error={loadError} />

    <RefundSummary records={filtered} sources={relevantSources} platform={filters.platform} ready={Boolean(current)} loading={loading} error={Boolean(loadError)} startDate={date} endDate={date} />

    <section className="surface-panel daily-filters" aria-label="Filtros do diário">
      <div className="daily-filter-heading"><span><SlidersHorizontal size={17} />Visualização do dia</span><button className="button daily-clear" onClick={resetFilters} disabled={!activeFilters}>Limpar filtros{activeFilters ? ` (${activeFilters})` : ''}</button></div>
      <div className="filter-bar daily-filter-grid">
        <label className="daily-field"><span>Data</span><input className="ds-input" type="date" value={date} max={localDateKey()} onChange={(event) => { if (event.target.value) { setDate(event.target.value); setPage(1) } }} /></label>
        <FilterSelect label="Família de produto" value={filters.family} onChange={(value) => updateFilter('family', value)} options={PRODUCT_FAMILIES} />
        <FilterSelect label="Produto original" value={filters.product} onChange={(value) => updateFilter('product', value)} options={filterOptions(records, 'product')} unknown />
        <FilterSelect label="Plataforma" value={filters.platform} onChange={(value) => updateFilter('platform', value)} options={[...new Set(['Guru', 'Hotmart', 'TMB', 'Asaas', 'Boletex', ...filterOptions(records, 'platform')])]} />
        <FilterSelect label="Pagamento" value={filters.payment} onChange={(value) => updateFilter('payment', value)} options={filterOptions(records, 'payment')} unknown />
      </div>
      <details className="daily-utm-filters"><summary>Filtrar por UTMs<ChevronDown size={15} /></summary><div className="daily-filter-grid">{UTM_FIELDS.map((field) => <FilterSelect key={field} label={`UTM ${field}`} value={filters[field]} onChange={(value) => updateFilter(field, value)} options={filterOptions(records, field)} unknown />)}</div></details>
      <div className="daily-filter-foot"><p>Os filtros se aplicam a todos os indicadores, gráficos e registros desta tela.</p><label><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />Atualizar hoje a cada 5 min</label></div>
    </section>

    <div aria-live="polite" className="daily-feedback">
      {loading && !current && <p className="daily-notice">Carregando as fontes do dia. Os valores aparecerão quando a consulta terminar.</p>}
      {loadError && <p className="daily-notice is-warning" role="alert">Não foi possível atualizar os dados. Use “Atualizar dados” para tentar novamente.</p>}
    </div>

    <ChartPanel className="analytics-feature daily-hourly" title="Vendas por hora" description="Evolução do valor das vendas no horário de Brasília. A quantidade aparece em uma escala separada."
      action={<div className="daily-chart-controls"><div className="daily-chart-switch" role="group" aria-label="Leitura do gráfico"><button type="button" aria-pressed={chartView === 'hourly'} onClick={() => setChartView('hourly')}>Por hora</button><button type="button" aria-pressed={chartView === 'cumulative'} onClick={() => setChartView('cumulative')}>Acumulado</button></div><div className="daily-chart-switch" role="group" aria-label="Formato do gráfico"><button type="button" aria-pressed={chartMode === 'area'} onClick={() => setChartMode('area')}>Linhas</button><button type="button" aria-pressed={chartMode === 'bar'} onClick={() => setChartMode('bar')}>Barras</button></div></div>}
      footer={<p className="daily-footnote">{hourly.unknownRecords > 0 ? `${hourly.unknownRecords} registros sem horário (${hourly.unknown} vendas) não entram no gráfico.` : 'Apenas registros com horário informado entram na leitura por hora.'} {date === localDateKey() && 'As horas após a última atualização permanecem em aberto.'} {partial && 'A leitura inclui apenas as fontes disponíveis.'}</p>}>
      {!salesAvailable ? <p className="daily-empty">Vendas por hora indisponíveis até uma fonte responder.</p> : !hasTimedSales ? <p className="daily-empty">As vendas deste recorte não têm horário informado. Seus valores continuam nos indicadores e registros do dia.</p> : <>
        <div className="daily-primary-chart"><div className="daily-chart-caption"><span><i aria-hidden="true" />{chartView === 'cumulative' ? 'Valor acumulado' : 'Valor por hora'}</span><small>{date === localDateKey() ? `Hoje, até ${current ? clock(current.fetchedAt) : 'a última atualização'}` : 'Dia completo'}{partial ? ' · parcial' : ''}</small></div><ReferenceChart title={chartView === 'cumulative' ? 'Valor acumulado por hora' : 'Valor das vendas por hora'} rows={chartHours} series={[{ key: chartView === 'cumulative' ? 'cumulative' : 'value', label: chartView === 'cumulative' ? 'Valor acumulado' : 'Valor por hora', unit: 'currency', color: 'var(--chart-1)' }]} daily={false} mode={chartMode} height={350} showLegend={false} /></div>
        {amountGaps && <p className="daily-footnote daily-chart-gap">Há valores não informados em alguns horários. O acumulado fica em aberto a partir da primeira lacuna.</p>}
        <div className="daily-volume-chart"><div className="daily-chart-caption"><h3>Quantidade por hora</h3><small>Mesmos horários e filtros</small></div><ReferenceChart title="Quantidade de vendas por hora" rows={chartHours} series={[{ key: 'count', label: 'Vendas', unit: 'count', color: 'var(--chart-2)' }]} daily={false} mode="bar" height={145} showLegend={false} /></div>
        <details className="daily-hour-table"><summary>Ver tabela por hora<ChevronDown size={15} /></summary><div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Hora</th><th>Vendas</th><th>Valor contabilizado</th></tr></thead><tbody>{chartHours.map(hour => <tr key={hour.hour}><td>{hour.hour}{hour.future && <small className="daily-cell-note">Ainda não observado</small>}</td><td>{hour.future ? '—' : hour.count}</td><td>{hour.future ? '—' : money(hour.value)}</td></tr>)}</tbody></table></div></details>
      </>}
    </ChartPanel>

    <div className="analytics-grid analytics-grid--wide daily-sales-analysis">
      <ChartPanel className="daily-products" title="Produtos do dia" description="Nome original preservado. Ordenados pelo valor das vendas." footer={products.some(product => product.revenue.missing > 0) ? <p className="daily-footnote">Produtos com valores ausentes são identificados como parciais ou não informados.</p> : null}>
        {!salesAvailable ? <p className="daily-empty">Produtos indisponíveis até uma fonte responder.</p> : !products.length ? <p className="daily-empty">Nenhuma venda encontrada com estes filtros.</p> : <RankedBars items={productBars} limit={7} />}
      </ChartPanel>
      <ChartPanel className="daily-payment-mix" title="Formas de pagamento" description="Distribuição da quantidade de vendas no recorte." footer={<p className="daily-footnote">Pagamentos ausentes permanecem como “Não informado”. {partial && 'A consulta é parcial.'}</p>}>
        {!salesAvailable ? <p className="daily-empty">Pagamentos indisponíveis até uma fonte responder.</p> : !paymentMixValid ? <p className="daily-empty">A fonte informou ajustes de quantidade. A distribuição não é exibida; confira os valores nos registros do dia.</p> : <MixChart items={paymentMix} totalLabel="vendas" emptyLabel="Nenhuma venda neste recorte." />}
      </ChartPanel>
    </div>

    <ChartPanel className="daily-origin-panel" title="Origem das vendas" description="UTMs recebidas nas transações. Ausência de UTM não é classificada como orgânico." action={<label className="daily-field daily-dimension"><span>Agrupar por</span><select aria-label="Agrupar por UTM" className="ds-input" value={utmDimension} onChange={event => setUtmDimension(event.target.value)}>{UTM_FIELDS.map(field => <option value={field} key={field}>UTM {field}</option>)}</select></label>}>
      {salesAvailable && <p className="daily-origin-coverage"><strong>{knownUtmCount.toLocaleString('pt-BR')} de {summary.count.toLocaleString('pt-BR')}</strong> vendas com UTM {utmDimension} informada.</p>}
      <div className="daily-attribution-layout"><div className="daily-origin-chart"><h3>Quantidade por UTM {utmDimension}</h3>{salesAvailable ? <RankedBars items={originBars} unit="count" limit={6} /> : <p className="daily-empty">Origem indisponível até as fontes responderem.</p>}</div>
        <div className="daily-table-scroll"><table className="data-table daily-attribution-table"><thead><tr><th>UTM {utmDimension}</th><th>Vendas</th><th>Valor das vendas</th><th>Participação em vendas</th></tr></thead><tbody>{attribution.map(group => <tr key={group.name}><td>{group.name}</td><td>{group.count}</td><td>{group.revenue.known ? money(group.revenue.value) : 'Não informado'}</td><td>{summary.count ? `${(group.count / summary.count * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</td></tr>)}{!attribution.length && <tr><td colSpan={4} className="daily-empty">{salesAvailable ? 'Nenhuma venda neste recorte.' : 'Origem indisponível até as fontes responderem.'}</td></tr>}</tbody></table></div>
      </div>
    </ChartPanel>

    <section className="surface-panel daily-panel daily-financial">
      <SectionHeading title="Composição financeira" description="Valores retornados pelas plataformas, sem recalcular as taxas." />
      <div className="daily-financial-grid">{[['Bruto informado', 'gross'], ['Líquido informado', 'net'], ['Taxas e descontos', 'fees'], ['Afiliados (líquido)', 'affiliate']].map(([label, key]) => <div key={key}><span>{label}</span><strong><FinancialValue ready={Boolean(current)} loading={loading} error={loadError} compact>{displayMetric(summary[key])}</FinancialValue></strong><small>{summary[key].missing ? `${summary[key].missing} registros sem esse valor` : salesAvailable ? 'Dados disponíveis no recorte' : 'Fonte indisponível'}</small></div>)}</div>
      <details className="daily-calculation"><summary>Como ler estes valores<ChevronDown size={15} /></summary><p>O total mantém a regra do diário: líquido calculado pela API Guru, líquido do produtor na Hotmart e valor contratual das vendas TMB, Asaas e Boletex, mais lançamentos manuais ainda não conciliados. Os reembolsos ficam separados. Taxas e afiliação já descontadas do líquido não são subtraídas novamente. Valores de boleto não representam saldo já recebido.</p><p>Campos ausentes permanecem “Não informado”. Um consolidado sem detalhes aparece na lista como “Saldo sem detalhamento”, sem produto, horário ou UTM presumidos.</p></details>
    </section>

    <AsaasCashPanel sources={current?.sources} records={filtered} filters={filters} startDate={date} endDate={date} ready={Boolean(current)} loading={loading} error={Boolean(loadError)} />

    <section className="surface-panel daily-panel"><SectionHeading title="Plataformas e recebimentos" description={salesAvailable ? partial ? 'Parcial: há fontes sem dados de vendas.' : 'Todas as fontes de vendas disponíveis.' : 'Dados ainda indisponíveis.'} />
      <div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Plataforma</th><th>Vendas</th><th>Valor das vendas</th><th>Recebimentos das vendas</th><th>Pendente</th></tr></thead><tbody>{saleSources.map((source) => { const platform = platforms.find((item) => item.name === source.id); return <tr key={source.id}><td><strong>{source.platform}</strong>{source.origin && source.origin !== source.label && <small className="daily-cell-note">Fonte: {source.origin}</small>}</td>{!sourceHasSales(source) ? <td colSpan={4} className="daily-unavailable">{source.reason === 'checkout_disabled' ? 'Vendas e contratos não informados · caixa exibido separadamente' : 'Dado indisponível'}</td> : <><td>{platform?.count || 0}</td><td>{platform ? platform.revenue.known ? money(platform.revenue.value) : 'Não informado' : money(0)}</td><td>{platform?.received.known ? money(platform.received.value) : 'Não informado'}</td><td>{platform?.pending.known ? money(platform.pending.value) : 'Não informado'}</td></>}</tr> })}</tbody></table></div>
      <p className="daily-footnote">Asaas: entrada recebida. Boletex: entrada e parcelas recebidas; boletos apenas emitidos não entram nas vendas.</p>
    </section>

    <section className="surface-panel daily-panel"><SectionHeading title="Registros do dia" description="Os mesmos registros usados nos indicadores acima."><div className="daily-segment" role="group" aria-label="Tipo de registro"><button className="button" aria-pressed={listKind === 'sale'} onClick={() => { setListKind('sale'); setPage(1) }}>Vendas</button><button className="button" aria-pressed={listKind === 'refund'} onClick={() => { setListKind('refund'); setPage(1) }}>Reembolsos</button></div></SectionHeading>
      <div className="daily-table-scroll" tabIndex={0} role="region" aria-label="Lista de vendas; role horizontalmente para ver todas as colunas"><table className="data-table daily-sales-table"><thead><tr><th>Hora</th><th>Produto original / família</th><th>Plataforma</th><th>Pagamento</th><th>Qtd.</th><th>Bruto</th><th>Taxas</th><th>Líquido</th><th>Valor contabilizado</th><th>UTMs e detalhes</th></tr></thead><tbody>
        {visibleRows.map((row) => <tr key={row.id}><td>{row.isManual ? 'Sem horário' : clock(row.date)}</td><td><strong>{row.product || 'Saldo sem detalhamento'}</strong><small className="daily-cell-note">{row.family}</small></td><td>{row.platform}{row.isManual && <small className="daily-cell-note">Lançamento manual</small>}</td><td>{row.payment}</td><td>{row.quantity}</td><td>{money(row.gross)}</td><td>{money(row.fees)}</td><td>{money(row.net)}</td><td><strong>{money(row.revenue)}</strong></td><td><details className="daily-row-detail"><summary>Ver dados</summary><dl><div><dt>Cliente</dt><dd>{row.buyerName || 'Não informado'}</dd></div><div><dt>Vendedor atribuído</dt><dd>{row.sellerName || 'Não atribuído'}</dd></div>{UTM_FIELDS.map((field) => <div key={field}><dt>UTM {field}</dt><dd>{row.utm[field] || 'Não informado'}</dd></div>)}{[['Afiliado líquido', 'affiliate'], ['Recebido', 'received'], ['Preço de tabela', 'listPrice'], ['Pendente', 'pending']].map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{money(row[key])}</dd></div>)}</dl></details></td></tr>)}
        {!visibleRows.length && <tr><td colSpan={10} className="daily-empty">{listAvailable ? 'Nenhum registro encontrado. Ajuste os filtros para ampliar a consulta.' : 'Registros indisponíveis para este recorte.'}</td></tr>}
      </tbody></table></div>
      <footer className="daily-pagination"><span>{list.length ? `${(visiblePage - 1) * PAGE_SIZE + 1}–${Math.min(visiblePage * PAGE_SIZE, list.length)} de ${list.length} registros` : 'Sem registros disponíveis'}</span><div><button className="button" aria-label="Página anterior" disabled={visiblePage <= 1} onClick={() => setPage(visiblePage - 1)}><ArrowLeft size={16} /></button><span>{visiblePage} / {pages}</span><button className="button" aria-label="Próxima página" disabled={visiblePage >= pages} onClick={() => setPage(visiblePage + 1)}><ArrowRight size={16} /></button></div></footer>
    </section>
  </div>
}
