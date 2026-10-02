import { ClipboardCopy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { doneLabel, SEND_ANCHOR, withCrmCopied } from '@/lib/diagnostic/send';
import { COPY_FAILED, copyText } from './dom';
import { BlockedNote, StepCard, WarnNote, type StepProps } from './StepCard';

/**
 * Passo 6: nota interna para colar no card do lead no Nold (pode ter termos
 * internos). `note` vem pronta (crmNoteFor): a mesma que decide se a copia ficou velha.
 */
export function CrmStep({ api, step, index, now, note }: StepProps & { note: string }) {
  const copy = async () => {
    if (!(await copyText(note))) {
      toast.error(COPY_FAILED);
      return;
    }
    toast.success('Nota copiada. Cole no card do lead no Nold.');
    api.update((w) => withCrmCopied(w, note, new Date().toISOString()));
  };

  let status = 'Pendente';
  if (step.done) status = doneLabel('Copiada', step.at, now);
  else if (step.stale && !step.blocked) status = 'Desatualizada';

  return (
    <StepCard
      id={SEND_ANCHOR.crm}
      index={index}
      title="Nota do CRM (Nold)"
      hint="O registro oficial do lead. Copie e cole no card dele."
      done={step.done}
      status={status}
      tone={step.done ? 'done' : 'pending'}
    >
      {step.blocked && <BlockedNote>{step.reason}</BlockedNote>}
      {!step.blocked && step.stale && <WarnNote>{step.reason}</WarnNote>}
      <Textarea readOnly value={note} rows={12} aria-label="Nota do CRM" className="resize-none font-mono text-xs" />
      <div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy} disabled={step.blocked}>
          <ClipboardCopy className="h-4 w-4" aria-hidden="true" /> Copiar nota
        </Button>
      </div>
    </StepCard>
  );
}
