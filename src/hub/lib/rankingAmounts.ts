import { getCashCollected } from './utils.ts';

const money = (value: unknown): number | null => value !== null && value !== undefined && value !== '' && typeof value !== 'boolean'
  && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;

/** Mirrors expose the original gross via the authorized API; legacy mirror values can be net. */
export function rankingGross(sale: any): number | null {
  if (sale.dashboard_ledger_id || sale.dashboard_value != null) return money(sale.dashboard_gross);
  const contract = money(sale.total_sale_value);
  // Historical Hub rows defaulted total_sale_value to zero before tracking contracts.
  if (contract !== null && contract > 0) return contract;
  const received = money(sale.amount);
  if (received === null) return contract;
  return received + (money(sale.future_outstanding_value) ?? 0);
}

export function rankingCash(sale: any): number | null {
  if (sale.dashboard_cash_known === false) return null;
  return money(sale.real_collected_this_month) ?? money(sale.cash_collected)
    ?? (money(sale.amount) === null ? null : getCashCollected(sale));
}

export function rankingAmounts(sales: any[]) {
  const sum = (get: (sale: any) => number | null) => {
    const known = sales.map(get).filter((value): value is number => value !== null);
    return { value: known.length || !sales.length ? known.reduce((total, value) => total + Math.round(value * 100), 0) / 100 : null, partial: known.length !== sales.length };
  };
  const gross = sum(rankingGross), cash = sum(rankingCash);
  return { gross: gross.value, cash: cash.value, grossPartial: gross.partial, cashPartial: cash.partial };
}

export const rankingMoney = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value) : 'A confirmar';
