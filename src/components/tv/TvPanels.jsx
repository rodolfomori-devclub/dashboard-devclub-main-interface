/* eslint-disable react/prop-types -- Internal presentation scenes consume the shared TV model. */
import { ArrowUpRight, Target, Trophy } from 'lucide-react'
import { ReferenceChart } from '../charts/ReferenceChart.jsx'
import { formatValue } from '../charts/chartFormatters.js'
import { WEEKLY_TV_PANELS, tvWeekLabel } from './tvConfig.js'

const value = (number, unit) => number == null ? '—' : formatValue(number, unit)
const percent = number => number == null ? '—' : formatValue(number, 'percent')
const fill = number => `${Math.max(0, Math.min(100, number || 0))}%`
const metricName = model => model.metric === 'cash' ? 'Cash collected' : model.metric === 'count' ? 'Quantidade de vendas' : 'Valor das vendas'
const isPartial = (metrics, key) => metrics?.[`${key}Partial`] ?? metrics?.partial ?? false

function Empty({ title, children }) {
  return <div className="tv-empty"><Target size={36}/><h3>{title}</h3><p>{children}</p></div>
}
function Stat({ label, amount, unit = 'currency', accent = false }) {
  return <div className={`tv-stat${accent ? ' tv-stat-accent' : ''}`}><span>{label}</span><strong>{value(amount, unit)}</strong></div>
}
function FinancialHero({ metrics, context }) {
  return <div className="tv-financial-hero">
    <span className="tv-eyebrow">Valor das vendas{context ? ` · ${context}` : ''}{isPartial(metrics, 'gross') ? ' · parcial' : ''}</span>
    <strong className="tv-hero-value" data-testid="tv-main-value"><span data-testid="tv-gross-value">{value(metrics?.gross, 'currency')}</span></strong>
    <div className="tv-cash-secondary"><span>Cash collected{isPartial(metrics, 'cash') ? ' · parcial' : ''}</span><strong data-testid="tv-cash-value">{value(metrics?.cash, 'currency')}</strong><small>Novas vendas</small></div>
  </div>
}
function DualAmount({ metrics }) {
  return <div className="tv-dual-amount">
    <span className="tv-amount-label">Valor das vendas{isPartial(metrics, 'gross') ? ' · parcial' : ''}</span>
    <strong data-testid="tv-gross-value">{value(metrics?.gross, 'currency')}</strong>
    <span className="tv-cash-amount">Cash collected{isPartial(metrics, 'cash') ? ' · parcial' : ''} <b data-testid="tv-cash-value">{value(metrics?.cash, 'currency')}</b></span>
  </div>
}
function PaceStatus({ pace, plansError }) {
  if (pace?.scopeExcluded) return <span className="tv-status">Pessoa fora dos cálculos de desempenho</span>
  if (pace?.membershipUnavailable) return <span className="tv-status">Participantes indisponíveis</span>
  if (plansError) return <span className="tv-status">Meta não confirmada</span>
  if (!pace?.validTarget) return <span className="tv-status">Meta não cadastrada nesta base</span>
  if (pace.future) return <span className="tv-status">Mês ainda não iniciado</span>
  if (!pace.definitive) return <span className="tv-status">Leitura parcial · pace a confirmar</span>
  if (pace.ended) return <span className="tv-status" data-positive={pace.attainment >= 100}>{pace.attainment >= 100 ? 'Meta atingida' : 'Mês encerrado abaixo da meta'}</span>
  return <span className="tv-status" data-positive={pace.delta >= 0}>{pace.delta >= 0 ? 'Acima do pace' : 'Abaixo do pace'} · {value(Math.abs(pace.delta), pace.metric.unit)}</span>
}
function PaceGraph({ model, pace = model.pace, height = 410 }) {
  const basis = metricName(model)
  return <ReferenceChart rows={pace.rows} title={`Ritmo diário · ${model.paceName || 'Meta geral'} · ${basis}`} height={height} mode="area" referenceDate={model.today} shadeAfterReference
    series={[{ key: 'actual', label: `Realizado · ${basis}`, unit: model.unit, color: 'var(--tv-ink)', fill: true }, { key: 'planned', label: `Meta acumulada · ${basis}`, unit: model.unit, color: 'var(--chart-3)', dash: '6 6', fill: false }]}/>
}
function MonthlyGoal({ model, chartHeight }) {
  const pace = model.overview
  const basis = metricName(model)
  return <div className="tv-monthly">
    <div className="tv-monthly-lead"><FinancialHero metrics={model.totals} context="realizado no mês"/><div className="tv-goal-dial"><small className="tv-goal-basis">Base da meta: {basis}</small><span className="tv-goal-attainment">{pace.validTarget ? percent(pace.attainment) : 'Sem meta'}</span><small>da meta mensal · {value(pace.actual, model.unit)} realizados</small><div className="tv-track"><i style={{ width: fill(pace.attainment) }}/></div><PaceStatus pace={pace} plansError={model.plansError}/></div></div>
    <div className="tv-stat-row"><Stat label={`Meta do mês · ${basis}`} amount={pace.validTarget ? pace.target : null} unit={model.unit}/><Stat label={`Falta para a meta · ${basis}`} amount={pace.remaining} unit={model.unit}/><Stat label="Vendas realizadas" amount={model.totals.count} unit="count"/><Stat label={`Necessário por dia · ${basis}`} amount={pace.requiredPerDay} unit={model.unit}/></div>
    {Array.isArray(model.overallPlan?.breakdown) && <div className="tv-allocation"><span>Composição da meta · {basis}</span>{model.overallPlan.breakdown.map(part => <span key={part.key}><i/>{part.key === 'marketing' ? 'Marketing' : 'Vendas'} <b>{value(part.target, model.unit)}</b></span>)}</div>}
    <PaceGraph model={{ ...model, paceName: 'Meta geral' }} pace={pace} height={Math.max(200, chartHeight - 190)}/>
  </div>
}
function PacePanel({ model, chartHeight }) {
  const pace = model.pace
  const basis = metricName(model)
  return <div className="tv-pace-panel"><div className="tv-pace-heading"><FinancialHero metrics={pace} context={model.paceName || 'Meta geral'}/><div className="tv-pace-status"><span className="tv-goal-basis">Base da meta: {basis}</span><PaceStatus pace={pace} plansError={model.plansError}/></div></div>
    <div className="tv-stat-row"><Stat label={`Realizado · ${basis}`} amount={pace.actual} unit={model.unit}/><Stat label={`Esperado até hoje · ${basis}`} amount={pace.expected} unit={model.unit}/><Stat label={`Meta do mês · ${basis}`} amount={pace.validTarget ? pace.target : null} unit={model.unit}/><Stat label={`Projeção · ${basis}`} amount={pace.projection} unit={model.unit}/></div>
    <PaceGraph model={model} height={chartHeight}/>
    <p className="tv-footnote">{pace.basis === 'business' ? 'Distribuição em dias úteis, sem calendário de feriados.' : 'Distribuição linear pelos dias do mês.'} Projeção estimada{!pace.definitive ? ' com dados parciais' : ''}. {pace.unassignedRecords > 0 && `${pace.unassignedRecords} vendas ainda sem atribuição para este recorte.`}</p>
  </div>
}
function GoalComparison({ items, model, kind }) {
  if (kind === 'times' && model.directoryError) return <Empty title="Metas de times indisponíveis">Não foi possível confirmar os participantes dos times. Os indicadores financeiros gerais continuam disponíveis.</Empty>
  if (!items.length) return <Empty title={model.plansError ? 'Metas indisponíveis' : `Sem metas de ${kind} nesta base`}>Cadastre as metas em Metas e planejamento, usando a mesma base selecionada para a TV.</Empty>
  const basis = metricName(model)
  return <div className="tv-comparison"><div className="tv-table-caption"><span>Base da meta: {basis}</span><span>Atingimento</span></div>{items.slice(0, 8).map((item, index) => <div className="tv-goal-row" data-tv-row-id={item.id} key={item.id} style={{ '--row-color': `var(--chart-${index % 6 + 1})` }}><div className="tv-row-name"><h3>{item.name}</h3><span className="tv-goal-context">{!item.pace.definitive ? 'Parcial · ' : ''}{basis}: {value(item.pace.actual, model.unit)} <small>/ {value(item.pace.target, model.unit)} de meta</small></span></div><DualAmount metrics={item}/><strong>{item.pace.validTarget ? percent(item.pace.attainment) : 'Sem meta'}</strong><div className="tv-track"><i style={{ width: fill(item.pace.attainment) }}/></div></div>)}<p className="tv-footnote">{items.length > 8 ? `Exibindo os 8 maiores atingimentos entre ${items.length} metas. ` : ''}Cada barra representa o avanço da própria meta em {basis.toLocaleLowerCase('pt-BR')}.{model.directoryError ? ' Cadastro de times e vendedores indisponível.' : ''}</p></div>
}
function Ranking({ rows, model, sellers = false, daily = false, weekly = false, compact = false }) {
  const unassigned = sellers ? weekly ? model.weekly.unassignedSeller : daily ? model.daily.unassignedSeller : model.unassigned.seller
    : !daily && !weekly ? model.unassigned?.product : null
  const hasUnassigned = unassigned && (unassigned.count > 0 || Math.abs(unassigned.gross || 0) > 0 || Math.abs(unassigned.cash || 0) > 0)
  const missingNote = hasUnassigned ? `${value(unassigned.count, 'count')} vendas sem ${sellers ? 'vendedor' : 'produto'}: valor das vendas ${value(unassigned.gross, 'currency')} · cash collected ${value(unassigned.cash, 'currency')}. ` : ''
  if (sellers && model.directoryError) return <Empty title="Ranking indisponível">Não foi possível confirmar os participantes. Os indicadores financeiros gerais continuam disponíveis.</Empty>
  if (sellers && model.attributionAvailable === false && !rows.length) return <Empty title="Atribuições indisponíveis">Não foi possível confirmar os vendedores das vendas. O ranking será atualizado quando as atribuições estiverem disponíveis.</Empty>
  if (!rows.length) return <Empty title={sellers ? 'Sem vendas atribuídas a vendedores' : 'Sem vendas por produto neste período'}>{sellers ? 'As vendas sem atribuição ficam fora do ranking. O head pode atribuí-las na tela de Atribuição.' : 'O ranking será preenchido conforme as vendas forem identificadas.'}{missingNote && ` ${missingNote}`}</Empty>
  const max = Math.max(1, ...rows.map(row => row.value || 0))
  const limit = compact ? 5 : 8
  return <div className={`tv-ranking${compact ? ' tv-ranking-compact' : ''}`}><p className="tv-order-basis">{weekly ? 'De segunda-feira até hoje · ' : daily ? 'Somente hoje · ' : ''}Ordenação: {metricName(model)}</p>{!compact && rows[0].value > 0 && <div className="tv-ranking-leader"><Trophy size={34}/><div className="tv-ranking-leader-name"><span className="tv-eyebrow">{sellers ? weekly ? 'Destaque da semana' : daily ? 'Destaque do dia' : 'Destaque do mês' : 'Produto em destaque'}</span><h3>{rows[0].name}</h3></div><DualAmount metrics={rows[0]}/></div>}
    <div className="tv-ranking-rows">{rows.slice(0, limit).map((row, index) => <div className="tv-ranking-row" data-tv-row-id={row.id} key={row.id} style={{ '--row-color': `var(--chart-${index % 6 + 1})` }}><span className="tv-position">{String(index + 1).padStart(2, '0')}</span><div className="tv-ranking-name"><strong>{row.name}</strong><div className="tv-track"><i style={{ width: fill((row.value || 0) / max * 100) }}/></div><span>{value(row.count, 'count')} vendas{row.partial ? ' · parcial' : ''}</span></div><div className="tv-ranking-result"><DualAmount metrics={row}/></div></div>)}</div>
    <p className="tv-footnote">{rows.length > limit ? `Top ${limit} de ${rows.length}. ` : ''}{missingNote}Somente novas vendas identificadas{model.attributionAvailable === false ? ' · atribuições indisponíveis' : ''}.</p>
  </div>
}
function Daily({ model, chartHeight }) {
  const day = model.daily
  if (!day.inSelectedMonth) return <Empty title="Hoje está fora do mês selecionado">Use o período Mês atual para acompanhar as vendas do dia nesta programação.</Empty>
  return <div><div className="tv-daily-lead"><FinancialHero metrics={day} context="hoje · horário de Brasília"/><ArrowUpRight size={64}/></div>
    <div className="tv-stat-row"><Stat label="Vendas realizadas hoje" amount={day.count} unit="count"/></div>
    <ReferenceChart rows={day.hours.map(hour => ({ ...hour, label: hour.hour }))} title="Vendas de hoje por hora" height={Math.max(210, chartHeight - 120)} mode="bar" series={[{ key: 'gross', label: 'Valor das vendas', unit: 'currency', color: 'var(--chart-1)' }, { key: 'cash', label: 'Cash collected', unit: 'currency', color: 'var(--accent)' }]}/>
    {day.unknownHourCount > 0 && <p className="tv-footnote">{day.unknownHourCount} vendas com horário não informado, fora do gráfico por hora.</p>}
  </div>
}
function PaymentMix({ model, daily = false, weekly = false }) {
  const period = weekly ? model.weekly : daily ? model.daily : model
  const rows = period.payments.filter(row => row.value !== 0 || row.count > 0 || ((daily || weekly) && ['card', 'boleto'].includes(row.id)))
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0)
  const complete = total > 0 && rows.every(row => row.value != null && !(model.metric === 'count' ? row.partial : isPartial(row, model.metric === 'cash' ? 'cash' : 'gross')))
  return <div className="tv-split tv-payment-products" data-testid="tv-payment-products">
    <section className="tv-split-column" aria-label="Meios de pagamento"><h2>Cartão vs. boleto</h2>
      {!rows.length ? <Empty title="Sem meios de pagamento neste período">Os valores aparecerão quando houver novas vendas no período.</Empty>
        : <div className="tv-payments"><p className="tv-order-basis">{weekly ? 'De segunda-feira até hoje · ' : daily ? 'Somente hoje · ' : ''}Participação em {metricName(model).toLocaleLowerCase('pt-BR')}</p>{complete && <div className="tv-payment-strip" aria-hidden="true">{rows.filter(row => row.value > 0).map((row, index) => <i key={row.id} style={{ width: `${row.value / total * 100}%`, background: `var(--chart-${index % 6 + 1})` }}/>)}</div>}{rows.map((row, index) => <div className="tv-payment-row" data-tv-row-id={row.id} key={row.id}><i style={{ background: `var(--chart-${index % 6 + 1})` }}/><div><h3>{row.name}</h3><span>{value(row.count, 'count')} vendas{row.partial && ' · parcial'}</span></div><DualAmount metrics={row}/><b data-testid="tv-payment-share">{complete ? percent(row.value / total * 100) : '—'}</b></div>)}<p className="tv-footnote">Guru, Hotmart e Hubla: Cartão. TMB e Boletex: Boleto. Somente novas vendas.{!complete && total > 0 ? ' Percentuais indisponíveis com dados parciais.' : ''}</p></div>}
    </section>
    <section className="tv-split-column" aria-label="Faturamento por produto"><h2>Faturamento por produto</h2><Ranking rows={period.products || []} model={model} daily={daily} weekly={weekly} compact/></section>
  </div>
}

function WeeklySellers({ model }) {
  const week = model.weekly
  const teams = week.sellerTeams || [{ id: 'mba', name: 'MBA', available: false, sellers: [] }, { id: 'devclub', name: 'DevClub', available: false, sellers: [] }]
  const commercialShare = !isPartial(week, 'gross') && !isPartial(week.commercial, 'gross') ? week.commercialSharePercent : null
  return <div className="tv-weekly-sellers">
    <div className="tv-weekly-overview">
      <section data-testid="tv-weekly-total"><header><h2>Faturamento total da semana</h2><span>{value(week.count, 'count')} vendas</span></header><DualAmount metrics={week}/></section>
      <section data-testid="tv-weekly-commercial"><header><h2>Faturamento do Comercial</h2><span>Participação do Comercial <b data-testid="tv-commercial-share">{percent(commercialShare)}</b></span></header><DualAmount metrics={week.commercial}/></section>
    </div>
    <div className="tv-split tv-team-rankings">{teams.map(team => <section className="tv-split-column" data-tv-team-id={team.id} key={team.id} aria-label={`Ranking do time ${team.name}`}>
      <header className="tv-team-heading"><div><h2>Time {team.name}</h2><p>{value(team.count, 'count')} vendas · ordenação: {metricName(model)}</p></div><DualAmount metrics={team}/></header>
      {model.directoryError ? <Empty title="Participantes indisponíveis">Não foi possível confirmar os participantes deste time.</Empty>
        : team.available === false ? <Empty title="Time indisponível">Não foi possível confirmar o time e seus resultados no cadastro de participantes.</Empty>
          : !team.sellers.length ? <Empty title={week.attributionAvailable === false ? 'Atribuições indisponíveis' : 'Sem vendas atribuídas neste time'}>O ranking será preenchido conforme as vendas forem identificadas.</Empty>
            : <div className="tv-ranking-rows">{team.sellers.slice(0, 5).map((row, index) => <div className="tv-ranking-row tv-team-row" data-tv-row-id={row.id} key={row.id}>
              <span className="tv-position">{String(index + 1).padStart(2, '0')}</span><div className="tv-ranking-name"><strong>{row.name}</strong><span>{value(row.count, 'count')} vendas{row.partial ? ' · parcial' : ''}</span></div><DualAmount metrics={row}/>
            </div>)}</div>}
      {team.sellers.length > 5 && <p className="tv-footnote">Top 5 de {team.sellers.length}. O total do time inclui todos os vendedores participantes.</p>}
    </section>)}</div>
    <p className="tv-footnote">De segunda-feira até hoje. Cada ranking reúne os vendedores cadastrados no próprio time.{week.unassignedSeller?.count > 0 && ` ${value(week.unassignedSeller.count, 'count')} vendas sem vendedor ficam fora dos rankings.`}</p>
  </div>
}
function DailyCash({ model, chartHeight, weekly = false }) {
  const day = weekly ? model.weekly : model.daily
  const periodLabel = weekly ? 'semana' : 'hoje'
  const chartRows = weekly ? day.days : day.hours.map(hour => ({ ...hour, label: hour.hour }))
  return <div className="tv-daily-cash">
    <div className="tv-financial-hero"><span className="tv-eyebrow">Cash collected · {periodLabel}{isPartial(day, 'cash') ? ' · parcial' : ''}</span>
      <strong className="tv-hero-value" data-testid="tv-main-value"><span data-testid="tv-cash-value">{value(day.cash, 'currency')}</span></strong>
      <div className="tv-cash-secondary"><span>Valor das vendas{isPartial(day, 'gross') ? ' · parcial' : ''}</span><strong data-testid="tv-gross-value">{value(day.gross, 'currency')}</strong><small>{weekly ? tvWeekLabel(day.startDate, day.endDate) : 'Hoje · horário de Brasília'}</small></div>
    </div>
    <p className="tv-footnote">Somente cash collected de novas vendas. Recebimentos de faturas de vendas passadas ficam fora.</p>
    <ReferenceChart rows={chartRows} title={weekly ? 'Cash collected da semana por dia' : 'Cash collected de hoje por hora'} height={Math.max(210, chartHeight - 70)} mode="bar" series={[{ key: 'cash', label: 'Cash collected', unit: 'currency', color: 'var(--accent)' }]}/>
    {day.unknownHourCount > 0 && <p className="tv-footnote">{day.unknownHourCount} vendas com horário não informado, fora do gráfico por hora.</p>}
  </div>
}
function Weekly({ model, chartHeight }) {
  const week = model.weekly
  return <div><div className="tv-daily-lead"><FinancialHero metrics={week} context="acumulado da semana"/><ArrowUpRight size={64}/></div>
    <p className="tv-footnote">{tvWeekLabel(week.startDate, week.endDate)} · De segunda-feira até hoje.</p>
    <div className="tv-stat-row"><Stat label="Vendas realizadas na semana" amount={week.count} unit="count"/></div>
    <ReferenceChart rows={week.days} title="Vendas da semana por dia" height={Math.max(210, chartHeight - 160)} mode="bar" series={[{ key: 'gross', label: 'Valor das vendas', unit: 'currency', color: 'var(--chart-1)' }, { key: 'cash', label: 'Cash collected', unit: 'currency', color: 'var(--accent)' }]}/>
  </div>
}
export function TvPanel({ panelId, model, loading, chartHeight = 370 }) {
  if (!model || loading) return <div className="tv-empty" role="status"><div className="tv-loading-line"/><h3>Carregando os indicadores</h3><p>Carregando os resultados do período e atualizando as vendas de hoje.</p></div>
  if (['daily-payments', 'daily-cash', 'daily-sellers'].includes(panelId) && !model.daily?.inSelectedMonth) return <Empty title="Hoje está fora do mês selecionado">Use o período Mês atual para acompanhar as vendas do dia nesta programação.</Empty>
  if (WEEKLY_TV_PANELS.includes(panelId) && !model.weekly) return <Empty title="Semana indisponível">Aguarde a próxima atualização dos indicadores.</Empty>
  switch (panelId) {
    case 'monthly-goal': return <MonthlyGoal model={model} chartHeight={chartHeight}/>
    case 'pace': return <PacePanel model={model} chartHeight={Math.max(230, chartHeight - 180)}/>
    case 'team-goals': return <GoalComparison items={model.teamGoals} model={model} kind="times"/>
    case 'product-goals': return <GoalComparison items={model.productGoals} model={model} kind="produtos"/>
    case 'sellers': return <Ranking rows={model.sellers} model={model} sellers/>
    case 'products': return <Ranking rows={model.products} model={model}/>
    case 'daily': return <Daily model={model} chartHeight={chartHeight}/>
    case 'daily-payments': return <PaymentMix model={model} daily/>
    case 'daily-cash': return <DailyCash model={model} chartHeight={chartHeight}/>
    case 'daily-sellers': return <Ranking rows={model.daily.sellers} model={model} sellers daily/>
    case 'payment-mix': return <PaymentMix model={model}/>
    case 'weekly': return <Weekly model={model} chartHeight={chartHeight}/>
    case 'weekly-payments': return <PaymentMix model={model} weekly/>
    case 'weekly-cash': return <DailyCash model={model} chartHeight={chartHeight} weekly/>
    case 'weekly-sellers': return <WeeklySellers model={model}/>
    default: return <Empty title="Selecione um painel">Escolha um painel na programação da TV.</Empty>
  }
}
