import { isNetSalesPlatform } from '../../utils/platformCash.js';

const money = (value: unknown): number | null => (typeof value === 'number' || typeof value === 'string')
  && String(value).trim() !== '' && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

export const isHubNetSale = (sale: any): boolean => sale?.dashboard_financial_policy === 'net_after_fees'
  || isNetSalesPlatform(sale?.platform);

/** Only the API's authorized ledger lookup can establish platform net for Hub rows. */
export function hubNetSaleValue(sale: any): number | null {
  return sale?.dashboard_financial_policy === 'net_after_fees' && sale?.dashboard_net_known === true
    ? money(sale.dashboard_gross) : null;
}

/** Prevent legacy Hub reports from falling back to platform gross or installment totals. */
export function normalizeHubSaleValue(sale: any): any {
  if (!isHubNetSale(sale)) return sale;
  const value = hubNetSaleValue(sale);
  return { ...sale, dashboard_financial_policy: 'net_after_fees', dashboard_net_known: value !== null,
    dashboard_cash_known: value !== null, dashboard_gross: value, dashboard_value: value,
    total_sale_value: value, amount: value, cash_collected: value, real_collected_this_month: value,
    pending_future_value: 0, future_outstanding_value: 0 };
}

export interface HubFinancialSummary {
  subtotal: number;
  value: number | null;
  knownCount: number;
  unknownNetCount: number;
  partial: boolean;
}

/** Keep each report's existing rule for other platforms; platform net is never inferred. */
export function summarizeHubSaleValues(
  sales: any[],
  otherPlatformValue: (sale: any) => number = sale => Number(sale.amount) || 0,
): HubFinancialSummary {
  let subtotal = 0, knownCount = 0, unknownNetCount = 0;
  for (const sale of sales) {
    const value = isHubNetSale(sale) ? hubNetSaleValue(sale) : otherPlatformValue(sale);
    if (value === null) { unknownNetCount++; continue; }
    subtotal += value;
    knownCount++;
  }
  return { subtotal, value: unknownNetCount > 0 && knownCount === 0 ? null : subtotal,
    knownCount, unknownNetCount, partial: unknownNetCount > 0 };
}

export function formatHubFinancial(
  value: number | null,
  summary: Pick<HubFinancialSummary, 'partial' | 'knownCount'> | undefined,
  format: (amount: number) => string,
): string {
  if (value === null || (summary?.partial && summary.knownCount === 0)) return 'Não informado';
  return `${format(value)}${summary?.partial ? ' · Parcial' : ''}`;
}

export function hubFinancialNote(summary: Pick<HubFinancialSummary, 'unknownNetCount'>): string {
  const count = summary.unknownNetCount;
  return `Dados financeiros parciais: ${count} ${count === 1 ? 'venda de Guru/Hotmart sem líquido informado' : 'vendas de Guru/Hotmart sem líquido informado'}. Valores e indicadores financeiros consideram somente os valores conhecidos.`;
}
