/* eslint-disable react/prop-types -- Internal blocks; their shape is the tested API projection. */
import { memo, useState } from 'react'
import { CircleAlert, Download, Info } from 'lucide-react'
import { MixChart, RankedBars } from '../charts/AnalyticsVisuals'
import FinancialValue from '../charts/FinancialValue'
import { ReferenceChart } from '../charts/ReferenceChart'
import { COMPARISON_COLORS, DETAIL_METRICS, PRIMARY_METRICS, format, sourceStatus } from '../charts/comparisonFormat'
import { deltaView, metricDisplay } from '../charts/comparisonValues'
import { CASH_METRIC, GROUP_LABELS, REFUND_METRICS, asaasCashText, blockNumber, carriedMetrics, comparedSnapshotText, comparedSources, emptyGroupsText, filterChips, isKnownBlock, mixIsPartial, noticeMessage, omittedText, paymentMix, periodCaption, rankedItems, revenueChart, snapshotText, sourceLabel, statusText, topGroupsChart, totalsNote, volumeChart } from './agentBlocks'

const HEADLINE = [['revenue', 'Receita operacional', 'currency'], ['count', 'Vendas', 'count'], ['ticket', 'Ticket médio', 'currency'], CASH_METRIC]
const statusClass = status => status === 'ready' ? 'agent-muted' : 'agent-attention'

function Amount({ metric, unit = 'currency' }) {
  return <span className="agent-amount"><FinancialValue ready={metric?.value != null}>{format(metric?.value, unit)}</FinancialValue>{metric?.partial && <small className="agent-attention">Parcial</small>}</span>
}

function Table({ head, caption, minWidth, children }) {
  return <div className="agent-table-wrap"><table className="data-table agent-table" style={{ minWidth }}><caption className="agent-sr-only">{caption}</caption><thead><tr>{head.map(name => <th key={name} scope="col">{name}</th>)}</tr></thead><tbody>{children}</tbody></table></div>
}

function BlockHeader({ block, title, status, inProgress }) {
  const chips = filterChips(block.filters)
  return <header className="agent-block-head">
    <div><p className="agent-eyebrow">Bloco {blockNumber(block)} · Calculado pelo servidor</p><h3>{title}</h3>{chips.length > 0 && <p className="agent-muted">{chips.join(' · ')}</p>}</div>
    {status && <span className={statusClass(status)}>{statusText(status, inProgress)}</span>}
  </header>
}

function Notices({ notices = [] }) {
  const warnings = notices.filter(notice => notice.tone === 'warning'), rules = notices.filter(notice => notice.tone !== 'warning')
  return <>
    {warnings.map(notice => <p key={`${notice.id}:${notice.side ?? ''}`} className="notice agent-notice"><CircleAlert size={16} aria-hidden="true" /><span><strong>{notice.title}.</strong> {noticeMessage(notice)}</span></p>)}
    {rules.length > 0 && <details className="agent-details"><summary>Como ler estes números</summary><ul className="agent-rules">{rules.map(notice => <li key={`${notice.id}:${notice.side ?? ''}`}><Info size={15} aria-hidden="true" /><span><strong>{notice.title}.</strong> {noticeMessage(notice)}</span></li>)}</ul></details>}
  </>
}

function PeriodCard({ name, base, color, side }) {
  const cash = asaasCashText(side.asaasCash)
  return <div className="agent-period" style={{ borderTopColor: color }}>
    <p className="agent-period-name">Período {name}{base ? ' · base' : ''}</p>
    <p className="agent-muted">{periodCaption(side.period)}</p>
    <dl className="agent-period-values">
      <div><dt>Receita operacional</dt><dd><Amount metric={side.metrics.revenue} /></dd></div>
      <div><dt>Vendas</dt><dd><Amount metric={side.metrics.count} unit="count" /></dd></div>
    </dl>
    <p className={statusClass(side.status)}>{statusText(side.status, side.period.inProgress)}</p>
    {cash && <p className="agent-muted">{cash}</p>}
  </div>
}

function ChartSection({ title, chart, height = 300, footer }) {
  return <section className="agent-section"><h4>{title}</h4><ReferenceChart {...chart} height={height} />{footer}</section>
}

function ComparisonBlock({ block }) {
  const { a, b, deltas, groups, series } = block
  const rows = definitions => carriedMetrics(definitions, a.metrics).map(([key, name, unit]) => <tr key={key}><th scope="row">{name}</th><td>{metricDisplay(a.metrics[key], unit)}</td><td>{metricDisplay(b.metrics[key], unit)}</td><td>{deltaView(deltas[key], unit)}</td></tr>)
  const head = ['Indicador', 'Período A', 'Período B · base', 'Variação A − B']
  const omitted = omittedText(block)
  const hourly = series.kind === 'hourly'
  const partial = a.metrics.revenue.partial || b.metrics.revenue.partial
  return <article className="agent-block ds-card" aria-label={`Comparação de ${a.period.label} com ${b.period.label}`}>
    <BlockHeader block={block} title={`${a.period.label} contra ${b.period.label}`} />
    <div className="agent-periods"><PeriodCard name="A" color={COMPARISON_COLORS.a} side={a} /><PeriodCard name="B" base color={COMPARISON_COLORS.b} side={b} /></div>
    <Notices notices={block.notices} />
    <Table head={head} caption="Resultado dos períodos" minWidth={620}>{rows([...PRIMARY_METRICS, CASH_METRIC])}</Table>
    <details className="agent-details"><summary>Composição financeira e outros indicadores</summary><Table head={head} caption="Indicadores adicionais" minWidth={620}>{rows([...DETAIL_METRICS, ...REFUND_METRICS])}</Table></details>
    <ChartSection title={hourly ? 'Receita ao longo do dia' : 'Receita ao longo dos períodos'} chart={revenueChart(block)} footer={<>
      {omitted && <p className="agent-muted">{omitted}</p>}
      {partial && <p className="agent-attention">O gráfico representa a parcela observada. Lacunas não são substituídas por zero.</p>}
    </>} />
    <details className="agent-details"><summary>Volume de vendas {hourly ? 'por hora' : 'por dia'}</summary><ReferenceChart {...volumeChart(block)} height={260} /></details>
    <section className="agent-section"><h4>Distribuição por {GROUP_LABELS[groups.dimension]?.toLowerCase()}</h4>
      {groups.rows.length ? <>
        <Table head={['Grupo', 'Vendas A', 'Vendas B', 'Variação de vendas', 'Receita A', 'Receita B', 'Variação da receita']} caption="Distribuição comparada" minWidth={820}>{groups.rows.map(row => <tr key={row.name}><th scope="row">{row.name}</th><td>{metricDisplay(row.a.count, 'count')}</td><td>{metricDisplay(row.b.count, 'count')}</td><td>{deltaView(row.countDelta, 'count')}</td><td>{metricDisplay(row.a.revenue)}</td><td>{metricDisplay(row.b.revenue)}</td><td>{deltaView(row.revenueDelta)}</td></tr>)}</Table>
        {groups.truncated && <p className="agent-muted">Mostrando os {groups.rows.length} maiores grupos.</p>}
        {groups.rows.length > 1 && <ReferenceChart {...topGroupsChart(block)} height={280} />}
      </> : <p className="agent-muted">{emptyGroupsText(block)}</p>}
    </section>
    <details className="agent-details"><summary>Fontes da comparação</summary><Table head={['Fonte', 'Estado A', 'Estado B', 'Registros A', 'Registros B', 'Valor A', 'Valor B']} caption="Fontes da comparação" minWidth={820}>{comparedSources(block).map(source => <tr key={source.id}><th scope="row">{source.label}</th><td className={source.a?.status === 'ready' ? '' : 'agent-attention'}>{sourceStatus(source.a?.status)}</td><td className={source.b?.status === 'ready' ? '' : 'agent-attention'}>{sourceStatus(source.b?.status)}</td><td>{metricDisplay(source.a?.count, 'count')}</td><td>{metricDisplay(source.b?.count, 'count')}</td><td>{metricDisplay(source.a?.revenue)}</td><td>{metricDisplay(source.b?.revenue)}</td></tr>)}</Table></details>
    <p className="agent-foot">{comparedSnapshotText(a.dataSource, b.dataSource)} Percentuais usam B como base. {totalsNote(a, b)}</p>
  </article>
}

function SummaryBlock({ block }) {
  const { metrics, groups, series, period } = block
  const omitted = omittedText(block)
  const hourly = series.kind === 'hourly'
  const cash = asaasCashText(block.asaasCash)
  const detail = definitions => carriedMetrics(definitions, metrics).map(([key, name, unit]) => <tr key={key}><th scope="row">{name}</th><td>{metricDisplay(metrics[key], unit)}</td></tr>)
  return <article className="agent-block ds-card" aria-label={`Resumo de ${period.label}`}>
    <BlockHeader block={block} title={periodCaption(period)} status={block.status} inProgress={period.inProgress} />
    <dl className="agent-stats">{HEADLINE.map(([key, name, unit]) => <div key={key}><dt>{name}</dt><dd><Amount metric={metrics[key]} unit={unit} /></dd></div>)}</dl>
    {cash && <p className="notice agent-notice"><Info size={16} aria-hidden="true" /><span>{cash}</span></p>}
    <Notices notices={block.notices} />
    <ChartSection title={hourly ? 'Receita ao longo do dia' : 'Receita ao longo do período'} chart={revenueChart(block)} footer={<>
      {omitted && <p className="agent-muted">{omitted}</p>}
      {metrics.revenue.partial && <p className="agent-attention">O gráfico representa a parcela observada. Lacunas não são substituídas por zero.</p>}
    </>} />
    <details className="agent-details"><summary>Volume de vendas {hourly ? 'por hora' : 'por dia'}</summary><ReferenceChart {...volumeChart(block)} height={260} /></details>
    <section className="agent-section"><h4>Distribuição por {GROUP_LABELS[groups.dimension]?.toLowerCase()}</h4>
      {emptyGroupsText(block) ? <p className="agent-muted">{emptyGroupsText(block)}</p> : <>
        {groups.dimension === 'payment' && (mixIsPartial(block) ? <p className="agent-attention">Distribuição parcial: as barras abaixo mostram só as fontes que responderam, sem percentuais.</p> : <MixChart items={paymentMix(block)} />)}
        <RankedBars items={rankedItems(block)} />
      </>}
      {groups.truncated && <p className="agent-muted">Mostrando os {groups.rows.length} maiores grupos.</p>}
    </section>
    <details className="agent-details"><summary>Composição financeira e outros indicadores</summary><Table head={['Indicador', 'Valor']} caption="Indicadores do período" minWidth={360}>{detail([...PRIMARY_METRICS, CASH_METRIC, ...DETAIL_METRICS, ...REFUND_METRICS])}</Table></details>
    <details className="agent-details"><summary>Fontes consultadas</summary><Table head={['Fonte', 'Estado', 'Registros', 'Valor']} caption="Fontes consultadas" minWidth={520}>{block.sources.map(source => <tr key={source.id}><th scope="row">{sourceLabel(source)}</th><td className={source.status === 'ready' ? '' : 'agent-attention'}>{sourceStatus(source.status)}</td><td>{metricDisplay(source.count, 'count')}</td><td>{metricDisplay(source.revenue)}</td></tr>)}</Table></details>
    <p className="agent-foot">{snapshotText(block.dataSource)} {totalsNote(block)}</p>
  </article>
}

function BuyersBlock({ block }) {
  const [page, setPage] = useState(0)
  const [exporting, setExporting] = useState('')
  const [error, setError] = useState('')
  const pageSize = 25
  const pageCount = Math.ceil(block.rows.length / pageSize)
  const rows = block.rows.slice(page * pageSize, (page + 1) * pageSize)
  const contact = value => value || 'Não informado'
  const date = value => value && Number.isFinite(Date.parse(value))
    ? new Date(value.length === 10 ? `${value}T12:00:00Z` : value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Não informado'
  async function download(format) {
    if (exporting) return
    setExporting(format); setError('')
    try {
      const { exportBuyerContacts } = await import('../../utils/periodSalesExport.js')
      await exportBuyerContacts(block, format)
    } catch { setError('Não foi possível baixar os contatos. Tente novamente.') }
    finally { setExporting('') }
  }
  return <article className="agent-block ds-card" aria-label={`Compradores de ${block.period.label}`}>
    <BlockHeader block={block} title={`Compradores · ${block.period.label}`} status={block.status} inProgress={block.period.inProgress} />
    <Notices notices={block.notices} />
    <p className="agent-muted">{block.rows.length} de {block.totalRows} registros de compra.</p>
    <div className="agent-action">
      {['xlsx', 'csv'].map(format => <button key={format} type="button" className="btn btn-ghost btn-sm" disabled={!block.rows.length || Boolean(exporting)} onClick={() => download(format)}><Download size={14} aria-hidden="true" />{exporting === format ? 'Preparando…' : `Baixar ${format.toUpperCase()}`}</button>)}
    </div>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    {rows.length ? <>
      <Table head={['Nome', 'E-mail', 'Telefone', 'Produto', 'Plataforma', 'Data (Brasília)']} caption="Contatos dos compradores" minWidth={820}>
        {rows.map((row, index) => <tr key={page * pageSize + index}><th scope="row">{contact(row.name)}</th><td>{contact(row.email)}</td><td>{contact(row.phone)}</td><td>{contact(row.product)}</td><td>{contact(row.platform)}</td><td>{date(row.date)}</td></tr>)}
      </Table>
      {pageCount > 1 && <nav className="agent-action" aria-label="Páginas dos compradores">
        <button type="button" className="btn btn-ghost btn-sm" disabled={page === 0} onClick={() => setPage(value => value - 1)}>Página anterior</button>
        <span className="agent-muted" role="status">Página {page + 1} de {pageCount}</span>
        <button type="button" className="btn btn-ghost btn-sm" disabled={page + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>Próxima página</button>
      </nav>}
    </> : <p className="agent-muted">{block.status === 'pending' ? 'A lista ainda está em coleta. Tente novamente em alguns minutos.' : block.status === 'ready' ? 'Nenhum comprador encontrado neste recorte.' : 'Nenhum comprador identificado nos dados disponíveis. Resultado parcial.'}</p>}
    <p className="agent-foot">Uma linha por compra; um comprador pode aparecer mais de uma vez. Campos ausentes aparecem como Não informado. Os downloads incluem todos os {block.rows.length} registros desta consulta.{block.truncated && ' Reduza o período ou os filtros para consultar os demais registros.'}</p>
  </article>
}

// Blocks never change after they arrive, so text deltas do not redraw their charts.
export default memo(function AgentBlock({ block }) {
  if (!isKnownBlock(block)) return <p className="notice">Este resultado não pôde ser exibido. Atualize a página e pergunte de novo.</p>
  if (block.kind === 'buyers') return <BuyersBlock block={block} />
  return block.kind === 'comparison' ? <ComparisonBlock block={block} /> : <SummaryBlock block={block} />
})
