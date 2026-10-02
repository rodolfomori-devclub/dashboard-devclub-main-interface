/**
 * Tipos da oferta (cena da bolsa e "Proximo passo" do PDF). Separados de
 * types.ts so por tamanho; types.ts reexporta tudo daqui.
 */
// ---------------------------------------------------------------------------
// Oferta (cena da bolsa e "Proximo passo" do PDF)
// ---------------------------------------------------------------------------

/** Numeros da Head (tabela diagnostic_settings). */
export interface OfferSettings {
  cohortName: string;
  /** Preco de tabela (ancora). */
  listPrice: number | null;
  /** Desconto maximo permitido (preco de tabela - valor com bolsa). */
  scholarshipMax: number | null;
  seatsTotal: number | null;
  seatsGranted: number;
  /** ISO de quando a Head confirmou as bolsas restantes. */
  seatsConfirmedAt: string | null;
  /** Dias que a confirmacao vale (padrao 3). */
  seatsFreshDays: number;
  /** Prazo maximo de reserva da condicao, em dias a partir do dia da sessao. */
  reservationMaxDays: number | null;
}

export interface PaymentPath {
  id: string;
  /** Ex.: "À vista no Pix", "12x no cartão". */
  label: string;
  installments: number;
  installmentValue: number;
  total: number;
}

/** O que o vendedor monta na preparacao (dentro dos limites da Head). */
export interface OfferConfig {
  showAnchor: boolean;
  /** Valor com bolsa (o que o lead investe). */
  finalPrice: number | null;
  /** No maximo 3. */
  paths: PaymentPath[];
  /** 'YYYY-MM-DD' ou null. */
  validUntil: string | null;
  showSeats: boolean;
  showValidity: boolean;
}

/** O que efetivamente pode aparecer (ja filtrado pelas regras de verdade). */
export interface OfferView {
  anchor: number | null;
  finalPrice: number | null;
  discount: number | null;
  paths: PaymentPath[];
  seatsLeft: number | null;
  /** 'dd/mm/aaaa' da confirmacao das bolsas, quando seatsLeft != null. */
  seatsConfirmedOnBR: string | null;
  validUntil: string | null;
  validUntilBR: string | null;
  /** Nao ha bolsas restantes (total - concedidas = 0), confirmado ou nao: a cena da bolsa nao abre. */
  soldOut: boolean;
}

export type OfferProblemCode =
  | 'validity_not_allowed'
  | 'validity_past'
  | 'validity_too_far'
  | 'discount_over_max'
  | 'final_over_anchor'
  | 'path_math'
  | 'too_many_paths'
  | 'seats_stale';

export interface OfferProblem {
  code: OfferProblemCode;
  message: string;
}

export interface OfferEvaluation {
  view: OfferView;
  problems: OfferProblem[];
}
