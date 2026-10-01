/**
 * Commission calculation engine for "Perpétuo" and "Lançamento" models.
 *
 * PERPÉTUO rules:
 * - If total monthly sales < R$30.000 → reduced rates (Hubla 2%, TMB 1.5%)
 * - If >= R$30.000 → rates depend on seniority:
 *     Junior:  Hubla 3%,  TMB 2%
 *     Pleno:   Hubla 4%,  TMB 2.5%
 *     Senior:  Hubla 5%,  TMB 3.5%
 *
 * LANÇAMENTO rules (flat rates by seniority, no threshold):
 *     Junior:  Hubla 3%,  TMB 2%
 *     Pleno:   Hubla 4%,  TMB 2.5%
 *     Senior:  Hubla 5%,  TMB 3.5%
 *
 * HUBLA + TMB: split 50/50 and apply each rate separately.
 */

export type Seniority = 'junior' | 'pleno' | 'senior';
export type CommissionModel = 'perpetuo' | 'lancamento';

interface RatePair {
  hubla: number;
  tmb: number;
}

const REDUCED_RATES: RatePair = { hubla: 0.02, tmb: 0.015 };

const SENIORITY_RATES: Record<Seniority, RatePair> = {
  junior: { hubla: 0.03, tmb: 0.02 },
  pleno: { hubla: 0.04, tmb: 0.025 },
  senior: { hubla: 0.05, tmb: 0.035 },
};

const PERPETUO_THRESHOLD = 30_000;

const LANCAMENTO_RATES: Record<Seniority, RatePair> = {
  junior: { hubla: 0.03, tmb: 0.02 },
  pleno: { hubla: 0.04, tmb: 0.025 },
  senior: { hubla: 0.05, tmb: 0.035 },
};

/**
 * Normalize platform strings coming from the DB.
 */
export function normalizePlatform(platform: string): 'hubla' | 'tmb' | 'hubla+tmb' | 'unknown' {
  const p = (platform || '').trim().toLowerCase();
  // Check combined first (before individual checks)
  if (p.includes('hubla') && p.includes('tmb')) return 'hubla+tmb';
  if (p.includes('hubla')) return 'hubla';
  if (p.includes('tmb')) return 'tmb';
  return 'unknown';
}

/**
 * Get the rate pair for a given model, seniority, and total sales context.
 */
function getRates(model: CommissionModel, seniority: Seniority, totalSales: number): RatePair {
  if (model === 'lancamento') {
    return LANCAMENTO_RATES[seniority];
  }
  // Perpétuo
  return totalSales < PERPETUO_THRESHOLD ? REDUCED_RATES : SENIORITY_RATES[seniority];
}

/**
 * Calculate commission for a single sale, handling Hubla+TMB split.
 * Returns { commissionRate, commissionValue, hublaCommission, tmbCommission }
 */
function calculateSaleCommission(
  amount: number,
  platform: string,
  rates: RatePair,
): { commissionRate: number; commissionValue: number; hublaCommission?: number; tmbCommission?: number } {
  const norm = normalizePlatform(platform);

  if (norm === 'hubla+tmb') {
    const half = amount / 2;
    const hublaCommission = half * rates.hubla;
    const tmbCommission = half * rates.tmb;
    const commissionValue = hublaCommission + tmbCommission;
    // Blended rate for display
    const commissionRate = amount > 0 ? commissionValue / amount : 0;
    return { commissionRate, commissionValue, hublaCommission, tmbCommission };
  }

  if (norm === 'tmb') {
    return { commissionRate: rates.tmb, commissionValue: amount * rates.tmb };
  }

  // hubla or unknown → default to hubla
  return { commissionRate: rates.hubla, commissionValue: amount * rates.hubla };
}

// Legacy exports for backward compat
export function getPerpetuoRate(seniority: Seniority, totalSales: number, platform: string): number {
  const rates = getRates('perpetuo', seniority, totalSales);
  return calculateSaleCommission(1, platform, rates).commissionRate;
}

export function getLancamentoRate(seniority: Seniority, platform: string): number {
  const rates = getRates('lancamento', seniority, 0);
  return calculateSaleCommission(1, platform, rates).commissionRate;
}

export interface SaleWithCommission {
  id: string;
  date: string;
  client_name: string;
  product: string;
  amount: number;
  origin: string;
  temperature: string;
  platform: string;
  commissionRate: number;
  commissionValue: number;
  /** Present only when platform = Hubla + TMB */
  hublaCommission?: number;
  /** Present only when platform = Hubla + TMB */
  tmbCommission?: number;
  /** For TMB Global installment sales, the commission base amount (first installment) */
  installmentCommissionBase?: number;
  /** Number of installments */
  installments?: number;
}

/**
 * Calculate commissions for a list of sales.
 * Supports both Perpétuo and Lançamento models.
 * Handles Hubla+TMB split automatically.
 */
export function calculateCommissions(
  sales: any[],
  seniority: Seniority,
  model: CommissionModel = 'perpetuo',
): { rows: SaleWithCommission[]; totalSales: number; totalCommission: number } {
  // Commission base is ALWAYS the value the seller reports as "Valor Real Coletado neste mês".
  // Priority: real_collected_this_month → cash_collected → amount (legacy fallback).
  // Returns { value, source } — source tells whether it came from the seller's
  // manual "real collected" field (already represents only what came in this month,
  // e.g. the 1st installment) or from the total sale amount (legacy).
  const cashOf = (s: any): { value: number; source: 'manual' | 'legacy' } => {
    if (s.real_collected_this_month !== null && s.real_collected_this_month !== undefined && s.real_collected_this_month !== '') {
      const rc = Number(s.real_collected_this_month);
      if (!isNaN(rc)) return { value: Math.max(0, rc), source: 'manual' };
    }
    const cc = Number(s.cash_collected);
    if (!isNaN(cc) && cc > 0) return { value: cc, source: 'manual' };
    // Legado: desconta valores pendentes/futuros — só comissiona o que foi coletado.
    const amount = Number(s.amount) || 0;
    const pendingFuture = Number(s.pending_future_value) || 0;
    const status = String(s.outstanding_status || 'none').toLowerCase();
    const outstanding = status === 'pending' || status === 'expired' ? Number(s.future_outstanding_value) || 0 : 0;
    return { value: Math.max(0, amount - pendingFuture - outstanding), source: 'legacy' };
  };

  const totalSales = sales.reduce((sum, s) => sum + cashOf(s).value, 0);
  const rates = getRates(model, seniority, totalSales);

  const rows: SaleWithCommission[] = sales.map((s) => {
    const { value: amount, source } = cashOf(s);
    const platform = s.platform || '';
    const product = s.product || '';
    const numInstallments = s.installments || 1;
    const norm = normalizePlatform(platform);
    const isGlobal = product.toLowerCase().includes('global');
    const isTmbGlobalInstallment = isGlobal && norm === 'tmb' && numInstallments > 1;

    let commissionBase = amount;
    // Só dividimos por parcelas quando a base veio do valor TOTAL da venda (legacy).
    // Se o vendedor informou "Valor Real Coletado neste mês", esse valor JÁ é a 1ª parcela.
    if (isTmbGlobalInstallment && source === 'legacy') {
      commissionBase = amount / numInstallments;
    }

    const result = calculateSaleCommission(commissionBase, platform, rates);

    return {
      id: s.id,
      date: s.date,
      client_name: s.client_name,
      product,
      amount,
      origin: s.origin,
      temperature: s.temperature,
      platform,
      commissionRate: result.commissionRate,
      commissionValue: result.commissionValue,
      hublaCommission: result.hublaCommission,
      tmbCommission: result.tmbCommission,
      installmentCommissionBase: isTmbGlobalInstallment ? commissionBase : undefined,
      installments: numInstallments > 1 ? numInstallments : undefined,
    };
  });

  const totalCommission = rows.reduce((sum, r) => sum + r.commissionValue, 0);

  return { rows, totalSales, totalCommission };
}

/**
 * @deprecated Use calculateCommissions with model parameter instead.
 */
export function calculatePerpetuoCommissions(
  sales: any[],
  seniority: Seniority,
): { rows: SaleWithCommission[]; totalSales: number; totalCommission: number } {
  return calculateCommissions(sales, seniority, 'perpetuo');
}
