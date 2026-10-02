/** Formatos da tela do lead (pt-BR). */
import type { Level } from '@diag/types.ts';

const NUMBER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const MONEY_WHOLE = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const MONEY_CENTS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const fmtNumber = (n: number): string => NUMBER.format(n);

/** "R$ 20.000" ou "R$ 1.234,50". */
export const fmtMoney = (n: number): string => (Number.isInteger(n) ? MONEY_WHOLE : MONEY_CENTS).format(n);

export const LEVEL_LABEL: Record<Level, string> = {
  trava: 'Trava',
  em_construcao: 'Em construção',
  ponto_forte: 'Ponto forte',
};

/** Frase longa encolhe um pouco para caber no palco. */
export function quoteSizeClass(text: string): string {
  if (text.length > 280) return 'lead-xlong';
  if (text.length > 160) return 'lead-long';
  return '';
}
