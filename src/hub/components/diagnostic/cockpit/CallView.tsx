import { useState } from 'react';
import { Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { elapsedSeconds, enterShortMode, shouldOfferShortMode } from '@/lib/diagnostic/cockpit';
import { nowIso, useCockpit } from './cockpitContext';
import { useNow } from './hooks';
import { BlockRail } from './BlockRail';
import { BlockPanel } from './BlockPanel';
import { CaptureSide, PrivateNotes } from './CaptureSide';

/** O botao fica na barra do topo; aqui so o lembrete (sem call iniciada nao ha cronometro nem modo curto). */
function NotStartedBanner() {
  const { api, readOnly } = useCockpit();
  if (readOnly || api.ws.session.call_started_at) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
      <Timer className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1">Cronômetro parado. Quando a pessoa entrar, clique em Iniciar call no topo.</span>
    </div>
  );
}

/** Passou do limite sem devolutiva: oferece o modo curto. So oferece, nunca troca sozinho. */
function ShortModeBanner() {
  const { api, readOnly, write } = useCockpit();
  const now = useNow(15_000);
  const [dismissed, setDismissed] = useState(false);
  const session = api.ws.session;
  if (readOnly || dismissed || !session.call_started_at || session.call_ended_at) return null;
  const sec = elapsedSeconds(session.call_started_at, now);
  if (!shouldOfferShortMode(sec == null ? null : sec / 60, api.ws.diagnosis.call_data, api.content)) return null;
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border border-amber-400/50 bg-amber-500/10 px-3 py-2 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 flex-1 text-amber-300">
        <p className="text-sm font-semibold">Passou de {api.content.call.minutos_modo_curto} min. Ir para o modo curto?</p>
        <p className="text-xs">Devolutiva, compromisso com data e encerramento.</p>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setDismissed(true)}>
          Agora não
        </Button>
        <Button type="button" size="sm" className="h-8" onClick={() => write((w) => enterShortMode(w, nowIso()))}>
          Ir para a devolutiva
        </Button>
      </div>
    </div>
  );
}

/** A call: blocos, o bloco atual e a captura. Coluna estreita ou tres colunas. */
export function CallView({ wide }: { wide: boolean }) {
  if (wide) {
    return (
      <div className="grid grid-cols-[200px_minmax(0,1fr)_300px] items-start gap-4 xl:grid-cols-[240px_minmax(0,1fr)_360px]">
        <div className="sticky top-[4.25rem] max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
          <BlockRail orientation="vertical" />
        </div>
        <div className="min-w-0 space-y-3">
          <NotStartedBanner />
          <ShortModeBanner />
          <BlockPanel />
        </div>
        <div className="sticky top-[4.25rem] max-h-[calc(100vh-5rem)] overflow-y-auto pr-1">
          <CaptureSide />
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <BlockRail orientation="horizontal" />
      <NotStartedBanner />
      <ShortModeBanner />
      <BlockPanel />
      <div className="glass-card p-4">
        <PrivateNotes />
      </div>
    </div>
  );
}
