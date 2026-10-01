/* eslint-disable react/prop-types -- Internal financial presentation. */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from 'lucide-react'
import { buildRefundSummary, refundPeriodLink } from '../../utils/refundSummary'
import './refundSummary.css'

const number = value => value === null ? '—' : value.toLocaleString('pt-BR')
const money = item => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.value)
function Amounts({ amount, ready = true }) {
  if (!ready) return '—'
  return amount.values.length ? amount.values.map(item => <span key={item.currency}>{money(item)}</span>) : 'Não informado'
}

export default function RefundSummary({ records = [], sources = [], platform = '', overview = false, ready = false, loading = false, startDate, endDate, showLink = true, title = 'Reembolsos' }) {
  const model = useMemo(() => buildRefundSummary(records, sources, { overview, platform }), [records, sources, overview, platform])
  return <section className="refund-summary" aria-label="Resumo de reembolsos" aria-busy={loading}>
    <div className="refund-summary-top">
      <div className="refund-summary-lead"><h2><ArrowDownLeft size={19} aria-hidden="true" />{title}</h2><p className="refund-summary-amount"><Amounts amount={model.purchase} ready={ready} /></p><p className="refund-summary-caption">Valor das compras com reembolso confirmado{model.purchase.unknown > 0 && ' · valores parciais'}</p></div>
      <dl className="refund-summary-metrics"><div><dt>Confirmados</dt><dd>{ready ? number(model.confirmed) : '—'}</dd><small>{model.partialRefunds ? `${number(model.partialRefunds)} parciais incluídos` : 'Status total ou parcial'}</small></div><div><dt>Contestações</dt><dd>{ready ? number(model.disputes) : '—'}</dd><small>Separadas dos reembolsos</small></div><div><dt>Cancelamentos</dt><dd>{ready ? number(model.cancelled) : '—'}</dd><small>Sem devolução comprovada</small></div></dl>
    </div>
    <details className="refund-summary-details"><summary><span>Detalhar reembolsos por plataforma</span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="refund-summary-providers">{model.providers.map(provider => <article className="refund-summary-provider" key={provider.id} data-provider={provider.id}><h3>{provider.label}<span>{!ready ? 'Aguardando' : provider.refundsAvailable ? provider.partial ? 'Parcial' : 'Disponível' : 'Não informado'}</span></h3><dl><div><dt>Reembolsos confirmados</dt><dd>{ready ? number(provider.confirmed) : '—'}</dd></div><div><dt>Valor das compras</dt><dd><Amounts amount={provider.purchase} ready={ready} /></dd></div><div><dt>Valor devolvido</dt><dd><Amounts amount={provider.refunded} ready={ready} /></dd></div><div><dt>Contestações / cancelamentos</dt><dd>{ready ? `${number(provider.disputes)} / ${number(provider.cancelled)}` : '—'}</dd></div></dl><p>{provider.id === 'guru' ? 'Período pela data de cancelamento. O valor da compra não é o valor devolvido.' : provider.id === 'hotmart' ? 'Compras do período com status de reembolso. Data e valor da devolução não informados.' : provider.id === 'tmb' ? 'A TMB informa cancelamentos na central de reembolsos; eles não comprovam devolução.' : 'Esta integração não fornece os reembolsos Asaas.'}{provider.unknown > 0 && ` ${number(provider.unknown)} registros sem status confirmado.`}{provider.purchase.unknown > 0 && ` ${number(provider.purchase.unknown)} compras sem valor ou moeda informados.`}</p></article>)}</div>
      <p className="refund-summary-note">O valor efetivamente devolvido só é exibido quando a fonte o informa. Compras com estorno parcial mantêm o valor original da compra. {model.unknown > 0 && `${number(model.unknown)} registros sem status confirmado ficaram fora dos totais.`}</p>
    </details>
    <footer className="refund-summary-footer"><span>{ready ? 'Valores separados da receita · somente fontes e registros disponíveis' : 'Aguardando os dados do período'}</span>{showLink && <Link to={refundPeriodLink(startDate, endDate)}>Abrir central de reembolsos<ArrowUpRight size={14} aria-hidden="true" /></Link>}</footer>
  </section>
}
