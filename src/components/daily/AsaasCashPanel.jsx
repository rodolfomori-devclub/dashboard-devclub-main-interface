/* eslint-disable react/prop-types -- Internal normalized financial metadata. */
import { asaasCashView } from '../../utils/sourceAvailability'
import { formatCurrency } from '../../utils/currencyUtils'

export default function AsaasCashPanel({ sources, filters }) {
  const cash = asaasCashView(sources, filters)
  if (!cash) return null
  return <section className="surface-panel ds-card p-5" aria-label="Caixa Asaas do período">
    <div className="flex items-center gap-3"><h2 className="font-semibold">Caixa Asaas do período</h2>{cash.partial && <span className="text-xs text-slate-500">Parcial</span>}</div>
    <p className="text-xs text-slate-500 mt-2">Recebimentos confirmados, incluindo parcelas de contratos anteriores.</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">{[['Recebimentos brutos', formatCurrency(cash.gross)], ['Taxas de recebimento', formatCurrency(cash.fees)], ['Recebimentos líquidos', formatCurrency(cash.net)], ['Movimentações recebidas', cash.count.toLocaleString('pt-BR')]].map(([label, value]) => <div key={label}><h3 className="text-xs text-slate-500">{label}</h3><p className="text-xl font-semibold mt-2 tabular-nums break-words">{cash.allocationMissing ? 'Não informado' : value}</p></div>)}</div>
    <details className="text-xs text-slate-500 mt-4"><summary className="cursor-pointer">Como ler o caixa Asaas</summary><p className="mt-2">Os recebimentos compõem o caixa, separados da receita contratada, da quantidade de vendas e do ticket médio. O líquido desconta as taxas de pagamento e notificação; não é o saldo total da conta.</p></details>
  </section>
}
