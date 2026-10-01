import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse a YYYY-MM-DD date string as a LOCAL date (not UTC).
 * Prevents the off-by-one-day bug caused by `new Date('YYYY-MM-DD')`
 * which JS interprets as UTC midnight.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * REGRA GLOBAL DE CASH COLLECTED (válida para TODO o software):
 * Cash Collected = dinheiro DE FATO recebido, em qualquer plataforma (Hubla, TMB...).
 * Valores combinados para o futuro (parcelas futuras, "por sucesso", pendências)
 * NÃO são cash collected até serem efetivamente recebidos e editados na venda.
 *
 * Prioridade:
 *  1. real_collected_this_month (valor real coletado informado pelo vendedor)
 *  2. cash_collected
 *  3. amount − pendências futuras ainda não recebidas (fallback legado)
 */
export function getCashCollected(sale: any): number {
  if (sale == null) return 0;
  const rc = sale.real_collected_this_month;
  if (rc !== null && rc !== undefined && rc !== '') {
    const n = Number(rc);
    if (!isNaN(n)) return Math.max(0, n);
  }
  const cc = Number(sale.cash_collected);
  if (!isNaN(cc) && cc > 0) return cc;

  // Fallback legado: desconta tudo que ficou combinado para o futuro
  const amount = Number(sale.amount) || 0;
  const pendingFuture = Number(sale.pending_future_value) || 0;
  const status = String(sale.outstanding_status || 'none').toLowerCase();
  const outstanding = status === 'pending' || status === 'expired'
    ? Number(sale.future_outstanding_value) || 0
    : 0;
  return Math.max(0, amount - pendingFuture - outstanding);
}

/**
 * Valor ainda pendente de recebimento de uma venda (não é cash collected).
 */
export function getPendingValue(sale: any): number {
  if (sale == null) return 0;
  const pendingFuture = Number(sale.pending_future_value) || 0;
  const status = String(sale.outstanding_status || 'none').toLowerCase();
  const outstanding = status === 'pending' || status === 'expired'
    ? Number(sale.future_outstanding_value) || 0
    : 0;
  return Math.max(0, pendingFuture + outstanding);
}
