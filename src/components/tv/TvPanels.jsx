/* eslint-disable react/prop-types -- Internal presentation scenes consume the shared TV model. */
import { ArrowUpRight, Target, Trophy } from 'lucide-react'
import { ReferenceChart } from '../charts/ReferenceChart.jsx'
import { formatValue } from '../charts/chartFormatters.js'

const value = (number, unit) => number == null ? '—' : formatValue(number, unit)
const percent = number => number == null ? '—' : formatValue(number, 'percent')
const fill = number => `${Math.max(0, Math.min(100, number || 0))}%`

function Empty({ title, children }) {
  return <div className="tv-empty"><Target size={36}/><h3>{title}</h3><p>{children}</p></div>
}
function Stat({ label, amount, unit = 'currency', accent = false }) {
  return <div className={`tv-stat${accent ? ' tv-stat-accent' : ''}`}><span>{label}</span><strong>{value(amount, unit)}</strong></div>
}
function PaceStatus({ pace, plansError }) {
  if (plansError) return <span className="tv-status">Meta não confirmada</span>
  if (!pace?.validTarget) return <span className="tv-status">Meta não cadastrada nesta base</span>
  if (pace.future) return <span className="tv-status">Mês ainda não iniciado</span>
  if (!pace.definitive) return <span className="tv-status">Leitura parcial · pace a confirmar</span>
  if (pace.ended) return <span className="tv-status" data-positive={pace.attainment >= 100}>{pace.attainment >= 100 ? 'Meta atingida' : 'Mês encerrado abaixo da meta'}</span>
  return <span className="tv-status" data-positive={pace.delta >= 0}>{pace.delta >= 0 ? 'Acima do pace' : 'Abaixo do pace'} · {value(Math.abs(pace.delta), pace.metric.unit)}</span>
}
function PaceGraph({ model, pace = model.pace, height = 410 }) {
  return <ReferenceChart rows={pace.rows} title={`Ritmo diário · ${model.paceName || 'Meta geral'}`} height={height} mode="area" referenceDate={model.today} shadeAfterReference
    series={[{ key: 'actual', label: 'Realizado acumulado', unit: model.unit, color: 'var(--tv-ink)', fill: true }, { key: 'planned', label: 'Meta acumulada', unit: model.unit, color: 'var(--chart-3)', dash: '6 6', fill: false }]}/>
}
function MonthlyGoal({ model, chartHeight }) {
  const pace = model.overview
  return <div className="tv-monthly">
    <div className="tv-monthly-lead"><div><span className="tv-eyebrow">Realizado no mês {(!pace.definitive) && '· parcial'}</span><strong className="tv-hero-value" data-testid="tv-main-value">{value(pace.actual, model.unit)}</strong><PaceStatus pace={pace} plansError={model.plansError}/></div><div className="tv-goal-dial"><span>{pace.validTarget ? percent(pace.attainment) : 'Sem meta'}</span><small>da meta mensal</small><div className="tv-track"><i style={{ width: fill(pace.attainment) }}/></div></div></div>
    <div className="tv-stat-row"><Stat label="Meta do mês" amount={pace.validTarget ? pace.target : null} unit={model.unit}/><Stat label="Falta para a meta" amount={pace.remaining} unit={model.unit}/><Stat label="Vendas realizadas" amount={model.totals.count} unit="count"/><Stat label="Necessário por dia restante" amount={pace.requiredPerDay} unit={model.unit}/></div>
    {Array.isArray(model.overallPlan?.breakdown) && <div className="tv-allocation"><span>Composição da meta</span>{model.overallPlan.breakdown.map(part => <span key={part.key}><i/>{part.key === 'marketing' ? 'Marketing' : 'Vendas'} <b>{value(part.target, model.unit)}</b></span>)}</div>}
    <PaceGraph model={{ ...model, paceName: 'Meta geral' }} pace={pace} height={Math.max(200, chartHeight - 150)}/>
  </div>
}
function PacePanel({ model, chartHeight }) {
  const pace = model.pace
  return <div className="tv-pace-panel"><div className="tv-pace-heading"><div><span className="tv-eyebrow">{model.paceName || 'Meta geral'}</span><strong className="tv-hero-value" data-testid="tv-main-value">{value(pace.actual, model.unit)}</strong></div><PaceStatus pace={pace} plansError={model.plansError}/></div>
    <div className="tv-stat-row"><Stat label="Esperado até hoje" amount={pace.expected} unit={model.unit}/><Stat label="Meta do mês" amount={pace.validTarget ? pace.target : null} unit={model.unit}/><Stat label="Projeção no ritmo atual" amount={pace.projection} unit={model.unit}/></div>
    <PaceGraph model={model} height={chartHeight}/>
    <p className="tv-footnote">{pace.basis === 'business' ? 'Distribuição em dias úteis, sem calendário de feriados.' : 'Distribuição linear pelos dias do mês.'} Projeção estimada{!pace.definitive ? ' com dados parciais' : ''}. {pace.unassignedRecords > 0 && `${pace.unassignedRecords} vendas ainda sem atribuição para este recorte.`}</p>
  </div>
}
function GoalComparison({ items, model, kind }) {
  if (!items.length) return <Empty title={model.plansError ? 'Metas indisponíveis' : `Sem metas de ${kind} nesta base`}>Cadastre as metas em Metas e planejamento, usando a mesma base selecionada para a TV.</Empty>
  return <div className="tv-comparison"><div className="tv-table-caption"><span>Realizado / meta</span><span>Atingimento</span></div>{items.slice(0, 8).map((item, index) => <div className="tv-goal-row" key={item.id} style={{ '--row-color': `var(--chart-${index % 6 + 1})` }}><div className="tv-row-name"><h3>{item.name}</h3><span>{!item.pace.definitive ? 'Parcial · ' : ''}{value(item.pace.actual, model.unit)} <small>/ {value(item.pace.target, model.unit)}</small></span></div><strong>{item.pace.validTarget ? percent(item.pace.attainment) : 'Sem meta'}</strong><div className="tv-track"><i style={{ width: fill(item.pace.attainment) }}/></div></div>)}<p className="tv-footnote">{items.length > 8 ? `Exibindo os 8 maiores atingimentos entre ${items.length} metas. ` : ''}Cada barra representa o avanço da própria meta.{model.directoryError ? ' Cadastro de times e vendedores indisponível.' : ''}</p></div>
}
function Ranking({ rows, model, sellers = false }) {
  const unassigned = model.unassigned[sellers ? 'seller' : 'product']
  if (!rows.length) return <Empty title={sellers ? 'Sem vendas atribuídas a vendedores' : 'Sem vendas por produto neste mês'}>{sellers ? 'As vendas sem atribuição ficam fora do ranking. O head pode atribuí-las na tela de Atribuição.' : 'O ranking será preenchido conforme as vendas forem identificadas.'}{unassigned?.count > 0 && ` ${unassigned.count} vendas sem identificação.`}</Empty>
  const max = Math.max(1, ...rows.map(row => row.value || 0))
  return <div className="tv-ranking">{rows[0].value > 0 && <div className="tv-ranking-leader"><Trophy size={34}/><div><span className="tv-eyebrow">{sellers ? 'Destaque do mês' : 'Produto em destaque'}</span><h3>{rows[0].name}</h3></div><strong>{value(rows[0].value, model.unit)}</strong></div>}
    <div className="tv-ranking-rows">{rows.slice(0, 8).map((row, index) => <div className="tv-ranking-row" key={row.id} style={{ '--row-color': `var(--chart-${index % 6 + 1})` }}><span className="tv-position">{String(index + 1).padStart(2, '0')}</span><div className="tv-ranking-name"><strong>{row.name}</strong><div className="tv-track"><i style={{ width: fill((row.value || 0) / max * 100) }}/></div></div><div className="tv-ranking-result"><strong>{value(row.value, model.unit)}</strong><span>{value(row.count, 'count')} vendas{row.partial ? ' · parcial' : ''}</span></div></div>)}</div>
    <p className="tv-footnote">{rows.length > 8 ? `Top 8 de ${rows.length}. ` : ''}{unassigned?.count > 0 ? `${value(unassigned.count, 'count')} vendas sem ${sellers ? 'vendedor' : 'produto'}: ${value(unassigned.value, model.unit)}. ` : ''}Somente novas vendas identificadas{model.attributionAvailable === false ? ' · atribuições indisponíveis' : ''}.</p>
  </div>
}
function Daily({ model, chartHeight }) {
  const day = model.daily
  if (!day.inSelectedMonth) return <Empty title="Hoje está fora do mês selecionado">Use o período Mês atual para acompanhar as vendas do dia nesta programação.</Empty>
  return <div><div className="tv-daily-lead"><div><span className="tv-eyebrow">Hoje · horário de Brasília {day.partial && '· parcial'}</span><strong className="tv-hero-value" data-testid="tv-main-value">{value(day.value, model.unit)}</strong></div><ArrowUpRight size={64}/></div>
    <div className="tv-stat-row"><Stat label="Vendas realizadas" amount={day.count} unit="count"/><Stat label="Valor bruto" amount={day.gross}/><Stat label="Cash collected · novas vendas" amount={day.cash} accent/></div>
    <ReferenceChart rows={day.hours.map(hour => ({ ...hour, label: hour.hour }))} title="Vendas de hoje por hora" height={Math.max(210, chartHeight - 60)} mode="bar" series={[{ key: 'value', label: model.metricLabel, unit: model.unit, color: 'var(--tv-ink)' }]}/>
    {day.unknownHourCount > 0 && <p className="tv-footnote">{day.unknownHourCount} vendas com horário não informado, fora do gráfico por hora.</p>}
  </div>
}
function PaymentMix({ model }) {
  const rows = model.payments.filter(row => row.value !== 0 || row.count > 0)
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0)
  if (!rows.length) return <Empty title="Sem meios de pagamento neste mês">Os valores aparecerão quando houver novas vendas no período.</Empty>
  return <div className="tv-payments"><div className="tv-payment-strip" aria-hidden="true">{rows.filter(row => row.value > 0).map((row, index) => <i key={row.id} style={{ width: `${row.value / total * 100}%`, background: `var(--chart-${index % 6 + 1})` }}/>)}</div>{rows.map((row, index) => <div className="tv-payment-row" key={row.id}><i style={{ background: `var(--chart-${index % 6 + 1})` }}/><div><h3>{row.name}</h3><span>{value(row.count, 'count')} vendas{row.partial && ' · parcial'}</span></div><strong>{value(row.value, model.unit)}</strong><b>{total > 0 && row.value != null ? percent(row.value / total * 100) : '—'}</b></div>)}<p className="tv-footnote">Participação sobre os valores conhecidos. Recebimentos de faturas de vendas passadas não entram nesta composição.</p></div>
}
export function TvPanel({ panelId, model, loading, chartHeight = 370 }) {
  if (!model || loading) return <div className="tv-empty" role="status"><div className="tv-loading-line"/><h3>Carregando os indicadores</h3><p>Buscando o mês em cache e atualizando as vendas de hoje.</p></div>
  switch (panelId) {
    case 'monthly-goal': return <MonthlyGoal model={model} chartHeight={chartHeight}/>
    case 'pace': return <PacePanel model={model} chartHeight={Math.max(230, chartHeight - 90)}/>
    case 'team-goals': return <GoalComparison items={model.teamGoals} model={model} kind="times"/>
    case 'product-goals': return <GoalComparison items={model.productGoals} model={model} kind="produtos"/>
    case 'sellers': return <Ranking rows={model.sellers} model={model} sellers/>
    case 'products': return <Ranking rows={model.products} model={model}/>
    case 'daily': return <Daily model={model} chartHeight={chartHeight}/>
    case 'payment-mix': return <PaymentMix model={model}/>
    default: return <Empty title="Selecione um painel">Escolha um painel na programação da TV.</Empty>
  }
}
