/**
 * Escape de HTML do PDF do diagnostico (texto e atributos entre aspas).
 * Modulo puro, compartilhado com as edge functions.
 */

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** null/undefined viram ''. Qualquer outro valor vira texto escapado. */
export function escapeHtml(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}
