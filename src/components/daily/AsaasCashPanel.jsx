/* eslint-disable react/prop-types -- Internal normalized financial metadata. */
import { asaasCashView } from '../../utils/sourceAvailability'
import { formatCurrency } from '../../utils/currencyUtils'

export default function AsaasCashPanel({ sources, filters }) {
  const cash = asaasCashView(sources, filters)
  if (!cash) return null
  return <section className="surface-panel ds-card p-5" aria-label="Caixa Asaas do período">
    <h2 className="font-semibold">Caixa Asaas do período</h2>
    <p className="text-xs text-slate-500 mt-2">Recebimentos confirmados na API, incluindo parcelas de contratos antigos. Vendas novas e valores contratados Asaas não estão disponíveis sem o histórico de checkout.</p>
    {cash.allocationMissing ? <p className="text-sm text-amber-700 dark:text-amber-200 mt-4">Caixa sem distribuição para estes filtros. Não há atribuição de produto, família, pagamento, oferta ou UTM; nenhum valor foi rateado.</p> : <>
      {cash.partial && <p className="text-sm text-amber-700 dark:text-amber-200 mt-3">Caixa parcial: {cash.availablePeriods} de {cash.periods} períodos disponíveis.</p>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{[['Recebimentos brutos', formatCurrency(cash.gross)], ['Taxas de recebimento', formatCurrency(cash.fees)], ['Recebimentos líquidos', formatCurrency(cash.net)], ['Movimentações recebidas', cash.count.toLocaleString('pt-BR')]].map(([label, value]) => <div key={label}><h3 className="text-xs text-slate-500">{label}</h3><p className="text-xl font-semibold mt-2 tabular-nums break-words">{value}</p></div>)}</div>
    </>}
    <p className="text-xs text-slate-500 mt-4">Estes recebimentos não entram na receita operacional, na quantidade de vendas nem no ticket médio. O líquido desconta as taxas de pagamento e notificação; não é o saldo total da conta.</p>
  </section>
}
