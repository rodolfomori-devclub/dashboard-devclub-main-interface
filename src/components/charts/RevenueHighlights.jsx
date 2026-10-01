/* eslint-disable react/prop-types -- Internal, shared financial presentation. */
import { useMemo } from 'react'
import { ArrowUpRight, Banknote, ChevronDown, CreditCard, ReceiptText, Wallet } from 'lucide-react'
import { buildRevenueBreakdown } from '../../utils/revenueBreakdown'
import { formatCurrency } from '../../utils/currencyUtils'
import './revenueHighlights.css'

const money = value => value === null || value === undefined ? 'Não informado' : formatCurrency(value)
const number = value => value === null || value === undefined ? '—' : value.toLocaleString('pt-BR')
function Coverage({ partial }) { return partial ? <span className="revenue-coverage">Parcial</span> : null }

function PaymentCard({ title, detail, data, tone, icon: Icon }) {
  return <article className={`revenue-card revenue-card--${tone}`}>
    <div className="revenue-card-heading"><h2><Icon size={19} aria-hidden="true" />{title}</h2><Coverage partial={data.partial} /></div>
    <p className="revenue-card-value">{money(data.value)}</p>
    <p className="revenue-card-subtitle">{data.count === null ? 'Contagem não informada' : `${number(data.count)} vendas identificadas`}<span>{detail}</span></p>
    <details className="revenue-breakdown">
      <summary><span>Detalhar {title.toLocaleLowerCase('pt-BR')} por plataforma</span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="revenue-provider-list" aria-label={`Receita de ${title.toLocaleLowerCase('pt-BR')} por plataforma`}>
        {data.providers.map(provider => <div className="revenue-provider-row" key={provider.id}><div><span>{provider.label}</span><small>{provider.count === null ? 'Vendas não informadas' : `${number(provider.count)} vendas`}{provider.partial && ' · parcial'}</small></div><strong>{money(provider.value)}</strong></div>)}
        {!data.providers.length && <p className="revenue-provider-empty">Aguardando as fontes deste período.</p>}
      </div>
    </details>
  </article>
}

export default function RevenueHighlights({ records = [], sources = [], filters = {}, title = 'Receita operacional', loading = false, ready = false }) {
  const model = useMemo(() => buildRevenueBreakdown(records, sources, filters), [records, sources, filters])
  return <section className="revenue-highlights" aria-label="Resumo financeiro" aria-busy={loading}>
    <div className="revenue-lead-grid">
      <article className="revenue-card revenue-card--total">
        <div className="revenue-card-heading"><h2><ArrowUpRight size={22} aria-hidden="true" />{title}</h2><Coverage partial={ready && model.revenue.partial} /></div>
        <p className="revenue-card-value">{ready ? money(model.revenue.value) : '—'}</p>
        <p className="revenue-card-subtitle">{ready ? 'Receita das vendas no recorte selecionado' : 'Aguardando os dados do período'}</p>
        <dl className="revenue-total-details"><div><dt>Vendas realizadas</dt><dd>{ready ? number(model.revenue.count) : '—'}</dd></div><div><dt>Ticket médio</dt><dd>{ready && model.revenue.ticket !== null ? money(model.revenue.ticket) : '—'}</dd></div></dl>
      </article>
      <article className="revenue-card revenue-card--cash">
        <div className="revenue-card-heading"><h2><Wallet size={21} aria-hidden="true" />Cash collected</h2><Coverage partial={ready && model.cash.partial} /></div>
        <p className="revenue-card-value">{ready ? money(model.cash.value) : '—'}</p>
        <p className="revenue-card-subtitle">TMB: 40% do bruto · Asaas: recebimentos</p>
        <dl className="revenue-cash-details">{model.cash.providers.map(provider => <div key={provider.id}><dt>{provider.label}</dt><dd>{ready ? money(provider.value) : '—'}</dd></div>)}</dl>
      </article>
    </div>
    <div className="revenue-payment-grid">
      <PaymentCard title="Cartão" detail="Guru, Hotmart e demais fontes com cartão informado" data={model.payments.card} tone="card" icon={CreditCard} />
      <PaymentCard title="Boleto" detail="Boleto à vista e parcelado, em todas as plataformas" data={model.payments.boleto} tone="boleto" icon={ReceiptText} />
    </div>
    <div className="revenue-other-payments" aria-label="Outros meios de pagamento"><Banknote size={17} aria-hidden="true" /><p>Também compõem a receita</p>{[['pix', 'Pix'], ['other', 'Outros meios'], ['unknown', 'Meio não informado']].map(([key, label]) => <div key={key}><span>{label}</span><strong>{money(model.payments[key].value)}</strong></div>)}</div>
  </section>
}
