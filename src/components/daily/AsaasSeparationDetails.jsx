/* eslint-disable react/prop-types -- Shared normalized Asaas financial model. */
import { FileCheck2, Wallet } from 'lucide-react'
import { formatCurrency } from '../../utils/currencyUtils'
import FinancialValue from '../charts/FinancialValue'
import './asaasSeparation.css'

const money = value => value === null || value === undefined ? 'Não informado' : formatCurrency(value)
const count = value => value === null || value === undefined ? 'Não informado' : value.toLocaleString('pt-BR')

export default function AsaasSeparationDetails({ model, loading = false, ready = true, error = false, annual = false, monthlyHighlight = false }) {
  const { sales, cash, receipts } = model
  const cashVisible = cash && !cash.allocationMissing
  const cashKnown = cashVisible && cash.gross !== null && cash.count !== null
  const previous = receipts.previousPeriods
  const previousKnown = cashKnown && (receipts.status === 'ready' && !cash.partial || previous?.count > 0 || previous?.received > 0)
  const previousPartial = Boolean(cash?.partial || receipts.status !== 'ready')
  const value = (number, currency = true) => <FinancialValue ready={ready && (number !== null && number !== undefined || !loading)} loading={loading} error={error} compact>{currency ? money(number) : count(number)}</FinancialValue>
  return <>
    {monthlyHighlight && <section className="asaas-monthly-invoices" aria-label="Recebimentos de faturas Asaas de meses anteriores" data-testid="monthly-asaas-invoices">
      <header><div><h3>Recebimentos de faturas Asaas</h3><p>Faturas pagas no mês selecionado de contratos vendidos em meses anteriores.</p></div><span>{!ready && loading ? 'Carregando…' : cash?.allocationMissing ? 'Sem distribuição' : !cashKnown ? 'Indisponível' : !previousKnown ? 'Origem não confirmada' : previousPartial ? 'Subtotal parcial' : 'Vínculos confirmados'}</span></header>
      <div className="asaas-monthly-invoice-main"><div><span>Vendas de meses anteriores · antes das taxas</span><p data-metric="monthly-previous-receipts">{value(previousKnown ? previous.received : null)}</p></div><div><span>Recebimentos de vendas anteriores</span><p data-metric="monthly-previous-count">{value(previousKnown ? previous.count : null, false)}</p></div></div>
      <dl className="asaas-monthly-invoice-context">{[
        ['Total bruto recebido no mês · antes das taxas', 'receipts-gross', cash?.gross, true],
        ['Movimentações recebidas no mês', 'receipts-count', cash?.count, false],
        ['Origem não identificada', 'unclassified-receipts', receipts.unclassified?.received, true],
        ['Movimentações sem origem confirmada', 'unclassified-count', receipts.unclassified?.count, false],
      ].map(([label, key, number, currency]) => <div key={key}><dt>{label}</dt><dd data-metric={`monthly-${key}`}>{value(cashVisible ? number : null, currency)}</dd></div>)}</dl>
      <p className="asaas-monthly-invoice-note">{cash?.allocationMissing ? 'Recebimentos sem distribuição para estes filtros. Nenhum valor foi atribuído a produto, pagamento, oferta ou campanha.' : !cashKnown ? 'Extrato de faturas indisponível; os valores não foram substituídos por zero.' : !previousKnown ? 'Não foi possível confirmar quais recebimentos vêm de vendas de meses anteriores. A origem não identificada permanece separada.' : previousPartial ? 'Subtotal apenas dos vínculos confirmados; o total de meses anteriores pode ser maior. Os demais recebimentos permanecem separados pela origem.' : 'Os vínculos confirmados distinguem vendas do mês de vendas de meses anteriores.'} Este indicador é separado da receita operacional, do cash collected principal e das metas de novas vendas.</p>
    </section>}
    <div className="asaas-separation-grid">
      <article className="asaas-sales-block" aria-label="Vendas novas Asaas">
        <h3><FileCheck2 size={18} aria-hidden="true" />Vendas novas Asaas{sales.partial && ready && <small>Parcial</small>}</h3>
        <p className="asaas-block-caption">Valor contratado das vendas confirmadas criados neste período.</p>
        <p className="asaas-block-value" data-metric="sales-gross">{value(sales.gross)}</p>
        <dl className="asaas-sales-details"><div><dt>Vendas confirmadas</dt><dd data-metric="sales-count">{value(sales.count, false)}</dd></div><div><dt>Entradas desses contratos</dt><dd data-metric="sales-entry">{value(sales.entry)}</dd></div></dl>
        <p className="asaas-block-note">{sales.available ? 'O pagamento de outra parcela não cria uma nova venda.' : annual ? 'Contratos Asaas não consultados nesta visão. Receber uma fatura não confirma uma nova venda.' : 'Contratos não informados pela integração. Os recebimentos não são usados para estimar vendas.'}</p>
      </article>
      <article className="asaas-receipts-block" aria-label="Recebimentos de faturas Asaas">
        <h3><Wallet size={18} aria-hidden="true" />Recebimentos de faturas{cash?.partial && ready && <small>Parcial</small>}</h3>
        <p className="asaas-block-caption">Extrato de faturas recebidas. Separado do cash collected de novas vendas e das metas.</p>
        <p className="asaas-block-value" data-metric="receipts-gross">{value(cashVisible ? cash.gross : null)}</p>
        <dl className="asaas-receipt-origins">{[
          ['currentPeriod', 'Vendas do período', 'Recebimentos vinculados a contratos deste período.'],
          ['previousPeriods', 'Vendas anteriores', 'Recebimentos vinculados a contratos anteriores.'],
          ['unclassified', 'Origem não identificada', 'Sem vínculo confirmado com a data da venda.'],
        ].map(([key, label, description]) => <div key={key} className={`asaas-origin--${key}`}>
          <dt><span>{label}</span><small>{description}</small></dt><dd data-metric={`receipts-${key}`}>{value(cashVisible && !(monthlyHighlight && key === 'previousPeriods' && !previousKnown) ? receipts[key]?.received : null)}</dd>
        </div>)}</dl>
        <p className="asaas-block-note">{cash?.allocationMissing ? 'Caixa sem distribuição para estes filtros. Não há vínculo para atribuir estes recebimentos ao produto, meio de pagamento ou campanha.' : receipts.status !== 'ready' && cashVisible ? 'Classificação incompleta: os valores por período incluem apenas vínculos confirmados. O restante permanece com origem não identificada.' : 'Os três grupos compõem os recebimentos acima. Este extrato não é somado ao cash collected principal nem às metas de novas vendas.'}</p>
      </article>
    </div>
    <dl className="asaas-cash-totals">{[['Recebimentos líquidos', 'net', true], ['Taxas de recebimento', 'fees', true], ['Movimentações recebidas', 'count', false]].map(([label, key, currency]) => <div key={key}><dt>{label}</dt><dd data-metric={`receipts-${key}`}>{value(cashVisible ? cash[key] : null, currency)}</dd></div>)}</dl>
    <details className="asaas-cash-details"><summary>Critérios de vendas e recebimentos</summary>
      <p>Vendas novas e recebimentos são indicadores diferentes e não são somados entre si. O cash collected principal usa somente a entrada dos novos contratos; este extrato permanece separado e não é somado novamente. O líquido desconta taxas de pagamento e notificação; não representa o saldo da conta.</p>
      <p>A origem de cada recebimento usa a data de criação do checkout confirmado ou a data de criação do parcelamento original no Asaas, quando a fatura tem vínculo validado com esse parcelamento. A data de emissão ou vencimento da fatura não é tratada como data da venda, assim como a criação da cobrança atual. Sem esse vínculo, o recebimento fica com origem não identificada.</p>
    </details>
  </>
}
