/* eslint-disable react/prop-types -- Values come from normalized period sales. */
import { Download } from 'lucide-react'
import { UNKNOWN } from '../../utils/salesData'

const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const count = value => Number(value || 0).toLocaleString('pt-BR')
const amount = value => value.known || !value.missing ? currency(value.value) : '—'

export default function CommercialSalesPanel({ report, sellers, sellerId, onSellerChange, onExport, exporting, loading, available, partial, attributionUnavailable }) {
  return <section className="ds-card p-5 commercial-sales-panel" aria-label="Resultado do Comercial" aria-busy={loading}>
    <header className="flex flex-wrap justify-between items-start gap-4">
      <div><h2 className="font-semibold">Resultado do Comercial</h2><p className="text-sm text-slate-500 mt-1">Vendas por vendedor e UTM, no período e nos filtros selecionados.</p></div>
      <button type="button" className="btn btn-ghost disabled:opacity-40" onClick={onExport} disabled={loading || exporting || !report.records.length}><Download size={16} />{exporting ? 'Gerando Excel…' : 'Exportar Comercial'}</button>
    </header>
    <div className="commercial-sales-summary">
      <div><p className="text-xs text-slate-500">Receita operacional do Comercial</p><p className="text-2xl font-semibold tabular-nums mt-2" data-testid="commercial-revenue">{available ? amount(report.total.revenue) : '—'}</p><p className="text-xs text-slate-500 mt-1">{available ? `${count(report.total.count)} vendas${partial || report.total.revenue.missing ? ' · resultado parcial' : ''}` : 'Fontes de vendas indisponíveis'}</p></div>
      <label className="commercial-seller-filter"><span className="ds-label">Vendedor</span><select aria-label="Vendedor" className="ds-input" value={sellerId} onChange={event => onSellerChange(event.target.value)}><option value="">Todos os vendedores</option>{sellerId && sellerId !== UNKNOWN && !sellers.some(seller => seller.id === sellerId) && <option value={sellerId}>Vendedor selecionado (sem dados disponíveis)</option>}{sellers.map(seller => <option key={seller.id} value={seller.id}>{seller.name}</option>)}<option value={UNKNOWN}>Sem vendedor vinculado</option></select><span className="text-xs text-slate-500">Aplica o filtro a toda a visão.</span></label>
    </div>
    {attributionUnavailable && <p role="status" className="daily-notice is-warning">Vínculos de vendedores indisponíveis. O resultado do Comercial pode estar incompleto; as UTMs recebidas continuam visíveis.</p>}
    <div className="overflow-x-auto">
      <table className="data-table w-full text-sm min-w-[690px]" aria-label="Vendas do Comercial por vendedor e UTM">
        <thead><tr>{['Vendedor', 'UTM Source', 'Vendas', 'Receita operacional', 'Recebido'].map(label => <th key={label} scope="col" className="text-left text-xs font-medium text-slate-500 py-3 pr-4">{label}</th>)}</tr></thead>
        <tbody>{report.groups.map(group => <tr key={group.key} className="border-t border-slate-100 dark:border-slate-800"><td className="py-4 pr-4 font-medium">{group.sellerName}</td><td className="py-4 pr-4 commercial-utm-cell">{group.utmSource || 'Não informada'}</td><td className="tabular-nums pr-4">{count(group.count)}</td>{['revenue', 'received'].map(key => <td key={key} className="tabular-nums pr-4">{amount(group[key])}{group[key].missing > 0 && <span className="block text-xs text-slate-500">{group[key].known ? 'Valor parcial' : 'Não informado'}</span>}</td>)}</tr>)}</tbody>
        {report.records.length > 0 && <tfoot><tr className="border-t border-slate-200 dark:border-slate-700 font-semibold"><th scope="row" colSpan={2} className="text-left py-4">Total do Comercial</th><td className="tabular-nums pr-4">{count(report.total.count)}</td><td className="tabular-nums pr-4">{amount(report.total.revenue)}</td><td className="tabular-nums pr-4">{amount(report.total.received)}</td></tr></tfoot>}
      </table>
    </div>
    {!report.records.length && <p className="text-sm text-slate-500 py-6 text-center">{!available ? 'Resultado indisponível. Atualize as fontes para consultar as vendas.' : partial ? 'Nenhuma venda comercial identificada nas fontes disponíveis. O resultado ainda é parcial.' : 'Nenhuma venda do Comercial neste período com os filtros selecionados.'}</p>}
    <p className="text-xs text-slate-500 mt-3">Inclui origens “comercial”, “Comercial-Nome” e UTMs vinculadas a vendedores. A atribuição manual tem prioridade. Origens sem vínculo ficam como “Sem vendedor vinculado”.</p>
    <p className="text-xs text-slate-500 mt-2">O Excel inclui o resumo e cada venda com as cinco UTMs. Recebimentos ficam separados da receita; estornos e saldos sem detalhamento não entram no resultado do Comercial.</p>
  </section>
}
