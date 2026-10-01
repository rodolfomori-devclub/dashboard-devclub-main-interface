/**
 * WhatsApp helpers — sanitize phone numbers, format for display, build wa.me URLs.
 *
 * All numbers are assumed BR by default. If a number has no country code,
 * "55" is prepended automatically when building the wa.me link.
 */

/** Strip everything that is not a digit. */
export function sanitizePhone(raw?: string | null): string {
  if (!raw) return '';
  return String(raw).replace(/\D+/g, '');
}

/** Ensure the number includes a country code (defaults to BR / 55). */
export function withCountryCode(raw?: string | null, defaultCC = '55'): string {
  const digits = sanitizePhone(raw);
  if (!digits) return '';
  // Already has a country code (BR mobile = 12-13 digits with 55, landline = 12)
  if (digits.length >= 12) return digits;
  return `${defaultCC}${digits}`;
}

/**
 * Pretty-print a BR phone: +55 (11) 99999-9999 / +55 (11) 9999-9999.
 * Falls back to a best-effort grouping for non-BR numbers.
 */
export function formatPhoneDisplay(raw?: string | null): string {
  const digits = sanitizePhone(raw);
  if (!digits) return '';

  // BR with country code
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${mid}-${end}`;
  }
  // BR without country code
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const rest = digits.slice(2);
    const mid = rest.length === 9 ? rest.slice(0, 5) : rest.slice(0, 4);
    const end = rest.length === 9 ? rest.slice(5) : rest.slice(4);
    return `+55 (${ddd}) ${mid}-${end}`;
  }
  // Unknown format → return as-is with leading +
  return `+${digits}`;
}

export interface WhatsAppUrlOptions {
  /** Optional message template. Tokens like {{lead_name}} are replaced. */
  message?: string;
  tokens?: Record<string, string | undefined | null>;
}

/** Replace {{token}} placeholders inside a message template. */
function renderTemplate(tpl: string, tokens?: Record<string, string | undefined | null>) {
  if (!tokens) return tpl;
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (tokens[k] ?? '').toString());
}

/**
 * Build a WhatsApp URL ready to open in a new tab / WhatsApp app.
 *
 * Uses `api.whatsapp.com/send` instead of `wa.me` because some embedded
 * contexts (iframes, in-app browsers) block the wa.me redirect chain with
 * "API blocked" errors. `api.whatsapp.com/send` opens directly.
 */
export function buildWhatsAppUrl(raw?: string | null, opts: WhatsAppUrlOptions = {}): string {
  const number = withCountryCode(raw);
  if (!number) return '';
  const params = new URLSearchParams({ phone: number });
  if (opts.message) {
    params.set('text', renderTemplate(opts.message, opts.tokens));
  }
  return `https://api.whatsapp.com/send?${params.toString()}`;
}

/** Detect mobile UA for native deep-linking. */
function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Open WhatsApp robustly from any context (including sandboxed iframes
 * like the Lovable preview). Strategy:
 *  1. On mobile, try the native `whatsapp://` deep link first.
 *  2. Use `window.open` from the top-most window we can reach so the new
 *     tab escapes the iframe sandbox restrictions on `<a target="_blank">`.
 *  3. Fall back to assigning `location.href` if popups are blocked.
 */
export function openWhatsApp(raw?: string | null, opts: WhatsAppUrlOptions = {}): boolean {
  const number = withCountryCode(raw);
  if (!number) return false;
  const webUrl = buildWhatsAppUrl(raw, opts);

  if (isMobile()) {
    const text = opts.message ? renderTemplate(opts.message, opts.tokens) : '';
    const nativeUrl = `whatsapp://send?phone=${number}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
    try {
      // Use top so iframe sandboxing doesn't swallow the protocol handler.
      (window.top || window).location.href = nativeUrl;
      // Safety net — if the app isn't installed, fall back to web after a moment.
      setTimeout(() => {
        try { (window.top || window).open(webUrl, '_blank', 'noopener,noreferrer'); } catch { /* noop */ }
      }, 800);
      return true;
    } catch {
      // fall through to web open
    }
  }

  try {
    const win = (window.top || window).open(webUrl, '_blank', 'noopener,noreferrer');
    if (win) return true;
  } catch { /* sandbox might throw */ }

  // Last-resort: navigate the top window so the user can come back via history.
  try {
    (window.top || window).location.href = webUrl;
    return true;
  } catch {
    window.location.href = webUrl;
    return true;
  }
}
