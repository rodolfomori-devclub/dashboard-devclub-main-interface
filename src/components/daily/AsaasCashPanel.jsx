/* eslint-disable react/prop-types -- Internal normalized financial metadata. */
import { buildAsaasSeparation } from '../../utils/asaasSeparation'
import AsaasSeparationDetails from './AsaasSeparationDetails'

export default function AsaasCashPanel({ sources = [], records = [], filters = {}, startDate, endDate, loading = false, ready = true, error = false }) {
  const pending = !ready && loading && !sources.length
  const model = buildAsaasSeparation({ sources: pending ? [{ id: 'asaas', kind: 'sale', status: 'loading', salesAvailable: false }] : sources, records, filters, startDate, endDate })
  if (!model) return null
  return <section className="surface-panel ds-card asaas-separation" aria-label="Caixa Asaas do período" aria-busy={loading}>
    <header className="asaas-separation-heading"><h2>Asaas: vendas e recebimentos</h2><p>A venda é registrada pelo contrato. Cada fatura paga entra no caixa na data do recebimento.</p></header>
    <AsaasSeparationDetails model={model} loading={loading} ready={ready} error={error} />
  </section>
}
