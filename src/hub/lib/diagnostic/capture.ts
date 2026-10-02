/** Ajudantes da captura na call (frases e notas), usados pelo cockpit e pelo envio. */
import type { CallBlockId, Level, Quote, QuoteTag } from '@diag/types.ts';

export const MAX_PDF_QUOTES = 3;

/** Frase sendo digitada (ainda nao guardada) e a marca escolhida para ela. */
export interface QuoteDraft {
  text: string;
  /** null: usa a marca do bloco atual. */
  tag: QuoteTag | null;
}

export const EMPTY_QUOTE_DRAFT: QuoteDraft = { text: '', tag: null };

/** Rotulos internos (so o consultor ve). */
export const QUOTE_TAG_LABEL: Record<QuoteTag, string> = {
  situacao: 'Situação',
  reportagem: 'Na reportagem',
  problema: 'Problema',
  implicacao: 'Custo de ficar parado',
  necessidade: 'O que precisa',
  outro: 'Outro',
};

export const LEVEL_TEXT_CLASS: Record<Level, string> = {
  trava: 'text-red-400',
  em_construcao: 'text-amber-400',
  ponto_forte: 'text-emerald-400',
};

export function quoteTagForBlock(block: CallBlockId): QuoteTag {
  switch (block) {
    case 'situacao':
    case 'reportagem':
    case 'problema':
    case 'implicacao':
    case 'necessidade':
      return block;
    default:
      return 'outro';
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Acrescenta uma frase; entra no PDF enquanto houver vaga (3). */
export function addQuote(quotes: Quote[], text: string, tag: QuoteTag): Quote[] {
  const clean = text.trim();
  if (!clean) return quotes;
  const inPdf = quotes.filter((q) => q.inPdf).length < MAX_PDF_QUOTES;
  return [...quotes, { id: newId(), text: clean, tag, inPdf, at: new Date().toISOString() }];
}
