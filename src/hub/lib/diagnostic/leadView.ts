/**
 * Modelo da tela do lead: o que cada cena mostra ate o passo atual e quando
 * ela pode abrir. O cockpit chama buildLeadView a cada mudanca e transmite o
 * resultado inteiro (presentationTransport.ts).
 *
 * Regras de verdade aplicadas aqui, nunca na janela do lead:
 * - cena travada nao vai para a tela (vira a tela neutra);
 * - o modelo so tem o que ja foi revelado; notas, roteiro e anotacoes nunca;
 * - devolutiva so com a causa raiz; caminho e bolsa so com a graduacao confirmada;
 * - bolsa so com pedido, custo dito por ele, elegivel e oferta montada.
 */
import {
  SCENE_IDS,
  sceneMeta,
  sceneOrder,
  type LeadViewModel,
  type PresentationState,
  type SceneId,
  type SceneVM,
} from '@/lib/diagnostic/presentation';
import { firstNameOf, type LeadViewContext, type SceneDef } from '@/lib/diagnostic/leadViewShared';
import {
  abertura,
  mercado,
  mercadoArticleIdAt,
  momento,
  montando,
  objetivo,
  palavras,
  screenArticles,
  tempo,
} from '@/lib/diagnostic/leadViewScenes';
import {
  bolsa,
  caminho,
  devolutiva,
  encerramento,
  offerRevealedAt,
  pathPairs,
  plano,
  proximo,
} from '@/lib/diagnostic/leadViewResults';

export type { LeadViewContext } from '@/lib/diagnostic/leadViewShared';
export { mercadoArticleIdAt, offerRevealedAt, pathPairs, screenArticles };

const DEFS: Record<SceneId, SceneDef> = {
  abertura,
  momento,
  tempo,
  mercado,
  montando,
  palavras,
  objetivo,
  devolutiva,
  plano,
  caminho,
  proximo,
  bolsa,
  encerramento,
};

export interface SceneStatus {
  /** Ligada na preparacao (as sempre ligadas: sempre true). */
  enabled: boolean;
  /** Pode ir para a tela agora. */
  ready: boolean;
  /** Por que nao abre (cockpit). null quando pronta. */
  reason: string | null;
  /** Quantos passos tem agora (0 quando travada). */
  steps: number;
  /** Chaves dos passos de agora ([] quando travada): o cockpit lembra o passo pela chave. */
  keys: string[];
}

export function sceneStatus(ctx: LeadViewContext): Record<SceneId, SceneStatus> {
  const enabled = new Map(sceneOrder(ctx.ws.diagnosis.prep_config).map((s) => [s.id, s.enabled]));
  const out = {} as Record<SceneId, SceneStatus>;
  for (const id of SCENE_IDS) {
    const plan = safePlan(ctx, id);
    const isReady = plan.reason == null && plan.steps.length > 0;
    out[id] = {
      enabled: enabled.get(id) ?? false,
      ready: isReady,
      reason: isReady ? null : plan.reason ?? 'Cena indisponível.',
      steps: isReady ? plan.steps.length : 0,
      keys: isReady ? [...plan.steps] : [],
    };
  }
  return out;
}

/**
 * Indice do passo atual na lista de passos de agora. Com as chaves ja
 * mostradas, dado editado com a cena aberta nao revela nem esconde passo: fica
 * no mesmo passo; se ele saiu da cena, volta ao ultimo ja mostrado que ainda
 * existe; se nada do que foi mostrado existe mais, -1 (tela neutra ate o
 * proximo comando). Sem chaves (ex.: depois de recarregar), vale o indice.
 */
export function resolveStep(keys: readonly string[], at: { step: number; shown?: readonly string[] }): number {
  const shown = at.shown ?? [];
  for (let i = shown.length - 1; i >= 0; i--) {
    const found = keys.indexOf(shown[i]);
    if (found >= 0) return found;
  }
  if (shown.length) return -1;
  if (!keys.length) return 0;
  const raw = Number.isFinite(at.step) ? Math.floor(at.step) : 0;
  return Math.min(Math.max(0, raw), keys.length - 1);
}

function safePlan(ctx: LeadViewContext, id: SceneId) {
  try {
    return DEFS[id].plan(ctx);
  } catch {
    // Dado inesperado nunca derruba o cockpit: a cena so fica travada.
    return { reason: 'Dados incompletos para esta cena.', steps: [] as string[] };
  }
}

/**
 * O que a janela do lead mostra. Pausa: tela neutra sem nada da cena. Cena
 * travada (ex.: a nota mudou no meio) ou passo mostrado que saiu da cena:
 * tela neutra, nunca a cena incompleta nem um passo que ninguem revelou.
 */
export function buildLeadView(
  ctx: LeadViewContext,
  state: Pick<PresentationState, 'sceneId' | 'step' | 'curtain'> & { shown?: readonly string[] },
): LeadViewModel {
  const firstName = firstNameOf(ctx.ws.lead.name);
  const neutral = (curtain: boolean): LeadViewModel => ({ v: 1, firstName, curtain, disclaimer: null, scene: null });
  if (state.curtain) return neutral(true);
  if (!state.sceneId) return neutral(false);

  const id = state.sceneId;
  const plan = safePlan(ctx, id);
  if (plan.reason != null || plan.steps.length === 0) return neutral(true);

  const step = resolveStep(plan.steps, state);
  if (step < 0) return neutral(true);
  let scene: SceneVM;
  try {
    scene = DEFS[id].build(ctx, plan, step);
  } catch {
    return neutral(true);
  }
  return {
    v: 1,
    firstName,
    curtain: false,
    disclaimer: sceneMeta(id).result ? ctx.content.aviso_legal : null,
    scene,
  };
}
