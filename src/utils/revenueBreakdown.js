import { amount, summarizeSales } from './salesData.js'
import { asaasCashView, sourceHasSales } from './sourceAvailability.js'
import { prepareGoalData } from './goalData.js'

const SOURCES = ['guru', 'hotmart', 'tmb', 'asaas', 'boletex', 'manual']
const LABELS = { guru: 'Guru', hotmart: 'Hotmart', tmb: 'TMB', asaas: 'Asaas', boletex: 'Boletex', manual: 'Vendas manuais' }
const fold = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[ _-]/g, '')
export function revenuePaymentGroup(payment) {
  const value = fold(payment)
  if (['cartao', 'cartaodecredito', 'cartaodedebito', 'creditcard', 'debitcard'].includes(value)) return 'card'
  if (['boleto', 'boletoparcelado', 'bankslip', 'billet', 'installmentbillet'].includes(value)) return 'boleto'
  if (['pix', 'instantpayment'].includes(value)) return 'pix'
  if (!value || value === 'naoinformado') return 'unknown'
  return 'other'
}
const numeric = (metric, available) => !available || (!metric.known && metric.missing) ? null : metric.value
const observedSource = (source, rows) => sourceHasSales(source) && (source.id !== 'manual' || rows.length > 0)
const sum = rows => rows.reduce((total, row) => total + (amount(row.received) ?? 0), 0)

function existingAsaasCash(sources, filters) {
  const aggregate = asaasCashView(sources, filters)
  const asaasSource = sources.find(item => item.id === 'asaas')
  const stale = asaasSource?.cacheStatus === 'stale' || asaasSource?.snapshots?.some(snapshot => ['stale', 'loading', 'unavailable'].includes(snapshot.status))
  const undated = asaasSource?.cashReceipts?.some(receipt => !receipt.date || amount(receipt.received) === null)
  if (aggregate) return { ...aggregate, partial: aggregate.partial || Boolean(stale || undated) }
  if (filters.platform && filters.platform !== 'Asaas') return null
  const source = sources.find(item => item.id === 'asaas' && Array.isArray(item.cashReceipts) && !['unavailable', 'not_requested'].includes(item.status))
  if (!source) return null
  const missing = source.cashReceipts.filter(row => amount(row.received) === null).length
  return { gross: missing === source.cashReceipts.length && missing > 0 ? null : sum(source.cashReceipts),
    allocationMissing: Object.entries(filters).some(([key, value]) => key !== 'platform' && Boolean(value)),
    partial: source.status !== 'ready' || missing > 0 || Boolean(stale || undated) }
}

// Records are already filtered. Provider availability is kept separate from a
// payment classification: a missing payment never becomes a card or a boleto.
export function buildRevenueBreakdown(records = [], sources = [], filters = {}) {
  const sales = records.filter(row => row.kind === 'sale')
  const saleSources = sources.filter(source => source.kind === 'sale' && (!filters.platform || source.platform === filters.platform || source.id === 'manual'))
  const available = saleSources.some(source => observedSource(source, sales.filter(row => row.sourceId === source.id))) || sales.some(row => amount(row.revenue) !== null)
  const summary = summarizeSales(sales)
  const partial = saleSources.some(source => source.status !== 'ready' || source.salesAvailable === false) || summary.revenue.missing > 0
  const paymentGroups = {}
  for (const key of ['card', 'boleto', 'pix', 'other', 'unknown']) {
    const rows = sales.filter(row => revenuePaymentGroup(row.payment) === key)
    const sourceIds = [...new Set([...SOURCES.filter(id => saleSources.some(source => source.id === id)), ...rows.map(row => row.sourceId)])]
    const providers = sourceIds.map(id => {
      const source = saleSources.find(source => source.id === id)
      const providerRows = sales.filter(row => row.sourceId === id)
      const selected = rows.filter(row => row.sourceId === id)
      const result = summarizeSales(selected)
      const unknownPayment = providerRows.some(row => revenuePaymentGroup(row.payment) === 'unknown')
      const knownEmpty = source && observedSource(source, providerRows) && !unknownPayment
      const value = numeric(result.revenue, selected.length > 0 || knownEmpty)
      return { id, label: source?.label || LABELS[id] || id, value, count: selected.length || knownEmpty ? result.count : null,
        partial: source?.status !== 'ready' || source?.salesAvailable === false || unknownPayment || result.revenue.missing > 0 }
    })
    const result = summarizeSales(rows)
    paymentGroups[key] = { key, value: numeric(result.revenue, providers.some(provider => provider.value !== null)),
      count: rows.length || providers.some(provider => provider.value !== null) ? result.count : null,
      partial: providers.some(provider => provider.partial), providers }
  }

  const prepared = prepareGoalData({ records: sales, sources: saleSources })
  const tmbSource = saleSources.find(source => source.id === 'tmb')
  const tmbRows = prepared.cashRecords.filter(row => fold(row.platform) === 'tmb')
  const tmbKnown = tmbRows.some(row => amount(row.received) !== null) || (tmbRows.length === 0 && tmbSource && sourceHasSales(tmbSource))
  const asaas = existingAsaasCash(saleSources, filters)
  const asaasKnown = asaas && !asaas.allocationMissing && amount(asaas.gross) !== null
  const manuals = prepared.cashRecords.filter(row => row.isManual && fold(row.platform) !== 'tmb')
  const manualKnown = manuals.some(row => amount(row.received) !== null)
  const platformCash = ['guru', 'hotmart'].map(id => {
    const rows = prepared.cashRecords.filter(row => row.sourceId === id && !row.isManual)
    const source = prepared.cashSources.find(source => source.id === id)
    const known = rows.some(row => amount(row.received) !== null) || (rows.length === 0 && source && sourceHasSales(source))
    return { id, label: `${LABELS[id]} · líquido integral`, value: known ? sum(rows) : null }
  })
  const cashProviders = [
    ...platformCash,
    { id: 'tmb', label: 'TMB · 40% das vendas', value: tmbKnown ? sum(tmbRows) : null },
    { id: 'asaas', label: 'Asaas · recebimentos', value: asaasKnown ? asaas.gross : null },
    ...(manuals.length ? [{ id: 'manual', label: 'Caixa manual declarado', value: manualKnown ? sum(manuals) : null }] : []),
  ]
  const cashKnown = cashProviders.some(provider => provider.value !== null)
  const cashPartial = prepared.cashSources.some(source => source.status !== 'ready') || Boolean(asaas?.allocationMissing || asaas?.partial)
    || prepared.cashRecords.some(row => amount(row.received) === null || !row.cashDate)
    || prepared.excludedCashManuals.length > 0
  return { revenue: { value: numeric(summary.revenue, available), count: available ? summary.count : null, partial,
    ticket: available && summary.count > 0 && summary.revenue.known ? summary.revenue.value / summary.count : null },
  payments: paymentGroups, cash: { value: cashKnown ? cashProviders.reduce((total, provider) => total + (provider.value ?? 0), 0) : null, partial: cashPartial, providers: cashProviders } }
}

export function buildRevenueNotices(sources = [], filters = {}, { partial = false, cache, records = [] } = {}) {
  const relevant = sources.filter(source => !filters.platform || source.platform === filters.platform || source.id === 'manual')
  const notices = []
  if (relevant.some(source => source.reason === 'checkout_disabled')) notices.push({ id: 'asaas-contracts', title: 'Asaas: cobertura das vendas', tone: 'info', message: 'Asaas: recebimentos disponíveis, mas vendas e valores contratados não informados. As demais fontes mantêm seus próprios indicadores.' })
  if (partial || relevant.some(source => !['ready', 'not_requested'].includes(source.status))) notices.push({ id: 'partial-sales', title: 'Visão parcial', tone: 'warning', message: 'Os valores representam as fontes recebidas; dados indisponíveis não equivalem a zero.' })
  const failed = relevant.filter(source => source.status === 'unavailable')
  if (failed.length) notices.push({ id: 'unavailable-sources', title: 'Fontes indisponíveis', tone: 'warning', message: `${failed.map(source => source.label).join(', ')}. Os últimos dados válidos, quando disponíveis, foram preservados.` })
  if (relevant.some(source => source.id === 'asaas' && source.status === 'not_requested')) notices.push({ id: 'asaas-on-demand', title: 'Asaas no Anual', tone: 'info', message: 'O caixa Asaas pode ser consultado separadamente na área de recebimentos. Ele ainda não está incluído no cash collected deste resumo.' })
  const asaas = existingAsaasCash(relevant, filters)
  if (asaas?.allocationMissing) notices.push({ id: 'asaas-allocation', title: 'Asaas sem atribuição neste recorte', tone: 'info', message: 'O extrato não informa produto, família, pagamento, oferta ou UTM. O caixa Asaas não foi distribuído entre esses filtros.' })
  if (asaas?.partial) notices.push({ id: 'asaas-partial-cash', title: 'Caixa Asaas parcial', tone: 'warning', message: 'Há recebimentos sem data ou consultas incompletas/em atualização. O subtotal conhecido foi preservado.' })
  if (prepareGoalData({ records, sources: relevant }).excludedCashManuals.length) notices.push({ id: 'asaas-manual-cash', title: 'Lançamentos manuais Asaas', tone: 'info', message: 'O caixa manual Asaas não foi somado ao extrato sem um vínculo de recebimento, para evitar contagem duplicada.' })
  if (relevant.some(source => source.id === 'tmb')) notices.push({ id: 'tmb-cash-rule', title: 'Regra de cash collected da TMB', tone: 'info', message: 'O cash collected da TMB considera 40% do valor bruto de cada venda, na data da venda. O bruto e a receita contratada permanecem integrais. Asaas mantém os recebimentos do extrato.' })
  if (relevant.some(source => ['guru', 'hotmart'].includes(source.id))) notices.push({ id: 'platform-net-cash', title: 'Cash collected Guru e Hotmart', tone: 'info', message: 'Guru e Hotmart entram com 100% do líquido de cada venda, na data da venda. As taxas e comissões já consideradas pela fonte não são descontadas novamente. O indicador não representa a data de saque ou de repasse bancário.' })
  const foreign = records.filter(row => row.excludedCurrencies?.length)
  if (foreign.length) notices.push({ id: 'foreign-currency', title: 'Vendas em outras moedas', tone: 'warning', message: `${foreign.length} registros têm valores em ${[...new Set(foreign.flatMap(row => row.excludedCurrencies))].join(', ')}. Somente os campos informados em BRL entram nos totais em reais; valores em outras moedas ficam fora, sem conversão estimada.` })
  if (relevant.some(source => source.id === 'boletex')) notices.push({ id: 'cash-coverage', title: 'Cobertura do cash collected', tone: 'info', message: 'Recebimentos acumulados de contratos Boletex não identificam o caixa deste período e não são somados ao cash collected. Lançamentos manuais não conciliados usam o caixa declarado.' })
  if (cache?.staleSources) notices.push({ id: 'stale-cache', title: 'Histórico em atualização', tone: 'info', message: 'Algumas fontes usam a última versão disponível. Consulte os horários de coleta; os valores serão atualizados quando a nova consulta terminar.' })
  if (cache?.pollTimedOut) notices.push({ id: 'cache-in-progress', title: 'A atualização continua no servidor', tone: 'info', message: 'O acompanhamento automático deste carregamento terminou. Os dados recebidos foram mantidos. Use Atualizar para acompanhar novamente.' })
  return notices
}
