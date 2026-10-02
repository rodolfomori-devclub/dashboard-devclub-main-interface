import { useMemo } from 'react';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { LeadStage } from '@/components/diagnostic/lead/LeadStage';
import { buildLeadView, sceneStatus, type LeadViewContext } from '@/lib/diagnostic/leadView';
import { patchCallData, patchDiagnosis } from '@/lib/diagnostic/workspace';
import { formatBRL } from '@diag/dates.ts';
import type { OfferView } from '@diag/types.ts';

// So para a previa (nunca gravado): o pedido do lead acontece na call.
const PREVIEW_REQUESTED_AT = '2000-01-01T00:00:00.000Z';

function summaryLines(view: OfferView): string[] {
  const lines: string[] = [];
  if (view.anchor !== null) lines.push(`Preço de tabela: ${formatBRL(view.anchor)}`);
  if (view.finalPrice !== null) {
    lines.push(`Com a bolsa: ${formatBRL(view.finalPrice)}${view.discount ? ` (bolsa de ${formatBRL(view.discount)})` : ''}`);
  }
  for (const p of view.paths) {
    lines.push(p.installments > 1 ? `${p.label}: ${p.installments}x de ${formatBRL(p.installmentValue)}` : `${p.label}: ${formatBRL(p.total)}`);
  }
  if (view.seatsLeft !== null) {
    lines.push(`Bolsas restantes: ${view.seatsLeft}${view.seatsConfirmedOnBR ? ` (confirmado em ${view.seatsConfirmedOnBR})` : ''}`);
  }
  if (view.validUntilBR) lines.push(`Condição válida até ${view.validUntilBR}`);
  return lines;
}

/**
 * "Como aparece para o lead": a cena da bolsa no ultimo passo, montada pelo
 * mesmo buildLeadView da call. O pedido e o custo dito sao simulados (so
 * acontecem na call); as outras travas (cursando, sem bolsas, oferta vazia)
 * valem como na call e, travada, a previa vira um resumo com o motivo.
 */
export function OfferPreview({ api }: { api: ReadyWorkspace }) {
  const { ws, model, content, offer } = api;
  const ctx = useMemo<LeadViewContext>(() => {
    const asked = patchDiagnosis(ws, { offer_requested_at: ws.diagnosis.offer_requested_at ?? PREVIEW_REQUESTED_AT });
    return { ws: patchCallData(asked, { costStated: true }), model, content, offer };
  }, [ws, model, content, offer]);

  const vm = buildLeadView(ctx, { sceneId: 'bolsa', step: Number.MAX_SAFE_INTEGER, curtain: false });

  if (vm.scene) {
    return (
      <figure className="space-y-1.5">
        <LeadStage vm={vm} className="aspect-video w-full rounded-md border border-border" />
        <figcaption className="text-xs text-muted-foreground">Prévia do último passo, como fica quando ele pede para ver a bolsa.</figcaption>
      </figure>
    );
  }

  const reason = sceneStatus(ctx).bolsa.reason;
  const lines = summaryLines(offer.view);
  return (
    <div className="rounded-md border border-dashed border-border p-3 space-y-1.5 text-xs">
      {reason && <p className="text-amber-400">A cena não abre assim: {reason}</p>}
      {lines.length > 0 ? (
        <ul className="space-y-0.5 text-foreground">
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">Nada da oferta pode aparecer ainda.</p>
      )}
    </div>
  );
}
