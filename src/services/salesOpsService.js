import { applyTmbCashRule } from '../utils/tmbCash.js';

const request = async (path, options) => {
  const { requestApi } = await import('../lib/api');
  const response = await requestApi(`/sales-ops${path}`, options);
  return response.data;
};
const write = (method, path, data) => request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

export const getSalesLedger = (from, to, { privateNotes = false } = {}) => request(`/ledger?${new URLSearchParams({ from, to, ...(privateNotes ? { private: '1' } : {}) })}`);
export const getSalesSellers = () => request('/sellers');
export const saveSaleAttribution = (data) => write('PUT', '/attributions', data);
export const createManualSale = (data) => write('POST', '/manual-sales', data);
export const reconcileManualSale = (id, data) => write('POST', `/manual-sales/${encodeURIComponent(id)}/reconcile`, data);
export const retrySalesSync = (type, id) => write('POST', `/sync/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, {});
export const getSalesAudit = (type, id) => request(`/audit/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
const key = (source, id) => JSON.stringify([source, String(id)]);

export function manualSaleRecord(sale) {
  return applyTmbCashRule({
    id: `manual:${sale.id}`, manualId: sale.id, source: 'manual', sourceId: 'manual', externalId: sale.id,
    kind: 'sale', quantity: 1, isManual: true, canAttribute: false, platform: sale.platform,
    buyerName: sale.buyerName, buyerEmail: sale.buyerEmail, date: `${sale.date}T12:00:00-03:00`,
    product: sale.product, family: sale.family, payment: 'Não informado',
    gross: sale.gross, net: sale.net, revenue: sale.net, received: sale.cashCollected,
    fees: null, affiliate: null, listPrice: null, pending: null,
    utm: sale.utm || {}, sellerId: sale.sellerId, sellerName: sale.sellerName,
    status: sale.status, note: sale.note, syncPending: sale.syncPending, original: sale,
  });
}

// Safe to apply twice (e.g. after refreshing only the ledger). Reconciled
// manuals remain auditable but never duplicate the platform's transaction.
export function mergeSalesOperations(records, ledger = {}) {
  const assignments = new Map((ledger.attributions || []).map((row) => [key(row.source, row.externalId), row]));
  const sourceRecords = records.filter((row) => !row.isManual && row.source !== 'manual').map((row) => {
    const assigned = row.kind === 'sale' && row.externalId ? assignments.get(key(row.source || row.sourceId, row.externalId)) : null;
    return assigned ? {
      ...row, attributionId: assigned.id, sellerId: assigned.sellerId, sellerName: assigned.sellerName,
      status: assigned.status, note: assigned.note, syncPending: assigned.syncPending,
    } : row;
  });
  const manuals = (ledger.manualSales || []).filter((sale) => !sale.linkedExternalId).map(manualSaleRecord);
  return [...sourceRecords, ...manuals];
}

export function saleSnapshot(row) {
  const money = (value) => value == null ? null : Math.round(Number(value) * 100) / 100;
  const date = new Date(row.date);
  if (Number.isNaN(date.getTime())) throw new Error('A fonte não informou uma data válida para esta transação.');
  return {
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date),
    product: row.product || 'Produto não informado', family: row.family || 'Outros',
    buyerName: row.buyerName || 'Não informado', buyerEmail: row.buyerEmail || null,
    gross: money(row.gross), net: money(row.net), cashCollected: money(row.received), platform: row.platform, utm: row.utm || {},
  };
}
