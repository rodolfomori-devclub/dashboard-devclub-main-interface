import { requestApi } from '../../../lib/api';

export interface CommissionSale {
  id: string;
  externalId: string;
  sourceId: string;
  platform: string;
  date: string;
  product: string;
  family: string;
  sellerId: string | null;
  sellerName: string | null;
  attributionMethod: 'utm' | 'manual' | 'unassigned';
  utm: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
  gross: number | null;
  cashCollected: number | null;
  commission: number | null;
  commissionStatus: 'pending_rule' | 'pending_cash' | 'pending_refund' | 'pending_attribution' | 'refunded' | 'calculated';
  commissionRate: number | null;
  commissionRateSource?: string;
}
export interface CommissionSnapshot {
  period: { month: string; startDate: string; endDate: string };
  scope: 'self' | 'all' | 'seller';
  sellerId: string | null;
  sellers: { id: string; name: string }[];
  sales: CommissionSale[];
  summary: { salesCount: number; gross: number | null; cashCollected: number | null; commission: number | null; calculatedCommission?: number; pendingCommissionCount: number; refundedSalesCount: number; unassignedSalesCount?: number; missingGrossCount?: number; missingCashCount?: number };
  status: { partial: boolean; loading: boolean; attributionAvailable: boolean; sources: { id: string; status: string }[]; generatedAt: string; refundReviewRequired?: boolean; refundCoverage?: { id: string; status: string; basis: string; startDate: string; endDate: string }[] };
  rules: { status: string; message: string };
}
export async function fetchCommissions(month: string, sellerId: string | null, signal?: AbortSignal, scope: 'self' | 'financial' = 'self'): Promise<CommissionSnapshot> {
  const params = new URLSearchParams({ month });
  if (scope === 'financial' && sellerId) params.set('sellerId', sellerId);
  const response = await requestApi(`/commissions${scope === 'self' ? '/me' : ''}?${params}`, { signal });
  if (!response?.success || !response.data?.summary || !response.data?.status || !response.data?.rules || !Array.isArray(response.data.sales) || !Array.isArray(response.data.sellers)) {
    throw new Error('O extrato de comissões retornou dados incompletos. Tente novamente.');
  }
  return response.data;
}
export function formatCommissionMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
    : 'A confirmar';
}
export function currentCommissionMonth(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(new Date());
  return `${parts.find((item) => item.type === 'year')?.value}-${parts.find((item) => item.type === 'month')?.value}`;
}
