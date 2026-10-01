/* eslint-disable react/prop-types -- Internal UI props; React 19 does not use runtime propTypes. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ReferenceChart } from '../components/charts/ReferenceChart'
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

function Metric({ title, value, note, accent = false }) {
  return <article className={`stat-card daily-stat${accent ? ' daily-stat-accent' : ''}`}><h2>{title}</h2><strong>{value}</strong><p>{note}</p></article>
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
  const [chartMode, setChartMode] = useState('line')
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
  const refunds = useMemo(() => filtered.filter((row) => row.kind === 'refund'), [filtered])
  const summary = useMemo(() => summarizeSales(sales), [sales])
  const refundSummary = useMemo(() => summarizeSales(refunds), [refunds])
  const products = useMemo(() => groupSales(sales, 'product'), [sales])
  const platforms = useMemo(() => groupSales(sales, 'sourceId'), [sales])
  const attribution = useMemo(() => groupSales(sales, utmDimension), [sales, utmDimension])
  const hourly = useMemo(() => hourlySales(sales), [sales])
  const relevantSources = (current?.sources || []).filter((source) => !filters.platform || source.platform === filters.platform || source.id === 'manual')
  const saleSources = relevantSources.filter((source) => source.kind === 'sale')
  const refundSources = relevantSources.filter((source) => source.kind === 'refund')
  const salesAvailable = saleSources.some((source) => sourceHasSales(source) && (source.id !== 'manual' || sales.some((row) => row.sourceId === 'manual')))
  const refundsAvailable = refundSources.some((source) => source.status === 'ready')
  const partial = saleSources.some((source) => source.status !== 'ready') || summary.revenue.missing > 0
  const refundPartial = refundSources.some((source) => source.status !== 'ready')
  const activeFilters = Object.values(filters).filter(Boolean).length
  const list = useMemo(() => filtered.filter((row) => row.kind === listKind).sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0)), [filtered, listKind])
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE))
  const visiblePage = Math.min(page, pages)
  const visibleRows = list.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE)
  const listAvailable = listKind === 'sale' ? salesAvailable : refundsAvailable
  const updateFilter = (key, value) => { setFilters((previous) => ({ ...previous, [key]: value })); setPage(1) }
  const resetFilters = () => { setFilters({ ...EMPTY_FILTERS }); setPage(1) }
  const displayMetric = (metric, available = salesAvailable) => !available ? 'Indisponível' : metric.known || !metric.missing ? money(metric.value) : 'Não informado'
  const maximumProductValue = Math.max(...products.map((item) => item.revenue.value), 1)
  const knownUtmCount = sales.filter((row) => row.utm[utmDimension]).reduce((sum, row) => sum + row.quantity, 0)

  return <div className="hub-page daily-page">
    <header className="page-heading daily-heading"><div><h1>Diário de vendas</h1><p>Acompanhe o dia, os produtos e a origem de cada venda.</p></div><div className="daily-refresh"><button className="button button-primary" onClick={() => refresh(true)} disabled={loading}><RefreshCw size={16} className={loading ? 'daily-spin' : ''} />{loading ? 'Atualizando' : 'Atualizar dados'}</button><span>{current ? `Atualizado às ${clock(current.fetchedAt)}` : 'Aguardando dados'}</span></div></header>

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
      <div className="daily-filter-foot"><p>Os filtros se aplicam a todos os indicadores, gráficos e registros abaixo.</p><label><input type="checkbox" checked={autoRefresh} onChange={(event) => setAutoRefresh(event.target.checked)} />Atualizar hoje a cada 5 min</label></div>
    </section>

    <div aria-live="polite" className="daily-feedback">
      {loading && !current && <p className="daily-notice">Carregando as fontes do dia. Os valores aparecerão quando a consulta terminar.</p>}
      {loadError && <p className="daily-notice is-warning" role="alert">Não foi possível atualizar os dados. Use “Atualizar dados” para tentar novamente.</p>}
      {current && relevantSources.some((source) => source.status === 'unavailable') && <p className="daily-notice is-warning">Dados parciais. {relevantSources.filter((source) => source.status === 'unavailable').map((source) => source.label).join(', ')} indisponível. Os valores abaixo incluem apenas as fontes que responderam.</p>}
    </div>

    {current && relevantSources.some(source => source.salesAvailable === false && source.reason === 'checkout_disabled') && <p className="daily-notice is-warning">Asaas: caixa disponível; vendas e valores contratados não informados. A receita operacional e a contagem incluem somente as demais fontes disponíveis.</p>}

    <section className="stat-grid daily-stats" aria-label="Resumo do dia" aria-busy={loading}>
      <Metric title="Valor das vendas" value={displayMetric(summary.revenue)} accent note={salesAvailable ? `${partial ? 'Valor parcial. ' : ''}Líquidos Guru/Hotmart + contratos de boleto + manuais.` : 'Aguardando uma fonte de vendas.'} />
      <Metric title="Vendas realizadas" value={salesAvailable ? summary.count.toLocaleString('pt-BR') : 'Indisponível'} note={salesAvailable ? `${partial ? 'Contagem parcial. ' : ''}Boletex inclui somente entrada paga.` : 'A contagem depende das fontes do dia.'} />
      <Metric title="Ticket médio" value={salesAvailable && summary.count > 0 && summary.revenue.known ? money(summary.revenue.value / summary.count) : salesAvailable && summary.count === 0 ? '—' : 'Indisponível'} note={`${partial ? 'Ticket parcial. ' : ''}Valor das vendas dividido pela quantidade filtrada.`} />
      <Metric title="Reembolsos" value={displayMetric(refundSummary.revenue, refundsAvailable)} note={refundsAvailable ? `${refundSummary.count} registros${refundPartial ? ' · consulta parcial' : ''}. Exibidos separadamente das vendas.` : 'Consulta disponível para Guru e Hotmart.'} />
    </section>

    <section className="surface-panel daily-panel daily-financial">
      <SectionHeading title="Composição financeira" description="Valores retornados pelas plataformas, sem recalcular as taxas." />
      <div className="daily-financial-grid">{[['Bruto informado', 'gross'], ['Líquido informado', 'net'], ['Taxas e descontos', 'fees'], ['Afiliados (líquido)', 'affiliate']].map(([label, key]) => <div key={key}><span>{label}</span><strong>{displayMetric(summary[key])}</strong><small>{summary[key].missing ? `${summary[key].missing} registros sem esse valor` : salesAvailable ? 'Dados disponíveis no recorte' : 'Fonte indisponível'}</small></div>)}</div>
      <details className="daily-calculation"><summary>Como ler estes valores<ChevronDown size={15} /></summary><p>O total mantém a regra do diário: líquido calculado pela API Guru, líquido do produtor na Hotmart e valor contratual das vendas TMB, Asaas e Boletex, mais lançamentos manuais ainda não conciliados. Os reembolsos ficam separados. Taxas e afiliação já descontadas do líquido não são subtraídas novamente. Valores de boleto não representam saldo já recebido.</p><p>Campos ausentes permanecem “Não informado”. Um consolidado sem detalhes aparece na lista como “Saldo sem detalhamento”, sem produto, horário ou UTM presumidos.</p></details>
    </section>

    {current && <AsaasCashPanel sources={current.sources} filters={filters} />}

    <div className="daily-analysis-grid">
      <section className="surface-panel daily-panel daily-hourly">
        <SectionHeading title="Vendas por hora" description="Quantidade e valor no horário de Brasília."><div className="daily-segment" role="group" aria-label="Formato do gráfico"><button className="button" aria-pressed={chartMode === 'line'} onClick={() => setChartMode('line')}>Linhas</button><button className="button" aria-pressed={chartMode === 'bar'} onClick={() => setChartMode('bar')}>Barras</button></div></SectionHeading>
        {salesAvailable ? <><ReferenceChart title="Vendas por hora" rows={hourly.hours.map((hour) => ({ ...hour, label: hour.hour }))} series={[{ key: 'count', label: 'Vendas', unit: 'count' }, { key: 'value', label: 'Valor', unit: 'currency' }]} daily={false} mode={chartMode} height={285} />
          <p className="daily-footnote">{hourly.unknownRecords > 0 ? `${hourly.unknownRecords} registros sem horário (${hourly.unknown} vendas) não entram no gráfico.` : 'Todos os registros com horário informado estão no gráfico.'} {partial && 'Fontes indisponíveis não estão incluídas.'}</p>
          <details className="daily-hour-table"><summary>Ver tabela por hora</summary><div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Hora</th><th>Vendas</th><th>Valor contabilizado</th></tr></thead><tbody>{hourly.hours.map((hour) => <tr key={hour.hour}><td>{hour.hour}</td><td>{hour.count}</td><td>{money(hour.value)}</td></tr>)}</tbody></table></div></details></> : <p className="daily-empty">Vendas por hora indisponíveis até uma fonte responder.</p>}
      </section>
      <section className="surface-panel daily-panel daily-products"><SectionHeading title="Produtos do dia" description="Nome original preservado. Ordenados pelo valor das vendas." />
        {!salesAvailable ? <p className="daily-empty">Produtos indisponíveis até uma fonte responder.</p> : !products.length ? <p className="daily-empty">Nenhuma venda encontrada com estes filtros.</p> : <div className="daily-product-list">{products.map((product) => <div className="daily-product" key={product.name}><div><strong>{product.name}</strong><span>{product.count} {product.count === 1 ? 'venda' : 'vendas'}</span></div><div className="daily-product-amount"><div className="daily-bar-track"><i style={{ width: `${Math.max(0, product.revenue.value / maximumProductValue * 100)}%` }} /></div><b>{product.revenue.known ? money(product.revenue.value) : 'Não informado'}</b></div></div>)}</div>}
      </section>
    </div>

    <section className="surface-panel daily-panel"><SectionHeading title="Origem das vendas" description="UTMs recebidas nas transações. Ausência de UTM não é classificada como orgânico."><label className="daily-field daily-dimension"><span>Agrupar por</span><select className="ds-input" value={utmDimension} onChange={(event) => setUtmDimension(event.target.value)}>{UTM_FIELDS.map((field) => <option value={field} key={field}>UTM {field}</option>)}</select></label></SectionHeading>
      {salesAvailable && <p className="daily-footnote">{knownUtmCount} de {summary.count} vendas com UTM {utmDimension} informada.</p>}
      <div className="daily-table-scroll"><table className="data-table daily-attribution-table"><thead><tr><th>UTM {utmDimension}</th><th>Vendas</th><th>Valor das vendas</th><th>Participação em vendas</th></tr></thead><tbody>{attribution.map((group) => <tr key={group.name}><td>{group.name}</td><td>{group.count}</td><td>{group.revenue.known ? money(group.revenue.value) : 'Não informado'}</td><td>{summary.count ? `${(group.count / summary.count * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : '—'}</td></tr>)}{!attribution.length && <tr><td colSpan={4} className="daily-empty">{salesAvailable ? 'Nenhuma venda neste recorte.' : 'Origem indisponível até as fontes responderem.'}</td></tr>}</tbody></table></div>
    </section>

    <section className="surface-panel daily-panel"><SectionHeading title="Plataformas e recebimentos" description={salesAvailable ? partial ? 'Parcial: há fontes sem dados de vendas.' : 'Todas as fontes de vendas disponíveis.' : 'Dados ainda indisponíveis.'} />
      <div className="daily-table-scroll"><table className="data-table"><thead><tr><th>Plataforma</th><th>Vendas</th><th>Valor das vendas</th><th>Recebido em boleto</th><th>Pendente</th></tr></thead><tbody>{saleSources.map((source) => { const platform = platforms.find((item) => item.name === source.id); return <tr key={source.id}><td><strong>{source.platform}</strong>{source.origin && source.origin !== source.label && <small className="daily-cell-note">Fonte: {source.origin}</small>}</td>{!sourceHasSales(source) ? <td colSpan={4} className="daily-unavailable">{source.reason === 'checkout_disabled' ? 'Vendas e contratos não informados · caixa exibido separadamente' : 'Dado indisponível'}</td> : <><td>{platform?.count || 0}</td><td>{platform ? platform.revenue.known ? money(platform.revenue.value) : 'Não informado' : money(0)}</td><td>{platform?.received.known ? money(platform.received.value) : 'Não informado'}</td><td>{platform?.pending.known ? money(platform.pending.value) : 'Não informado'}</td></>}</tr> })}</tbody></table></div>
      <p className="daily-footnote">Asaas: entrada recebida. Boletex: entrada e parcelas recebidas; boletos apenas emitidos não entram nas vendas.</p>
      {current && <div className="daily-sources" aria-label="Situação das fontes">{relevantSources.map((source) => <span key={source.id} className={`daily-source ${source.status !== 'ready' ? 'is-unavailable' : ''}`}><i aria-hidden="true" />{source.label}<span>{loading ? 'Atualizando' : source.status === 'ready' ? 'Disponível' : source.status === 'partial' ? 'Caixa disponível · vendas indisponíveis' : 'Indisponível'}</span></span>)}</div>}
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
