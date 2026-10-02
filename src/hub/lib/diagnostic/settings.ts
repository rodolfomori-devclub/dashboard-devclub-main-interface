import type { OfferSettings } from '@diag/types.ts';

/**
 * Linha unica de diagnostic_settings. As tabelas do diagnostico ficam fora dos
 * tipos gerados do Dashboard; o schema esta em migrations/diagnostic (API).
 */
export interface DiagnosticSettingsRow {
  id: boolean;
  cohort_name: string;
  list_price: number | null;
  scholarship_max: number | null;
  seats_total: number | null;
  seats_granted: number;
  seats_confirmed_at: string | null;
  seats_confirmed_by: string | null;
  seats_fresh_days: number;
  reservation_max_days: number | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Sem linha no banco: nenhum fato da turma cadastrado (nada de escassez na tela). */
export const EMPTY_OFFER_SETTINGS: OfferSettings = {
  cohortName: '',
  listPrice: null,
  scholarshipMax: null,
  seatsTotal: null,
  seatsGranted: 0,
  seatsConfirmedAt: null,
  seatsFreshDays: 3,
  reservationMaxDays: null,
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function offerSettingsFromRow(row: DiagnosticSettingsRow | null | undefined): OfferSettings {
  if (!row) return EMPTY_OFFER_SETTINGS;
  return {
    cohortName: row.cohort_name ?? '',
    listPrice: num(row.list_price),
    scholarshipMax: num(row.scholarship_max),
    seatsTotal: num(row.seats_total),
    seatsGranted: num(row.seats_granted) ?? 0,
    seatsConfirmedAt: row.seats_confirmed_at ?? null,
    seatsFreshDays: num(row.seats_fresh_days) ?? 3,
    reservationMaxDays: num(row.reservation_max_days),
  };
}
