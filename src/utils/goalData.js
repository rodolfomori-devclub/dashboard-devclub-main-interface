import { amount } from './salesData.js'

/** Cash follows receipts, never the sale's installment schedule or net revenue.
 * Boletex's confirmedValue is lifetime cash of contracts CREATED in the range;
 * it cannot establish receipts in this month. Keep that distinction explicit.
 */
export function prepareGoalData(sales = {}, directory = {}, directoryAvailable = true) {
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const records = (sales.records || []).map(row => ({ ...row, teamId: people.get(row.sellerId)?.teamId || null }))
  const sources = sales.sources || []
  const cashRecords = []
  // A manual Asaas contract may describe the same cash already in the account
  // statement. Neither amount/date nor a contract ID proves receipt identity.
  const duplicateRisk = row => row.isManual && /\basaas\b/i.test(String(row.platform || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
  const excludedCashManuals = records.filter(duplicateRisk)
  const cashSources = sources.filter(source => source.kind === 'sale').map(source => {
    if (source.id === 'manual') {
      cashRecords.push(...records.filter(row => row.isManual && !duplicateRisk(row)).map(row => ({ ...row, cashDate: row.date })))
      return { ...source, rows: undefined, excludedReceipts: excludedCashManuals.length }
    }
    if (source.id === 'asaas' && Array.isArray(source.cashReceipts)) {
      cashRecords.push(...source.cashReceipts.map((receipt, index) => ({
        id: `cash:asaas:${index}`, kind: 'sale', sourceId: 'asaas', platform: 'Asaas',
        received: amount(receipt.received), date: receipt.date, cashDate: receipt.date,
        family: 'Não informado', quantity: 0, isReceipt: true,
      })))
      return { id: source.id, label: source.label, kind: 'sale', status: 'ready' }
    }
    return { id: source.id, label: source.label, kind: 'sale', status: 'unavailable', reason: 'receipt_ledger_unavailable' }
  })
  return { records, sources, cashRecords, cashSources, directoryAvailable, excludedCashManuals,
    cashUnavailableSources: cashSources.filter(source => source.status !== 'ready').map(source => source.label || source.id) }
}
