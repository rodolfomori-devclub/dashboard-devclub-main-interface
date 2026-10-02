/* eslint-disable react/prop-types -- Internal financial presentation. */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, ChevronDown } from 'lucide-react'
import { buildRefundSummary, refundPeriodLink } from '../../utils/refundSummary'
import FinancialValue from './FinancialValue'
import './refundSummary.css'

const number = value => value === null ? '—' : value.toLocaleString('pt-BR')
const money = item => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: item.currency }).format(item.value)
function Amounts({ amount, ready = true, loading = false, error = false, compact = false }) {
  return <FinancialValue ready={ready && (amount.values.length > 0 || !loading)} loading={loading} error={error} compact={compact}>{amount.values.length ? amount.values.map(item => <span key={item.currency}>{money(item)}</span>) : 'Não informado'}</FinancialValue>
}

export default function RefundSummary({ records = [], sources = [], platform = '', overview = false, ready = false, loading = false, error = false, startDate, endDate, showLink = true, title = 'Reembolsos' }) {
  const model = useMemo(() => buildRefundSummary(records, sources, { overview, platform }), [records, sources, overview, platform])
  return <section className="refund-summary" aria-label="Resumo de reembolsos" aria-busy={loading}>
    <div className="refund-summary-top">
      <div className="refund-summary-lead"><h2><ArrowDownLeft size={19} aria-hidden="true" />{title}</h2><p className="refund-summary-amount"><Amounts amount={model.purchase} ready={ready} loading={loading} error={error} /></p><p className="refund-summary-caption">Valor das vendas reembolsadas{model.purchase.unknown > 0 && ' · valores parciais'}</p></div>
      <dl className="refund-summary-metrics"><div><dt>Confirmados</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{number(model.confirmed)}</FinancialValue></dd><small>{model.partialRefunds ? `${number(model.partialRefunds)} parciais incluídos` : 'Status total ou parcial'}</small></div><div><dt>Contestações</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{number(model.disputes)}</FinancialValue></dd><small>Separadas dos reembolsos</small></div><div><dt>Cancelamentos</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{number(model.cancelled)}</FinancialValue></dd><small>Sem devolução comprovada</small></div></dl>
    </div>
    <details className="refund-summary-details"><summary><span>Detalhar reembolsos por plataforma</span><ChevronDown size={17} aria-hidden="true" /></summary>
      <div className="refund-summary-providers">{model.providers.map(provider => <article className="refund-summary-provider" key={provider.id} data-provider={provider.id}><h3>{provider.label}<span>{!ready ? loading ? 'Carregando' : 'Indisponível' : provider.refundsAvailable ? provider.partial ? 'Parcial' : 'Disponível' : 'Não informado'}</span></h3><dl><div><dt>Reembolsos confirmados</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{number(provider.confirmed)}</FinancialValue></dd></div><div><dt>Valor das vendas</dt><dd><Amounts amount={provider.purchase} ready={ready} loading={loading} error={error} compact /></dd></div><div><dt>Valor devolvido</dt><dd><Amounts amount={provider.refunded} ready={ready} loading={loading} error={error} compact /></dd></div><div><dt>Contestações / cancelamentos</dt><dd><FinancialValue ready={ready} loading={loading} error={error} compact>{`${number(provider.disputes)} / ${number(provider.cancelled)}`}</FinancialValue></dd></div></dl><p>{provider.id === 'guru' ? 'Período pela data de cancelamento. A venda usa o líquido após taxas; esse valor não é o total devolvido.' : provider.id === 'hotmart' ? 'Vendas do período com status de reembolso, pelo líquido após taxas. Data e valor da devolução não informados.' : provider.id === 'tmb' ? 'A TMB informa cancelamentos na central de reembolsos; eles não comprovam devolução.' : 'Esta integração não fornece os reembolsos Asaas.'}{provider.unknown > 0 && ` ${number(provider.unknown)} registros sem status confirmado.`}{provider.purchase.unknown > 0 && ` ${number(provider.purchase.unknown)} vendas sem valor ou moeda informados.`}</p></article>)}</div>
      <p className="refund-summary-note">Guru e Hotmart: líquido após taxas; demais: valor contratado. O valor efetivamente devolvido só é exibido quando a fonte o informa. Estornos parciais mantêm o valor da venda nessa mesma base. {model.unknown > 0 && `${number(model.unknown)} registros sem status confirmado ficaram fora dos totais.`}</p>
    </details>
    <footer className="refund-summary-footer"><span>{ready ? 'Valores separados da receita · somente fontes e registros disponíveis' : loading ? 'Carregando os dados do período' : 'Dados do período indisponíveis'}</span>{showLink && <Link to={refundPeriodLink(startDate, endDate)}>Abrir central de reembolsos<ArrowUpRight size={14} aria-hidden="true" /></Link>}</footer>
  </section>
}
