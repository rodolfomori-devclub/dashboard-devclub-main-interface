/* eslint-disable react/prop-types -- Internal, shared financial presentation. */
import { useMemo } from 'react'
import { ArrowUpRight, Banknote, ChevronDown, CreditCard, ReceiptText, Wallet } from 'lucide-react'
import { buildRevenueBreakdown } from '../../utils/revenueBreakdown'
import { formatCurrency } from '../../utils/currencyUtils'
import FinancialValue from './FinancialValue'
import './revenueHighlights.css'

const money = value => value === null || value === undefined ? 'Não informado' : formatCurrency(value)
const number = value => value === null || value === undefined ? '—' : value.toLocaleString('pt-BR')
const salesCount = value => `${number(value)} ${value === 1 ? 'venda' : 'vendas'}`
function Coverage({ partial }) { return partial ? <span className="revenue-coverage">Parcial</span> : null }

function PaymentCard({ title, detail, data, tone, icon: Icon, ready, loading, error }) {
  const amountReady = ready && (data.value !== null || !loading)
  return <article className={`revenue-card revenue-card--${tone}`} aria-busy={loading}>
    <div className="revenue-card-heading"><h2><Icon size={19} aria-hidden="true" />{title}</h2><Coverage partial={ready && data.partial} /></div>
    <p className="revenue-payment-basis">Receita operacional</p>
    <p className="revenue-card-value"><FinancialValue ready={amountReady} loading={loading} error={error}>{money(data.value)}</FinancialValue></p>
    <p className="revenue-card-subtitle">{!ready ? 'Aguardando os dados do período' : data.count === null ? 'Contagem não informada' : `${salesCount(data.count)} ${data.count === 1 ? 'identificada' : 'identificadas'}`}<span>{detail}</span></p>
    <details className="revenue-breakdown">
      <summary><span>Detalhar {title.toLocaleLowerCase('pt-BR')} por plataforma</span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="revenue-provider-list" aria-label={`Receita operacional de ${title.toLocaleLowerCase('pt-BR')} por plataforma`}>
        {data.providers.map(provider => tone === 'boleto'
          ? <div className="revenue-provider-row revenue-provider-row--financial" key={provider.id} data-provider={provider.id}>
            <header><span>{provider.label}</span><small>{salesCount(provider.count)}{provider.partial && ' · parcial'}</small></header>
            <dl className="revenue-provider-financials">{[['gross', 'Valor bruto'], ['cash', 'Cash collected'], ['entry', 'Entrada recebida']].map(([key, label]) => <div key={key}>
              <dt>{label}</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{money(provider[key].value)}</FinancialValue>{provider[key].partial && provider[key].value !== null && <small>Parcial</small>}</dd>
            </div>)}</dl>
            <p className="revenue-provider-note">{provider.id === 'tmb' ? 'Cash collected: 40% do bruto. ' : ['guru', 'hotmart'].includes(provider.id) ? 'Cash collected: líquido integral. ' : ''}{provider.note}</p>
          </div>
          : <div className="revenue-provider-row" key={provider.id} data-provider={provider.id}><div><span>{provider.label}</span><small>{salesCount(provider.count)}{provider.partial && ' · parcial'}</small></div><strong><FinancialValue ready={ready} loading={loading} error={error} compact>{money(provider.value)}</FinancialValue></strong></div>)}
        {!data.providers.length && <p className="revenue-provider-empty">{loading ? 'Carregando as plataformas deste período…' : !ready || data.value === null ? 'Detalhamento indisponível neste recorte.' : `Nenhuma venda por ${title.toLocaleLowerCase('pt-BR')} neste recorte.`}</p>}
      </div>
    </details>
  </article>
}

export default function RevenueHighlights({ records = [], sources = [], filters = {}, loading = false, ready = false, error = false }) {
  const model = useMemo(() => buildRevenueBreakdown(records, sources, filters), [records, sources, filters])
  return <section className="revenue-highlights" aria-label="Resumo financeiro" aria-busy={loading}>
    <div className="revenue-lead-grid">
      <article className="revenue-card revenue-card--total" data-testid="revenue-gross-main">
        <div className="revenue-card-heading"><h2><ArrowUpRight size={22} aria-hidden="true" />Valor bruto das vendas</h2><Coverage partial={ready && model.gross.partial} /></div>
        <p className="revenue-card-value" data-testid="revenue-gross-value"><FinancialValue ready={ready && (model.gross.value !== null || !loading)} loading={loading} error={error} announce>{money(model.gross.value)}</FinancialValue></p>
        <p className="revenue-card-subtitle">{ready ? 'Novas vendas, antes das taxas das plataformas' : 'Aguardando os dados do período'}</p>
        <dl className="revenue-total-details"><div><dt>Vendas realizadas</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{number(model.gross.count)}</FinancialValue></dd></div><div><dt>Ticket médio bruto</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{money(model.gross.ticket)}</FinancialValue></dd></div></dl>
        <div className="revenue-operational-summary" data-testid="revenue-operational-secondary">
          <div className="revenue-operational-heading"><span>Receita operacional</span><Coverage partial={ready && model.revenue.partial} /><strong data-testid="revenue-operational-value"><FinancialValue ready={ready && (model.revenue.value !== null || !loading)} loading={loading} error={error} compact>{money(model.revenue.value)}</FinancialValue></strong></div>
          <p>Líquido de Guru e Hotmart; valores contratados ou informados nas demais fontes.</p>
        </div>
      </article>
      <article className="revenue-card revenue-card--cash">
        <div className="revenue-card-heading"><h2><Wallet size={21} aria-hidden="true" />Cash collected</h2><Coverage partial={ready && model.cash.partial} /></div>
        <p className="revenue-card-value"><FinancialValue ready={ready && (model.cash.value !== null || !loading)} loading={loading} error={error}>{money(model.cash.value)}</FinancialValue></p>
        <p className="revenue-card-subtitle">Somente novas vendas · Guru e Hotmart: líquido integral · TMB: 40% · Asaas: entradas de novas vendas</p>
        <dl className="revenue-cash-details">{model.cash.providers.map(provider => <div key={provider.id}><dt>{provider.label}</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{money(provider.value)}</FinancialValue></dd></div>)}</dl>
      </article>
    </div>
    <div className="revenue-payment-grid">
      <PaymentCard title="Cartão" detail="Somente plataformas com vendas por cartão neste recorte" data={model.payments.card} tone="card" icon={CreditCard} ready={ready} loading={loading} error={error} />
      <PaymentCard title="Boleto" detail="Boleto à vista e parcelado · plataformas deste recorte" data={model.payments.boleto} tone="boleto" icon={ReceiptText} ready={ready} loading={loading} error={error} />
    </div>
    <div className="revenue-other-payments" aria-label="Outros meios de pagamento"><Banknote size={17} aria-hidden="true" /><p>Também compõem a receita operacional</p>{[['pix', 'Pix'], ['other', 'Outros meios'], ['unknown', 'Meio não informado']].map(([key, label]) => <div key={key}><span>{label}</span><strong><FinancialValue ready={ready} loading={loading} error={error} compact>{money(model.payments[key].value)}</FinancialValue></strong></div>)}</div>
  </section>
}
