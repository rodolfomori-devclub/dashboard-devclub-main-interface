/**
 * Verificador de palavras: termos internos, frases de pressao e promessas que
 * nunca podem chegar ao lead (lista em content.guardrails).
 */
import type { Guardrails } from './types.ts';

/** Sem acento e em minusculas ('Arquétipo' -> 'arquetipo'). */
export function normalizeText(s: string): string {
  return String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const WORD_CHAR = /[a-z0-9]/;

const squash = (s: string): string => normalizeText(s).replace(/\s+/g, ' ').trim();

/** `needle` aparece em `haystack` como palavra ou frase inteira (ambos ja normalizados). */
function containsWhole(haystack: string, needle: string): boolean {
  if (!needle) return false;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return false;
    const before = at > 0 ? haystack[at - 1] : '';
    const after = haystack[at + needle.length] ?? '';
    if (!WORD_CHAR.test(before) && !WORD_CHAR.test(after)) return true;
    from = at + 1;
  }
}

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/**
 * Termos da lista encontrados no texto, como estao escritos na lista (sem
 * repetir). Compara sem acento e sem caixa, so palavra ou frase inteira:
 * 'lead' nao casa com 'líder' nem com 'leads'.
 */
export function findForbidden(text: string, g: Guardrails): string[] {
  const haystack = squash(text);
  if (!haystack || !g) return [];
  const found: string[] = [];
  for (const term of [...list(g.palavras), ...list(g.frases), ...list(g.promessas)]) {
    if (!found.includes(term) && containsWhole(haystack, squash(term))) found.push(term);
  }
  return found;
}
