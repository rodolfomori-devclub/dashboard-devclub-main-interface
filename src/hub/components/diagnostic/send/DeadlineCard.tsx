import { Timer } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { deadlineStatus, SEND_ANCHOR, withCallEnded, type DeadlineTone } from '@/lib/diagnostic/send';

const TONE_CLASS: Record<DeadlineTone, string> = {
  idle: 'text-muted-foreground',
  pending: 'text-amber-400',
  late: 'text-red-400',
  onTime: 'text-emerald-400',
  sentLate: 'text-amber-400',
};

/** Fim da call registrado daqui (a call nao foi encerrada no cockpit), com confirmacao. */
function EndCallButton({ api }: { api: ReadyWorkspace }) {
  const neverStarted = !api.ws.session.call_started_at;
  const endCallNow = () => api.update((w) => withCallEnded(w, new Date().toISOString()));

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="shrink-0">
          Marcar a call como encerrada agora
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Marcar a call como encerrada agora?</AlertDialogTitle>
          <AlertDialogDescription>
            Use só depois da call, quando ela não foi encerrada no cockpit. O fim fica registrado agora e o prazo de 2
            horas para entregar começa a contar. No cockpit, a call passa a aparecer como encerrada, sem cronômetro.
            {neverStarted && ' Como ela não foi iniciada no cockpit, o início também fica registrado agora.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={endCallNow}>Marcar como encerrada</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Prazo do playbook: diagnostico por escrito ate 2 horas depois da call. */
export function DeadlineCard({ api, now }: { api: ReadyWorkspace; now: number }) {
  const { ws } = api;
  const status = deadlineStatus(ws.session.call_ended_at, ws.firstSentAt, now);

  return (
    <section
      id={SEND_ANCHOR.deadline}
      aria-label="Prazo de entrega"
      className="glass-card p-4 flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <Timer className={cn('h-5 w-5 shrink-0', TONE_CLASS[status.tone])} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-semibold', TONE_CLASS[status.tone])}>{status.text}</p>
        <p className="text-xs text-muted-foreground">
          {status.detail ?? 'Playbook: o diagnóstico por escrito sai até 2 horas depois da call, fechando ou não.'}
        </p>
      </div>
      {status.tone === 'idle' && api.canEdit && <EndCallButton api={api} />}
    </section>
  );
}
