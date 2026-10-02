/**
 * Controle da tela do lead dentro do cockpit: abre a janela compartilhada,
 * mostra se ela esta ao vivo, navega por cenas e passos e mostra a miniatura
 * do que o lead ve. Segue o design do Hub; so a miniatura usa a identidade da
 * tela do lead. Funciona sem a tela aberta.
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Lock, Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import type { DiagnosisModel, DiagnosticContent, OfferEvaluation } from '@diag/types.ts';
import { Button } from '@/components/ui/button';
import { LeadStage } from '@/components/diagnostic/lead/LeadStage';
import { cn } from '@/lib/utils';
import type { Workspace } from '@/lib/diagnostic/workspace';
import { sceneMeta } from '@/lib/diagnostic/presentation';
import { connectionStatus, type LeadConnection } from '@/lib/diagnostic/presentationTransport';
import { useLeadPresentation, type LeadLink, type LeadPresentation } from './useLeadPresentation';

export interface SceneControlProps {
  ws: Workspace;
  model: DiagnosisModel;
  content: DiagnosticContent;
  offer: OfferEvaluation;
  update: (fn: (ws: Workspace) => Workspace) => void;
  readOnly?: boolean;
  layout?: 'wide' | 'narrow';
}

const CONNECTION: Record<LeadConnection, { label: string; className: string }> = {
  live: { label: 'ao vivo', className: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' },
  background: { label: 'em segundo plano, pode congelar', className: 'border-warning/40 bg-warning/15 text-warning' },
  disconnected: { label: 'desconectada', className: 'border-destructive/40 bg-destructive/10 text-error' },
  closed: { label: 'fechada', className: 'border-border bg-muted text-muted-foreground' },
};

function ConnectionChip({ link }: { link: LeadLink }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const status = connectionStatus(
    { lastAckAt: link.lastAckAt, visibility: link.ack?.visibility ?? null, byeAt: link.byeAt },
    now,
  );
  const c = CONNECTION[status];
  return (
    <span
      role="status"
      className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium', c.className)}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      Tela do lead: {c.label}
    </span>
  );
}

function appliedLabel(link: LeadLink): string {
  const a = link.ack;
  if (!a) return 'A tela do lead ainda não confirmou nada.';
  if (!a.sceneId) return 'aplicado: tela neutra';
  return `aplicado: passo ${a.step + 1} · ${sceneMeta(a.sceneId).label}`;
}

function CurrentScene({ p }: { p: LeadPresentation }) {
  const { state, statuses, step, steps } = p;
  const meta = state.sceneId ? sceneMeta(state.sceneId) : null;
  const status = state.sceneId ? statuses[state.sceneId] : null;
  return (
    <div className="rounded-md border border-border bg-muted/40 px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {state.curtain ? 'Tela pausada: o lead vê a tela neutra' : 'Na tela do lead'}
      </p>
      <p className="font-semibold text-foreground">{meta ? meta.label : 'Tela de espera'}</p>
      {meta && status?.ready && step >= 0 && (
        <p className="text-sm text-muted-foreground">
          passo {step + 1} de {steps}
        </p>
      )}
      {meta && status?.ready && step < 0 && (
        <p className="text-sm text-warning">
          O passo que estava na tela saiu da cena quando os dados mudaram. O lead vê a tela neutra: revele o próximo
          para seguir.
        </p>
      )}
      {meta && status && !status.ready && (
        <p className="text-sm text-warning">Cena travada: {status.reason} O lead vê a tela neutra.</p>
      )}
      {!meta && <p className="text-sm text-muted-foreground">"Revelar próximo" abre a primeira cena pronta.</p>}
    </div>
  );
}

function SceneList({ p, readOnly, compact }: { p: LeadPresentation; readOnly: boolean; compact: boolean }) {
  const { order, statuses, state, actions } = p;
  let n = 0;
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cenas na ordem da preparação</p>
      <ol className={cn('flex flex-col', compact ? 'gap-1' : 'gap-1.5')}>
        {order.map((o) => {
          const st = statuses[o.id];
          const meta = sceneMeta(o.id);
          const isCurrent = state.sceneId === o.id;
          const number = o.enabled ? ++n : null;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => actions.jumpTo(o.id)}
                disabled={readOnly || !st.ready}
                aria-current={isCurrent ? 'true' : undefined}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md border text-left transition-colors disabled:cursor-not-allowed',
                  compact ? 'px-2.5 py-1.5' : 'px-3 py-2',
                  isCurrent ? 'border-primary bg-primary/10' : 'border-border enabled:hover:bg-accent',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    st.ready && o.enabled ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  {number ?? '–'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className={cn('text-sm font-medium', o.enabled ? 'text-foreground' : 'text-muted-foreground')}>
                      {meta.label}
                    </span>
                    {isCurrent && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                        na tela
                      </span>
                    )}
                    {!o.enabled && (
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        desligada
                      </span>
                    )}
                  </span>
                  <span className="flex items-start gap-1 text-xs text-muted-foreground">
                    {!st.ready && <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />}
                    <span>{st.ready ? `${st.steps} ${st.steps === 1 ? 'passo' : 'passos'}` : st.reason}</span>
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function SceneControl(props: SceneControlProps) {
  const { readOnly = false, layout = 'wide' } = props;
  const p = useLeadPresentation(props);
  const { state, vm, link, can, actions } = p;
  const wide = layout === 'wide';
  const [popupBlocked, setPopupBlocked] = useState(false);

  // data-scene-control: Espaco num botao daqui revela o proximo passo (sceneShortcuts.ts).
  return (
    <section aria-label="Tela do lead" data-scene-control="" className="glass-card flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConnectionChip link={link} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setPopupBlocked(!actions.openWindow())}
            disabled={readOnly}
          >
            <ExternalLink />
            Abrir tela do lead
          </Button>
          <Button
            type="button"
            size="sm"
            variant={state.curtain ? 'default' : 'outline'}
            onClick={actions.curtain}
            disabled={readOnly}
            aria-pressed={state.curtain}
            title="Alt+B"
          >
            {state.curtain ? <Play /> : <Pause />}
            {state.curtain ? 'Voltar a mostrar' : 'Pausar tela'}
          </Button>
        </div>
      </div>
      {popupBlocked && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/15 px-3 py-2 text-sm text-warning">
          O navegador bloqueou a janela. Permita pop-ups para este site e clique de novo.
        </p>
      )}

      <div className={cn('grid gap-4', wide && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}>
        <div className="flex min-w-0 flex-col gap-3">
          <CurrentScene p={p} />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" onClick={actions.prev} disabled={!can.prev} title="Alt+K">
              <ChevronLeft />
              Voltar
            </Button>
            <Button type="button" size="sm" onClick={actions.next} disabled={!can.next} title="Espaço, seta para a direita ou Alt+L">
              Revelar próximo
              <ChevronRight />
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={actions.prevScene} disabled={!can.prevScene} title="Alt+,">
              <SkipBack />
              Cena anterior
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={actions.nextScene} disabled={!can.nextScene} title="Alt+.">
              Próxima cena
              <SkipForward />
            </Button>
          </div>
          <figure className="flex flex-col gap-1.5">
            <div
              role="img"
              aria-label="Prévia da tela do lead"
              className="relative aspect-video w-full overflow-hidden rounded-md border border-border"
            >
              <LeadStage vm={vm} className="lead-fill-parent" />
            </div>
            <figcaption className="text-xs text-muted-foreground">{appliedLabel(link)}</figcaption>
          </figure>
        </div>
        <SceneList p={p} readOnly={readOnly} compact={!wide} />
      </div>

      {!readOnly && (
        <p className="text-xs text-muted-foreground">
          Atalhos (fora dos campos de texto): Espaço ou → revela · Alt+L próximo · Alt+K volta · Alt+. e Alt+,
          trocam de cena · Alt+B pausa
        </p>
      )}
    </section>
  );
}
