/* eslint-disable react/prop-types -- Internal period/filter contract. */
import { useEffect, useRef, useState } from 'react'
import { loadAsaasCashRange } from '../../services/asaasCashService'
import { formatCurrency } from '../../utils/currencyUtils'

export default function AnnualAsaasCashPanel({ startDate, endDate, filters = {} }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState({ current: 0, total: 0, failed: 0 })
  const requestId = useRef(0)
  useEffect(() => () => { requestId.current++ }, [])
  const allocationMissing = Object.entries(filters).some(([key, value]) => key !== 'platform' && Boolean(value))
  if (filters.platform && filters.platform !== 'Asaas') return null
  const future = startDate > endDate
  async function consult() {
    const id = ++requestId.current
    const isCancelled = () => id !== requestId.current
    const force = result?.status === 'ready'
    setLoading(true); setError(''); setResult(null); setProgress({ current: 0, total: 0, failed: 0 })
    try {
      const next = await loadAsaasCashRange(startDate, endDate, { force, isCancelled, onProgress: value => { if (!isCancelled()) setProgress(value) } })
      if (!isCancelled()) setResult(next)
    } catch { if (!isCancelled()) setError('Não foi possível consultar o caixa Asaas. Nenhum valor foi substituído por zero.') }
    finally { if (!isCancelled()) setLoading(false) }
  }
  const cash = result?.cash
  const label = loading ? 'Consultando caixa…' : result?.status === 'ready' ? 'Atualizar caixa Asaas' : result ? 'Consultar intervalos pendentes' : 'Consultar caixa Asaas'
  return <section className="surface-panel ds-card p-5" aria-label="Caixa Asaas do período">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Caixa Asaas do período</h2><p className="text-xs text-slate-500 mt-2">Consulte os recebimentos do Asaas separadamente enquanto acompanha os resultados das demais plataformas.</p></div><button type="button" className="btn btn-ghost shrink-0 disabled:opacity-40" disabled={loading || allocationMissing || future} onClick={consult}>{label}</button></div>
    <p className="text-xs text-slate-500 mt-3">Recebimentos de {startDate.split('-').reverse().join('/')} a {endDate.split('-').reverse().join('/')}, incluindo parcelas de contratos antigos. Vendas novas e valores contratados Asaas permanecem indisponíveis sem o histórico original das vendas.</p>
    {future ? <p className="text-sm text-slate-500 mt-4">Este período ainda não começou.</p> : allocationMissing ? <p className="text-sm text-amber-700 dark:text-amber-200 mt-4">Caixa sem distribuição para estes filtros. Não há atribuição de produto, família, pagamento, oferta ou UTM; nenhum valor foi rateado.</p> : <>
      {!loading && !result && !error && <p className="text-sm text-slate-500 mt-4">Caixa ainda não consultado. Nenhum recebimento Asaas foi incluído nos indicadores operacionais.</p>}
      {error && <p role="alert" className="text-sm text-amber-700 dark:text-amber-200 mt-4">{error}</p>}
      {loading && <div className="mt-4"><p role="status" className="text-sm">Consultando caixa Asaas · {progress.current} de {progress.total} intervalos concluídos{progress.failed ? ` · ${progress.failed} com falha` : ''}.</p><progress className="w-full mt-3 h-2" aria-label="Progresso da consulta Asaas" max={progress.total || 1} value={progress.current} /><p className="text-xs text-slate-500 mt-2">Os valores serão consolidados após todos os intervalos responderem.</p></div>}
      {result?.status === 'unavailable' && <p role="status" className="text-sm text-amber-700 dark:text-amber-200 mt-4">Caixa indisponível: nenhum dos {result.failedPeriods.length} intervalos respondeu com dados completos. O total permanece desconhecido.</p>}
      {result?.status === 'partial' && <p role="status" className="text-sm text-amber-700 dark:text-amber-200 mt-4">Subtotal parcial: {cash.availablePeriods} de {cash.periods} intervalos disponíveis. O total do período está indisponível; os intervalos com falha não foram tratados como zero.</p>}
      {cash && <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{[['Recebimentos brutos', formatCurrency(cash.gross)], ['Taxas de recebimento', formatCurrency(cash.fees)], ['Recebimentos líquidos', formatCurrency(cash.net)], ['Movimentações recebidas', cash.count.toLocaleString('pt-BR')]].map(([title, value]) => <div key={title}><h3 className="text-xs text-slate-500">{title}</h3><p className="text-xl font-semibold mt-2 tabular-nums break-words">{value}</p></div>)}</div>}
      {result?.status === 'ready' && <p role="status" className="text-xs text-slate-500 mt-4">{cash.count === 0 ? 'Consulta concluída sem recebimentos no período.' : 'Todos os intervalos foram consultados.'}</p>}
    </>}
    <p className="text-xs text-slate-500 mt-4">Estes recebimentos não entram na receita operacional, na quantidade de vendas nem no ticket médio. O líquido desconta as taxas de pagamento e notificação; não é o saldo total da conta.</p>
  </section>
}
