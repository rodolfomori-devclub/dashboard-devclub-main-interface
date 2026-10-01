/**
 * Chaves de localStorage do app + migracao do prefixo legado `fsc_` -> `dc_`.
 *
 * POR QUE ISTO EXISTE
 * Renomear uma chave de localStorage e uma quebra SILENCIOSA: o dado antigo
 * continua no navegador do usuario, mas o codigo passa a ler um nome que nunca
 * foi escrito. No rebrand, renomear direto causaria:
 *
 *   fsc_remember  -> todo mundo cai na tela de login na proxima visita
 *   fsc_milestones-> marcos reprocessados = CelebrationOverlay dispara em massa,
 *                    confete em tela cheia para o time inteiro
 *   fsc_draft_*   -> rascunhos de venda nao salvos ficam orfaos (perda de dado)
 *   fsc_view_mode -> quem estava "vendo como vendedor" e jogado para outra UI
 *   fsc_audio_*   -> som de venda volta ao default (TV pode passar de muda a alta)
 *
 * `migrateLegacyStorage()` roda uma vez no boot, copia o que existir de `fsc_`
 * para `dc_` e apaga o antigo. Depois de alguns deploys, quando ninguem mais
 * tiver o prefixo velho no navegador, este arquivo pode ser simplificado —
 * basta remover a funcao e manter as constantes.
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
 * Copia toda chave `fsc_*` para `dc_*` e remove a antiga.
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
      console.info(`[storage] ${legadas.length} chave(s) migrada(s) de fsc_ para dc_`);
    }
  } catch (e) {
    console.warn('[storage] migracao de chaves legadas falhou (ignorado):', e);
  }
}
