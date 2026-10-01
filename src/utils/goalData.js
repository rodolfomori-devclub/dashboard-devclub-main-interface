import { amount } from './salesData.js'
import { applyTmbCashRule, TMB_CASH_METADATA } from './tmbCash.js'
import { applyPlatformCashRule, PLATFORM_NET_CASH_METADATA } from './platformCash.js'

/** Cash follows the agreed platform rules: Guru/Hotmart = full net and
 * TMB = 40% of sold value, on the sale date. Asaas contributes only the
 * received entry of a new contract, also on its sale date. Its account
 * statement is a separate receivables view and never advances sales goals.
 * Boletex's confirmedValue is lifetime cash of contracts CREATED in the range;
 * it cannot establish receipts in this month. Keep that distinction explicit.
 */
export function prepareGoalData(sales = {}, directory = {}, directoryAvailable = true) {
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const records = (sales.records || []).map(row => ({ ...applyPlatformCashRule(applyTmbCashRule(row)), teamId: people.get(row.sellerId)?.teamId || null }))
  const sources = sales.sources || []
  const cashRecords = []
  // The shared sales ledger already removes reconciled manuals. Keep the
  // same guard here so a linked manual can never repeat its native contract.
  const activeManual = row => row.isManual && row.kind === 'sale' && !row.isReceipt
    && !row.linkedExternalId && !row.original?.linkedExternalId
  const excludedCashManuals = []
  const cashSources = sources.filter(source => source.kind === 'sale').map(source => {
    if (source.id === 'manual') {
      cashRecords.push(...records.filter(activeManual).map(row => ({ ...row, cashDate: row.cashDate ?? row.date })))
      return { ...source, rows: undefined, excludedReceipts: 0 }
    }
    if (source.id === 'tmb') {
      if (['ready', 'partial', 'stale'].includes(source.status)) cashRecords.push(...records.filter(row => row.sourceId === 'tmb' && row.kind === 'sale'))
      return { ...source, rows: undefined, ...TMB_CASH_METADATA, status: source.status === 'stale' ? 'partial' : source.status }
    }
    if (['guru', 'hotmart'].includes(source.id)) {
      if (['ready', 'partial', 'stale'].includes(source.status)) cashRecords.push(...records.filter(row => row.sourceId === source.id && row.kind === 'sale' && !row.isManual))
      return { ...source, rows: undefined, ...PLATFORM_NET_CASH_METADATA, status: source.status === 'stale' ? 'partial' : source.status }
    }
    if (source.id === 'asaas') {
      const contractsAvailable = source.salesAvailable !== false && ['ready', 'partial', 'stale'].includes(source.status)
      if (contractsAvailable) cashRecords.push(...records
        .filter(row => row.sourceId === 'asaas' && row.kind === 'sale' && !row.isManual && !row.isReceipt)
        .map(row => ({ ...row, received: amount(row.received), cashDate: row.date ?? null,
          cashBasis: 'sales_rule', cashRule: 'asaas_new_sale_entry', cashDateBasis: 'sale_date' })))
      return { id: source.id, label: source.label, kind: 'sale',
        status: contractsAvailable ? source.status === 'stale' ? 'partial' : source.status : 'unavailable',
        cashBasis: 'sales_rule', cashRule: 'asaas_new_sale_entry', cashDateBasis: 'sale_date',
        ...(!contractsAvailable ? { reason: 'new_sale_contracts_unavailable' } : {}),
      }
    }
    return { id: source.id, label: source.label, kind: 'sale', status: 'unavailable', reason: 'receipt_ledger_unavailable' }
  })
  return { records, sources, cashRecords, cashSources, directoryAvailable, excludedCashManuals,
    cashUnavailableSources: cashSources.filter(source => source.status !== 'ready').map(source => source.label || source.id) }
}
