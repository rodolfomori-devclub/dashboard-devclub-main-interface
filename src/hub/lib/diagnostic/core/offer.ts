/**
 * Oferta da cena da bolsa e do "Proximo passo": so aparece o que e real.
 * Preco de tabela, bolsas restantes e prazo maximo de reserva vem da Head
 * (OfferSettings); o vendedor monta o resto (OfferConfig) dentro desses limites.
 */
import type { OfferConfig, OfferEvaluation, OfferProblem, OfferSettings, OfferView, PaymentPath } from './types.ts';
import { diffDaysYmd, formatBRL, isoToYmd, isValidYmd, ymdToBR } from './dates.ts';

const DAY_MS = 86400000;
const MAX_PATHS = 3;
const DEFAULT_FRESH_DAYS = 3;
/** Tolerancia de arredondamento entre parcelas x valor e o total. */
const PATH_TOLERANCE = 1;

const isMoney = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const cents = (v: number): number => Math.round(v * 100) / 100;
const dayCount = (n: number): string => `${n} ${n === 1 ? 'dia' : 'dias'}`;

function freshDaysOf(settings: OfferSettings): number {
  const days = settings.seatsFreshDays;
  return typeof days === 'number' && Number.isFinite(days) && days >= 0 ? days : DEFAULT_FRESH_DAYS;
}

/** Bolsas restantes e se a confirmacao da Head ainda vale. */
export function seatsInfo(
  settings: OfferSettings,
  nowMs: number,
): { left: number | null; fresh: boolean; confirmedOnYmd: string | null } {
  const total = settings.seatsTotal;
  const granted = Number(settings.seatsGranted) || 0;
  const left = typeof total === 'number' && Number.isFinite(total) ? Math.max(total - granted, 0) : null;
  const confirmedAt = settings.seatsConfirmedAt;
  const confirmedMs = confirmedAt ? Date.parse(confirmedAt) : NaN;
  const fresh =
    Number.isFinite(confirmedMs) &&
    typeof nowMs === 'number' &&
    Number.isFinite(nowMs) &&
    nowMs - confirmedMs <= freshDaysOf(settings) * DAY_MS;
  const confirmedOnYmd = confirmedAt && Number.isFinite(confirmedMs) ? isoToYmd(confirmedAt) || null : null;
  return { left, fresh, confirmedOnYmd };
}

/** Desconto maximo da Head, quando cadastrado junto com o preco de tabela. */
function maxDiscountOf(settings: OfferSettings, listPrice: number | null): number | null {
  const max = settings.scholarshipMax;
  return listPrice !== null && typeof max === 'number' && Number.isFinite(max) ? max : null;
}

function checkPaths(
  config: OfferConfig,
  listPrice: number | null,
  maxDiscount: number | null,
  problems: OfferProblem[],
): PaymentPath[] {
  const all = Array.isArray(config.paths) ? config.paths : [];
  if (all.length > MAX_PATHS) {
    const extra = all.length - MAX_PATHS;
    problems.push({
      code: 'too_many_paths',
      message: `Cabem no máximo 3 caminhos de pagamento. ${extra === 1 ? 'O último não vai aparecer' : `Os ${extra} últimos não vão aparecer`}.`,
    });
  }
  const visible: PaymentPath[] = [];
  for (const p of all.slice(0, MAX_PATHS)) {
    const product = p.installments * p.installmentValue;
    // Parcelas e total que se contradizem nao vao para a tela.
    const adds = Math.abs(product - p.total) <= PATH_TOLERANCE;
    if (!adds) {
      problems.push({
        code: 'path_math',
        message: `O caminho "${p.label}" não fecha: ${p.installments}x de ${formatBRL(p.installmentValue)} dá ${formatBRL(cents(product))}, mas o total está ${formatBRL(p.total)}. Ele não aparece para o lead até você corrigir.`,
      });
    }
    // Um caminho mais barato que a bolsa maxima permite e uma condicao que a Head nao deu.
    // Vale o menor entre o total e as parcelas somadas: o lead ve os dois.
    const lowest = Math.min(p.total, product);
    let overMax = false;
    if (listPrice !== null && maxDiscount !== null && cents(listPrice - lowest) > maxDiscount) {
      overMax = true;
      problems.push({
        code: 'discount_over_max',
        message: `O caminho "${p.label}" sai por ${formatBRL(cents(lowest))}, um desconto maior que a bolsa máxima da Head (${formatBRL(maxDiscount)}). Ele não aparece para o lead.`,
      });
    }
    if (adds && !overMax) visible.push(p);
  }
  return visible;
}

function checkSeats(
  config: OfferConfig,
  settings: OfferSettings,
  nowMs: number,
  problems: OfferProblem[],
): Pick<OfferView, 'seatsLeft' | 'seatsConfirmedOnBR' | 'soldOut'> {
  const s = seatsInfo(settings, nowMs);
  const seatsLeft = config.showSeats && s.left !== null && s.left > 0 && s.fresh ? s.left : null;
  if (config.showSeats && s.left !== null && !s.fresh) {
    problems.push({
      code: 'seats_stale',
      message: s.confirmedOnYmd
        ? `As bolsas restantes foram confirmadas em ${ymdToBR(s.confirmedOnYmd)}, há mais de ${dayCount(freshDaysOf(settings))}. O número não vai aparecer até a Head confirmar de novo.`
        : 'A Head ainda não confirmou as bolsas restantes, então o número não vai aparecer.',
    });
  }
  // Confirmacao vencida so esconde o numero: com zero, a cena da bolsa nao abre.
  return {
    seatsLeft,
    seatsConfirmedOnBR: seatsLeft !== null ? ymdToBR(s.confirmedOnYmd ?? '') || null : null,
    soldOut: s.left === 0,
  };
}

function checkValidity(
  config: OfferConfig,
  settings: OfferSettings,
  ctx: { todayYmd: string; sessionYmd: string },
  problems: OfferProblem[],
): string | null {
  const validUntil = (config.validUntil ?? '').trim();
  if (!validUntil) return null;
  const max = settings.reservationMaxDays;
  if (max === null || max === undefined) {
    problems.push({
      code: 'validity_not_allowed',
      message: 'A Head não cadastrou um prazo máximo de reserva, então nenhuma validade pode aparecer.',
    });
    return null;
  }
  if (!isValidYmd(validUntil)) {
    problems.push({ code: 'validity_past', message: 'A data de validade não é uma data válida, então não vai aparecer.' });
    return null;
  }
  let ok = true;
  const br = ymdToBR(validUntil);
  if (isValidYmd(ctx.todayYmd) && validUntil < ctx.todayYmd) {
    problems.push({ code: 'validity_past', message: `A validade (${br}) já passou, então não vai aparecer.` });
    ok = false;
  } else if (isValidYmd(ctx.sessionYmd) && validUntil < ctx.sessionYmd) {
    // Na preparacao parece valida, mas no dia da call ja teria passado.
    problems.push({
      code: 'validity_past',
      message: `A validade (${br}) é antes do dia da sessão, então não vai aparecer.`,
    });
    ok = false;
  }
  const base = isValidYmd(ctx.sessionYmd) ? ctx.sessionYmd : ctx.todayYmd;
  if (!(diffDaysYmd(base, validUntil) <= max)) {
    problems.push({
      code: 'validity_too_far',
      message: `A validade (${br}) passa do prazo máximo de reserva da Head (${dayCount(max)} a partir do dia da sessão), então não vai aparecer.`,
    });
    ok = false;
  }
  return ok && config.showValidity ? validUntil : null;
}

/** O que pode aparecer para o lead e o que precisa ser corrigido na preparacao. */
export function evaluateOffer(
  config: OfferConfig,
  settings: OfferSettings,
  ctx: { todayYmd: string; sessionYmd: string; nowMs: number },
): OfferEvaluation {
  const problems: OfferProblem[] = [];
  const listPrice = isMoney(settings.listPrice) ? settings.listPrice : null;
  const anchor = config.showAnchor && listPrice !== null ? listPrice : null;
  const finalPrice = isMoney(config.finalPrice) ? config.finalPrice : null;
  const maxDiscount = maxDiscountOf(settings, listPrice);

  let discount: number | null = null;
  // Condicao fora das regras da Head: nenhum valor aparece para o lead ate corrigir.
  let blocked = false;
  if (listPrice !== null && finalPrice !== null) {
    const d = cents(listPrice - finalPrice);
    if (d < 0) {
      blocked = true;
      problems.push({
        code: 'final_over_anchor',
        message: `O valor com bolsa (${formatBRL(finalPrice)}) está acima do preço de tabela (${formatBRL(listPrice)}). Nenhum valor aparece para o lead até você corrigir.`,
      });
    }
    if (maxDiscount !== null && d > maxDiscount) {
      blocked = true;
      problems.push({
        code: 'discount_over_max',
        message: `O desconto (${formatBRL(d)}) passa da bolsa máxima da Head (${formatBRL(maxDiscount)}). Nenhum valor aparece para o lead até você ajustar o valor com bolsa.`,
      });
    }
    discount = anchor !== null && d >= 0 ? d : null;
  }

  const paths = checkPaths(config, listPrice, maxDiscount, problems);
  const seats = checkSeats(config, settings, ctx.nowMs, problems);
  const validUntil = checkValidity(config, settings, ctx, problems);

  const view: OfferView = {
    anchor,
    finalPrice: blocked ? null : finalPrice,
    discount: blocked ? null : discount,
    paths: blocked ? [] : paths,
    ...seats,
    validUntil,
    validUntilBR: validUntil ? ymdToBR(validUntil) : null,
  };
  return { view, problems };
}

/** Frase da condicao para o PDF ("Proximo passo"): so com validade real. */
export function conditionLine(view: OfferView): string | null {
  return view.validUntilBR ? `Sua bolsa fica reservada até ${view.validUntilBR}` : null;
}

/** Complemento do roteiro do Proximo passo: so com bolsas restantes confirmadas. */
export function seatsClause(settings: OfferSettings, nowMs: number): string {
  const s = seatsInfo(settings, nowMs);
  return s.left !== null && s.left > 0 && s.fresh ? ', que tem vagas limitadas' : '';
}

function pathText(p: PaymentPath): string {
  return p.installments > 1 ? `${p.label}: ${p.installments}x de ${formatBRL(p.installmentValue)}` : `${p.label}: ${formatBRL(p.total)}`;
}

/** Uma linha para a nota do CRM (valor com bolsa, caminhos, validade). null quando nada foi montado. */
export function offerSummary(view: OfferView): string | null {
  const parts: string[] = [];
  if (isMoney(view.finalPrice)) parts.push(`valor com bolsa ${formatBRL(view.finalPrice)}`);
  if (Array.isArray(view.paths) && view.paths.length) parts.push(view.paths.map(pathText).join('; '));
  if (view.validUntilBR) parts.push(`reservada até ${view.validUntilBR}`);
  return parts.length ? parts.join(' · ') : null;
}
