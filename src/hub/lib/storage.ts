/**
 * Chaves de localStorage do app e migracao de preferencias de versoes anteriores.
 * Preserva sessao lembrada, marcos, rascunhos, modo de visualizacao e audio.
 * O prefixo antigo existe apenas para recuperar os dados salvos no navegador.
 */

const LEGACY_PREFIX = 'fsc_';
const PREFIX = 'dc_';

export const STORAGE_KEYS = {
  viewMode: `${PREFIX}view_mode`,
  remember: `${PREFIX}remember`,
  capitaoLastBubble: `${PREFIX}capitao_last_bubble`,
  milestones: `${PREFIX}milestones`,
  audioSettings: `${PREFIX}audio_settings`,
} as const;

/** Prefixo dos rascunhos de venda (chave composta: `dc_draft_<id>`). */
export const DRAFT_PREFIX = `${PREFIX}draft_`;

/** Marca de que a migracao ja rodou neste navegador. */
const MIGRATED_FLAG = `${PREFIX}storage_migrated_v1`;

/**
 * Copia as chaves legadas para o prefixo atual e remove as antigas.
 * Idempotente e tolerante a falha — se o localStorage estiver indisponivel
 * (modo privado, storage cheio), o app segue funcionando com os defaults.
 */
export function migrateLegacyStorage(): void {
  if (typeof window === 'undefined') return;

  try {
    if (localStorage.getItem(MIGRATED_FLAG) === '1') return;

    const legadas: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(LEGACY_PREFIX)) legadas.push(k);
    }

    for (const antiga of legadas) {
      const nova = PREFIX + antiga.slice(LEGACY_PREFIX.length);
      const valor = localStorage.getItem(antiga);
      // Nao sobrescreve se a nova ja existir: o valor mais recente vence.
      if (valor !== null && localStorage.getItem(nova) === null) {
        localStorage.setItem(nova, valor);
      }
      localStorage.removeItem(antiga);
    }

    localStorage.setItem(MIGRATED_FLAG, '1');

    if (legadas.length > 0) {
      console.info(`[storage] ${legadas.length} preferencia(s) atualizada(s)`);
    }
  } catch (e) {
    console.warn('[storage] migracao de chaves legadas falhou (ignorado):', e);
  }
}
