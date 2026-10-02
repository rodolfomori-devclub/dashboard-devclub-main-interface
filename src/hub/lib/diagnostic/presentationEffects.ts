/**
 * O que um ACK da tela do lead registra no diagnostico. So conta o que a tela
 * confirmou ter aplicado:
 * - reportagem revelada no mercado entra em news_shown_ids (no maximo 2);
 * - bolsa com valor ou caminhos na tela grava offer_shown uma vez e marca a
 *   bolsa como apresentada.
 */
import type { Workspace } from '@/lib/diagnostic/workspace';
import type { AckMessage } from '@/lib/diagnostic/presentationTransport';
import { mercadoArticleIdAt, offerRevealedAt, type LeadViewContext } from '@/lib/diagnostic/leadView';

export const MAX_NEWS_SHOWN = 2;

export function hasOfferShown(offerShown: Record<string, unknown> | null | undefined): boolean {
  return !!offerShown && typeof offerShown.shownAt === 'string' && offerShown.shownAt !== '';
}

/** Atualizacao do workspace para este ACK, ou null quando nao ha nada a registrar. */
export function ackWorkspaceUpdate(
  ack: Pick<AckMessage, 'sceneId' | 'step'>,
  ctx: LeadViewContext,
  nowIso: string,
): ((ws: Workspace) => Workspace) | null {
  if (ack.sceneId === 'mercado') {
    const id = mercadoArticleIdAt(ctx, ack.step);
    const ids = ctx.ws.diagnosis.news_shown_ids;
    if (!id || ids.includes(id) || ids.length >= MAX_NEWS_SHOWN) return null;
    return (ws) => {
      const current = ws.diagnosis.news_shown_ids;
      if (current.includes(id) || current.length >= MAX_NEWS_SHOWN) return ws;
      return { ...ws, diagnosis: { ...ws.diagnosis, news_shown_ids: [...current, id] } };
    };
  }
  if (ack.sceneId === 'bolsa') {
    // Com preco de tabela, o passo 0 e so a ancora: conta a partir do valor com bolsa.
    if (hasOfferShown(ctx.ws.diagnosis.offer_shown) || !offerRevealedAt(ctx, ack.step)) return null;
    const view = ctx.offer.view;
    return (ws) => {
      if (hasOfferShown(ws.diagnosis.offer_shown)) return ws;
      const status = ws.diagnosis.scholarship_status === 'none' ? 'presented' : ws.diagnosis.scholarship_status;
      return {
        ...ws,
        diagnosis: { ...ws.diagnosis, offer_shown: { shownAt: nowIso, view }, scholarship_status: status },
      };
    };
  }
  return null;
}
