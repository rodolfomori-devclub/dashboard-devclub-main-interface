import { useState } from 'react';
import { CircleCheck, Loader2, RotateCcw, Send, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
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
import { dateTimeLabel, SEND_ANCHOR, SEND_TICK, withSendTick, type DeliveryStep } from '@/lib/diagnostic/send';
import type { ValidationIssue } from '@diag/types.ts';
import { BlockedNote, StepCard, type StepProps } from './StepCard';

/** Passos que deveriam vir antes de "enviado" e ainda nao foram feitos nesta tela (ou ficaram velhos). */
function notYetDone(steps: DeliveryStep[]): string[] {
  const labels: Partial<Record<DeliveryStep['id'], string>> = { pdf: 'gerar o PDF', message: 'mandar a mensagem de entrega' };
  return steps
    .filter((s) => labels[s.id] && !s.done)
    .map((s) => (s.stale ? `${labels[s.id]} de novo (o diagnóstico mudou)` : (labels[s.id] as string)));
}

/** Passo 7: marcar como enviado (congela o que o lead recebeu) ou reabrir para corrigir. */
export function SentStep({ api, step, index, steps }: StepProps & { steps: DeliveryStep[] }) {
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<ValidationIssue[]>([]);
  const pending = notYetDone(steps);

  const markSent = async () => {
    setBusy(true);
    try {
      const result = await api.markSent();
      if (result.ok === false) {
        if (result.issues?.length) setRefused(result.issues);
        else toast.error(result.message ?? 'Não foi possível marcar como enviado.');
        return;
      }
      setRefused([]);
      toast.success('Diagnóstico marcado como enviado.');
    } finally {
      setBusy(false);
    }
  };

  const reopen = async () => {
    setBusy(true);
    try {
      if (await api.reopen()) {
        api.update((w) => withSendTick(w, SEND_TICK.reopened, new Date().toISOString()));
        toast.success('Diagnóstico reaberto. Corrija, gere o PDF de novo e mande a versão nova.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepCard
      id={SEND_ANCHOR.sent}
      index={index}
      title="Marcar como enviado"
      hint="Depois do PDF e da mensagem no WhatsApp do lead."
      done={step.done}
      status={step.done ? 'Enviado' : 'Pendente'}
      tone={step.done ? 'done' : 'pending'}
    >
      {api.frozen ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            {api.ws.sentAt ? `Enviado em ${dateTimeLabel(api.ws.sentAt)}` : 'Enviado'}
          </p>
          <p className="text-xs text-muted-foreground">
            O que o lead recebeu fica travado. Bolsa e nota do CRM continuam editáveis.
          </p>
          {api.canEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={busy}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reabrir para corrigir
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reabrir o diagnóstico?</AlertDialogTitle>
                  <AlertDialogDescription>
                    O lead já recebeu o PDF. Depois de corrigir, gere o PDF de novo, mande a versão nova para ele e marque
                    como enviado outra vez. A reabertura fica registrada.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void reopen()}>Reabrir para corrigir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {step.blocked && <BlockedNote>{step.reason}</BlockedNote>}
          {!step.blocked && pending.length > 0 && (
            <p className="text-xs text-amber-400">
              Ainda não feito nesta tela: {pending.join(' e ')}. Marque como enviado só depois que o lead receber.
            </p>
          )}
          {api.canEdit ? (
            <Button type="button" className="gap-1.5" onClick={() => void markSent()} disabled={busy || step.blocked}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              Marcar como enviado
            </Button>
          ) : (
            <BlockedNote>Só quem conduz a sessão ou o gestor marcam como enviado.</BlockedNote>
          )}
          {refused.length > 0 && api.issues.length > 0 && (
            <ul className="space-y-1 text-sm text-red-400" aria-label="Por que não foi marcado">
              {refused.map((issue) => (
                <li key={issue.field} className="flex items-start gap-1.5">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Ao marcar, o que o lead recebeu fica travado. Para corrigir depois, é preciso reabrir.
          </p>
        </div>
      )}
    </StepCard>
  );
}
