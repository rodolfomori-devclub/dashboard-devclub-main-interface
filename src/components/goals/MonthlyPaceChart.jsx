/* eslint-disable react/prop-types -- Internal presentation of calculateGoalPace. */
import { useEffect, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Maximize2, Minimize2, Minus } from 'lucide-react'
import { ReferenceChart } from '../charts/ReferenceChart'
import { formatDate, formatValue } from '../charts/chartFormatters'
import { GOAL_AREAS } from './goalConfig'
import './monthlyPaceChart.css'

const percent = value => value === null ? '—' : `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

function paceStatus(pace, ready, targetUnavailable) {
  if (!ready) return { label: 'Carregando o mês', tone: 'neutral' }
  if (targetUnavailable) return { label: 'Meta indisponível', tone: 'neutral' }
  if (pace.future) return { label: 'Mês não iniciado', tone: 'neutral' }
  if (!pace.validTarget) return { label: 'Sem meta definida', tone: 'neutral' }
  if (pace.actual === null) return { label: 'Realizado indisponível', tone: 'neutral' }
  if (!pace.definitive) return { label: 'Leitura parcial', tone: 'partial' }
  if (pace.delta > 0) return { label: 'Acima do pace', tone: 'ahead' }
  if (pace.delta < 0) return { label: 'Abaixo do pace', tone: 'behind' }
  return { label: 'No pace', tone: 'ahead' }
}

function useChartHeight(expanded) {
  const [height, setHeight] = useState(560)
  useEffect(() => {
    const resize = () => setHeight(expanded
      ? Math.max(300, Math.min(1100, window.innerHeight - (window.innerWidth < 650 ? 380 : 290)))
      : window.innerWidth < 650 ? 360 : Math.max(480, Math.min(640, Math.round(window.innerHeight * .56))))
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [expanded])
  return height
}

function PaceStage({ pace, ready, loading, targetUnavailable, breakdown, scopeName, periodLabel, today, selectionKey, mode, onMode, expanded, onExpand, onClose }) {
  const height = useChartHeight(expanded)
  const status = paceStatus(pace, ready, targetUnavailable)
  const value = number => formatValue(number, pace.metric.unit)
  const DeltaIcon = pace.delta > 0 ? ArrowUpRight : pace.delta < 0 ? ArrowDownRight : Minus
  const deltaText = pace.delta === null || !ready ? 'Comparação indisponível'
    : pace.delta === 0 ? 'No valor esperado' : `${value(Math.abs(pace.delta))} ${pace.delta > 0 ? 'à frente' : 'atrás'}`
  const series = [
    { key: 'actual', label: pace.definitive ? 'Realizado' : 'Realizado parcial', unit: pace.metric.unit, color: 'var(--chart-1, #d14963)' },
    { key: 'planned', label: 'Meta acumulada', unit: pace.metric.unit, color: 'var(--chart-2, #1684b1)', dash: '6 5', fill: false },
  ]
  return <>
    <header className="pace-stage-heading">
      <div><h2>{expanded ? 'Ritmo da meta em tela ampliada' : 'Ritmo da meta'}</h2><p><strong>{scopeName}</strong><span>{periodLabel}</span><span>{pace.metric.label}</span></p></div>
      <div className="pace-stage-actions">
        <div className="daily-segment" role="group" aria-label="Formato do gráfico">{[['area', 'Área'], ['line', 'Linhas'], ['bar', 'Barras']].map(([key, label]) => <button className="button" key={key} aria-pressed={mode === key} onClick={() => onMode(key)}>{label}</button>)}</div>
        <button className="button pace-stage-expand" onClick={expanded ? onClose : onExpand}>{expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}<span>{expanded ? 'Recolher gráfico' : 'Ampliar gráfico'}</span></button>
      </div>
    </header>

    <div className="pace-stage-scoreboard" aria-label="Resumo do pace selecionado">
      <div className="pace-stage-actual"><span>Realizado no mês{ready && !pace.future && !pace.definitive ? ' · parcial' : ''}</span><strong>{!ready ? '—' : pace.future ? 'Não iniciado' : value(pace.actual)}</strong></div>
      <div className="pace-stage-target"><span>Meta do mês</span><strong className="pace-target">{!ready ? '—' : targetUnavailable ? 'Indisponível' : pace.validTarget ? value(pace.target) : 'Sem meta definida'}</strong><small>{targetUnavailable ? 'Não foi possível consultar a meta.' : pace.attainment !== null && !pace.future ? `${percent(pace.attainment)} de atingimento${pace.definitive ? '' : ' parcial'}` : pace.validTarget ? 'Definida para o escopo selecionado' : 'O comparativo depende de uma meta.'}</small></div>
      <div className={`pace-stage-gap is-${status.tone}`}><span className="pace-stage-status" role="status">{loading && ready ? 'Atualizando · ' : ''}{status.label}</span><strong><DeltaIcon size={21} aria-hidden="true" />{deltaText}</strong><small>{pace.pacePercent === null ? 'Compare o realizado com o esperado até hoje.' : `${percent(pace.pacePercent)} do esperado${pace.definitive ? '' : ' · resultado parcial'}`}</small></div>
    </div>

    {Array.isArray(breakdown) && <div className="pace-stage-allocation" aria-label="Composição planejada da meta geral"><span>Meta geral =</span>{GOAL_AREAS.map(({ key, label }, index) => <div key={key}>{index > 0 && <b aria-hidden="true">+</b>}<i className={`pace-allocation-${key}`} aria-hidden="true" /><span>{label}</span><strong>{value(breakdown.find(part => part.key === key)?.target)}</strong></div>)}</div>}

    <div className="pace-stage-chart" aria-busy={loading}>
      <ReferenceChart key={selectionKey} title="Evolução acumulada da meta" rows={pace.rows} series={series} height={height} mode={mode}
        referenceDate={!pace.future && !pace.ended ? today : undefined} referenceLabel="Hoje" shadeAfterReference tickSpacing={32}
        tooltipTitle={row => formatDate(row.date, { weekday: 'short', month: 'long' })}
        tooltipRows={row => [
          { label: 'Realizado no dia', value: row.observed ? value(row.dailyActual) : 'Ainda não observado' },
          { label: 'Distância da meta', value: row.actual === null || row.planned === null ? 'Não informado' : `${row.actual - row.planned > 0 ? '+' : ''}${value(row.actual - row.planned)}` },
        ]}
        tooltipNote={row => !row.observed ? 'O futuro mostra somente o planejamento.' : row.actual === null ? 'Realizado indisponível neste recorte.' : !pace.definitive ? 'Subtotal conhecido. A cobertura deste recorte é parcial.' : null} />
    </div>

    <div className="pace-stage-footer">
      <p>{pace.future ? 'O acompanhamento começa no primeiro dia do mês.' : pace.ended ? 'Mês encerrado. A curva mostra os valores observados.' : `${pace.elapsedDays} de ${pace.totalDays} dias ${pace.basis === 'business' ? 'úteis' : 'corridos'} considerados.`}<span>{pace.basis === 'business' ? 'Planejamento de segunda a sexta.' : 'Planejamento distribuído pelos dias do mês.'}</span></p>
      <div><span>{pace.ended ? 'Esperado no fechamento' : 'Esperado até hoje'}</span><strong>{!ready ? '—' : targetUnavailable ? 'Indisponível' : pace.validTarget ? value(pace.expected) : 'Sem meta'}</strong></div>
      <div><span>{pace.ended ? 'Saldo para a meta' : 'Necessário por dia restante'}</span><strong>{ready ? value(pace.ended ? pace.remaining : pace.requiredPerDay) : '—'}</strong></div>
    </div>
    {pace.unallocatedRecords > 0 && <p className="pace-stage-coverage">{pace.unallocatedRecords} registros ({value(pace.unallocated)}) sem data estão no total do mês, mas não na curva. O detalhe de cada dia compara apenas valores com data.</p>}
    <p className="pace-stage-help">Passe sobre a curva ou toque em um dia para ver os valores. Com o gráfico em foco, use as setas do teclado.</p>
  </>
}

export default function MonthlyPaceChart(props) {
  const [mode, setMode] = useState('area')
  const [expanded, setExpanded] = useState(false)
  const dialog = useRef(null)
  useEffect(() => {
    if (!expanded) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.current?.showModal()
    return () => { document.body.style.overflow = previous }
  }, [expanded])
  const close = () => dialog.current?.close()
  const dialogKeyboard = event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const controls = [...dialog.current.querySelectorAll('button:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length)
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <>
    <section className="surface-panel pace-stage pace-hero" aria-label="Pace mensal" data-pace-scope={props.selectionKey}>
      <PaceStage {...props} mode={mode} onMode={setMode} onExpand={() => setExpanded(true)} />
    </section>
    {expanded && <dialog ref={dialog} className="pace-stage-dialog" aria-label="Ritmo da meta em tela ampliada" onClose={() => setExpanded(false)} onKeyDown={dialogKeyboard}>
      <PaceStage {...props} mode={mode} onMode={setMode} expanded onClose={close} />
    </dialog>}
  </>
}
