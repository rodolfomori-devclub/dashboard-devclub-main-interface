import { useState } from 'react';
import { ChevronDown, MonitorPlay } from 'lucide-react';
import { SceneControl } from '@/components/diagnostic/SceneControl';
import { cn } from '@/lib/utils';
import { isSceneId, sceneMeta } from '@/lib/diagnostic/presentation';
import { useCockpit } from './cockpitContext';
import { CaptureSide } from './CaptureSide';
import { Note } from './parts';

interface Props {
  /** Esta parte da tela esta a vista (aba "Tela do lead" ou topo da Call no estreito). */
  visible: boolean;
  narrow: boolean;
  /** So monta depois de saber se esta janela tem o lock: duas janelas nunca transmitem juntas. */
  ready: boolean;
  lockDenied: boolean;
}

/** O que esta na tela do lead, pelo retrato que o controle de cenas guarda na ficha. */
function useOnScreenLabel(): string | null {
  const { api, readOnly } = useCockpit();
  const p = api.ws.diagnosis.call_data.presentation;
  if (readOnly || !p) return null;
  if (p.curtain) return 'pausada';
  return p.sceneId && isSceneId(p.sceneId) ? `na tela: ${sceneMeta(p.sceneId).label}` : null;
}

/**
 * Controle da tela do lead. Fica sempre montado (o transporte e os atalhos
 * seguem vivos em qualquer aba) e so muda de lugar e de layout. Na tela larga
 * a captura de frases fica ao lado: a melhor frase costuma vir logo depois de
 * uma reportagem.
 */
export function LeadScreenSlot({ visible, narrow, ready, lockDenied }: Props) {
  const { api, readOnly } = useCockpit();
  const [open, setOpen] = useState(false);
  const onScreen = useOnScreenLabel();
  return (
    <div className={cn(!visible && 'hidden', narrow && 'mb-3')}>
      {narrow && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="cockpit-lead-screen"
          className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground"
        >
          <span className="flex min-w-0 items-center gap-2">
            <MonitorPlay className="h-4 w-4 shrink-0" aria-hidden="true" />
            Tela do lead
            {onScreen && <span className="truncate text-xs font-normal text-muted-foreground">· {onScreen}</span>}
          </span>
          <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      )}
      <div
        id="cockpit-lead-screen"
        className={cn(
          narrow ? 'mt-2' : 'grid grid-cols-[minmax(0,1fr)_300px] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]',
          narrow && !open && 'hidden',
        )}
      >
        {lockDenied ? (
          <Note>A tela do lead é controlada pela janela onde esta call já está aberta.</Note>
        ) : ready ? (
          <SceneControl
            ws={api.ws}
            model={api.model}
            content={api.content}
            offer={api.offer}
            update={api.update}
            readOnly={readOnly}
            layout={narrow ? 'narrow' : 'wide'}
          />
        ) : null}
        {!narrow && (
          <div className="sticky top-[4.25rem] max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
            <CaptureSide />
          </div>
        )}
      </div>
    </div>
  );
}
