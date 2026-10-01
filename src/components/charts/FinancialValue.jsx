/* eslint-disable react/prop-types -- Shared financial presentation primitive. */
import './financialValue.css'

/** `ready` means this period has a response, including a known zero or an unknown amount. */
export default function FinancialValue({ children, ready = false, loading = false, error = false, compact = false, announce = false }) {
  const state = loading ? ready ? 'refreshing' : 'loading' : error ? 'error' : ready ? 'ready' : 'unavailable'
  const status = loading ? ready ? 'Atualizando…' : 'Carregando valor…' : error ? ready ? 'Não foi possível atualizar' : 'Não foi possível carregar' : null

  return <span className={`financial-value${compact ? ' financial-value--compact' : ''}`} data-state={state}>
    {!ready && loading
      ? <span className="financial-value-skeleton" aria-hidden="true" />
      : <span className={`financial-value-content${!ready ? ' financial-value-content--unavailable' : ''}`}>{ready ? children ?? 'Não informado' : 'Indisponível'}</span>}
    {status && <span className={`financial-value-status${error && !loading ? ' financial-value-status--error' : ''}`} role={announce ? 'status' : undefined}>
      {loading && <span className="financial-value-spinner" aria-hidden="true" />}{status}
    </span>}
  </span>
}
