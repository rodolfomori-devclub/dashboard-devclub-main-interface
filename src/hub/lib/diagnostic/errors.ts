/**
 * Traduz os erros das funcoes diagnostic_* (prefixos DIAG_*) e de rede para
 * mensagens que o consultor entende.
 */

export function errorText(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const { message, error } = err as { message?: unknown; error?: unknown };
    // The Dashboard API answers Vault failures as {error, code}, without message.
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  return String(err);
}

function errorField(err: unknown, key: 'code' | 'status'): unknown {
  return err && typeof err === 'object' && key in err ? (err as Record<string, unknown>)[key] : undefined;
}

/**
 * O supabase-js devolve o status HTTP fora do erro. Junta os dois para saber
 * depois se foi o gateway (5xx com pagina HTML) ou o banco que recusou.
 */
export function withHttpStatus<E extends object>(error: E, status: number): E & { status: number } {
  return Object.assign(error, { status });
}

export function isNetworkError(err: unknown): boolean {
  const msg = errorText(err);
  return (
    /Failed to fetch|NetworkError|Load failed|fetch failed|Network request failed/i.test(msg) ||
    (typeof navigator !== 'undefined' && navigator.onLine === false)
  );
}

export function isConflictError(err: unknown): boolean {
  return errorText(err).includes('DIAG_CONFLICT');
}

/** PostgREST recarregando o schema, timeout, serializacao, deadlock, conexao com o banco. */
const TRANSIENT_CODE = /^(PGRST00[0-2]|57014|40001|40P01|08[0-9A-Z]{3})$/;

/**
 * Falha que passa sozinha (rede, gateway 5xx, banco ocupado): vale tentar de
 * novo. Recusa do banco (DIAG_*, permissao, dado invalido) nao adianta repetir.
 */
export function isTransientError(err: unknown): boolean {
  if (isNetworkError(err)) return true;
  if (/DIAG_[A-Z]/.test(errorText(err))) return false;
  if (TRANSIENT_CODE.test(String(errorField(err, 'code') ?? ''))) return true;
  const status = Number(errorField(err, 'status'));
  return status >= 500 && status <= 599;
}

export function diagnosticErrorMessage(err: unknown): string {
  const msg = errorText(err);
  if (isNetworkError(err)) return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  if (msg.includes('DIAG_CONFLICT')) return 'Esta ficha foi alterada em outra janela.';
  if (msg.includes('DIAG_SENT_FROZEN')) return 'O diagnóstico já foi enviado. Reabra para corrigir.';
  if (msg.includes('DIAG_NOT_ELIGIBLE')) {
    return 'Quem está cursando graduação não entra no MBA nem na Extensão. Entregue o diagnóstico e não apresente bolsa.';
  }
  if (msg.includes('DIAG_FORBIDDEN')) return 'Só o consultor da sessão ou o gestor podem editar este diagnóstico.';
  if (msg.includes('DIAG_NOT_FOUND')) return 'Diagnóstico não encontrado.';
  if (msg.includes('DIAG_CONTENT_MISSING') || msg.includes('DIAG_CONTENT_INVALID')) {
    return 'O conteúdo do diagnóstico não carregou. Tente de novo; se continuar, avise a gestão comercial.';
  }
  // Dashboard API: a Vault session that expired and could not be renewed, or a
  // screen removed in Vault. Vault outages (VAULT_UNAVAILABLE, 503) are transient.
  const code = String(errorField(err, 'code') ?? '');
  if (['VAULT_TOKEN_REQUIRED', 'VAULT_TOKEN_INVALID', 'VAULT_SESSION_INVALID'].includes(code)) return 'Sua sessão expirou. Entre de novo pelo Vault.';
  if (['DASHBOARD_ACCESS_REQUIRED', 'DASHBOARD_PERMISSION_REQUIRED'].includes(code)) return 'Seu acesso ao Apoio Vendas mudou. Recarregue a página ou fale com um administrador.';
  if (['VAULT_UNAVAILABLE', 'HUB_UNAVAILABLE'].includes(code)) return 'O servidor não respondeu agora. Tente de novo em instantes.';
  const invalid = msg.match(/DIAG_INVALID:\s*(.+)$/);
  if (invalid) {
    const text = invalid[1].trim();
    return text.charAt(0).toUpperCase() + text.slice(1) + (text.endsWith('.') ? '' : '.');
  }
  if (msg.includes('news_shown_ids')) return 'No máximo 2 reportagens por call.';
  // Pagina de erro do gateway (HTML) ou banco ocupado: nunca mostrar o corpo cru.
  if (isTransientError(err) || /^\s*</.test(msg)) return 'O servidor não respondeu agora. Tente de novo em instantes.';
  return msg || 'Não foi possível salvar.';
}
