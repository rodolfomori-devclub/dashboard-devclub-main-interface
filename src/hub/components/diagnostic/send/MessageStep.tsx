import { Copy, MessageCircle, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { openWhatsApp } from '@/lib/whatsapp';
import { doneLabel, placeholdersIn, SEND_ANCHOR, SEND_TICK, whatsappReady, withSendTick } from '@/lib/diagnostic/send';
import { deliveryMessage } from '@diag/texts.ts';
import { COPY_FAILED, copyText } from './dom';
import { PhoneFix } from './MessageParts';
import { BlockedNote, StepCard, type StepProps } from './StepCard';

/** Passo 5: o texto do WhatsApp que acompanha o PDF (anexado a mao). */
export function MessageStep({ api, step, index, now }: StepProps) {
  const text = deliveryMessage(api.model);
  const phone = api.ws.lead.whatsapp;
  const wa = whatsappReady(text, phone);
  const canCopy = !step.blocked && placeholdersIn(text).length === 0;

  const mark = () => api.update((w) => withSendTick(w, SEND_TICK.message, new Date().toISOString()));
  const copy = async () => {
    if (!(await copyText(text))) {
      toast.error(COPY_FAILED);
      return;
    }
    toast.success('Mensagem copiada. Anexe o PDF antes de enviar.');
    mark();
  };
  const open = () => {
    if (openWhatsApp(phone, { message: text })) mark();
  };

  let status = 'Pendente';
  if (step.done) status = doneLabel('Usada', step.at, now);
  else if (step.blocked) status = 'Travado';

  return (
    <StepCard
      id={SEND_ANCHOR.message}
      index={index}
      title="Mensagem de entrega"
      hint="Resumo do diagnóstico e o material de presente. Até 2 horas depois da call."
      done={step.done}
      status={status}
      tone={step.done ? 'done' : step.blocked ? 'muted' : 'pending'}
    >
      {step.blocked && <BlockedNote>{step.reason}</BlockedNote>}
      <Textarea readOnly value={text} rows={10} aria-label="Mensagem de entrega" className="resize-none text-sm" />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy} disabled={!canCopy}>
          <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={open}
          disabled={step.blocked || !wa.ok || !api.canEdit}
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> Abrir no WhatsApp
        </Button>
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Paperclip className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Anexe o PDF na conversa antes de enviar.
      </p>
      {!step.blocked && !wa.ok && <BlockedNote>{wa.reason}</BlockedNote>}
      {!step.blocked && <PhoneFix api={api} id="send-message-phone" />}
    </StepCard>
  );
}
