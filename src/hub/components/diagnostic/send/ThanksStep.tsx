import { Copy, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { openWhatsApp } from '@/lib/whatsapp';
import {
  cleanRecognition,
  deliverByLabel,
  doneLabel,
  minutesSinceCall,
  placeholdersIn,
  SEND_ANCHOR,
  SEND_ANSWER,
  SEND_TICK,
  sendAnswer,
  whatsappReady,
  withSendAnswer,
  withSendTick,
  type SendAnswerKey,
} from '@/lib/diagnostic/send';
import { formatMinutes } from '@/lib/diagnostic/sessionBuckets';
import { findForbidden } from '@diag/guardrails.ts';
import { thanksMessage } from '@diag/texts.ts';
import { COPY_FAILED, copyText } from './dom';
import { MessagePreview, PhoneFix } from './MessageParts';
import { BlockedNote, StepCard, WarnNote, type StepProps } from './StepCard';

/** Playbook (H+0): obrigado pela conversa e quando o diagnostico chega. */
export function ThanksStep({ api, step, index, now }: StepProps) {
  const { ws, model, content } = api;
  // Os dois campos ficam em call_data.answers: recarregar a tela nao apaga o que foi digitado.
  const recognition = sendAnswer(ws, SEND_ANSWER.recognition) ?? '';
  // null = segue o prazo de 2 horas (que muda com o relogio); texto = o que o consultor escreveu.
  const deliverByEdit = sendAnswer(ws, SEND_ANSWER.deliverBy);
  const setAnswer = (key: SendAnswerKey, value: string) => api.update((w) => withSendAnswer(w, key, value));

  const defaultBy = deliverByLabel(ws.session.call_ended_at, now);
  const deliverBy = deliverByEdit ?? defaultBy;
  const cleaned = cleanRecognition(recognition);
  const message = thanksMessage(model, { recognition: cleaned, deliverBy });
  // Os dois campos sao texto do consultor que vai para o lead: avisa, nunca trava.
  const forbidden = [cleaned, deliverByEdit ?? '']
    .flatMap((text) => (text.trim() ? findForbidden(text, content.guardrails) : []))
    .filter((term, i, all) => all.indexOf(term) === i);
  const canCopy = placeholdersIn(message.text).length === 0;
  const wa = whatsappReady(message.text, ws.lead.whatsapp);
  const since = minutesSinceCall(ws.session.call_ended_at, now);

  const mark = () => api.update((w) => withSendTick(w, SEND_TICK.thanks, new Date().toISOString()));
  const copy = async () => {
    if (!(await copyText(message.text))) {
      toast.error(COPY_FAILED);
      return;
    }
    toast.success('Agradecimento copiado.');
    mark();
  };
  const open = () => {
    if (openWhatsApp(ws.lead.whatsapp, { message: message.text })) mark();
  };

  let status = 'Pendente';
  if (step.done) status = doneLabel('Feito', step.at, now);
  else if (step.blocked) status = 'Não se aplica';

  return (
    <StepCard
      id={SEND_ANCHOR.thanks}
      index={index}
      title="Agradecimento (até 30 min depois da call)"
      hint="Curto, enquanto você termina o diagnóstico."
      done={step.done}
      status={status}
      tone={step.done ? 'done' : step.blocked ? 'muted' : 'pending'}
    >
      {step.blocked ? (
        <BlockedNote>{step.reason}</BlockedNote>
      ) : (
        <>
          {since !== null && since > 30 && !step.done && (
            <WarnNote>Já se passaram {formatMinutes(since)} do fim da call. Se ainda for mandar, mande agora.</WarnNote>
          )}
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <div className="space-y-1.5">
              <Label htmlFor="send-thanks-recognition">Deu pra ver que você…</Label>
              <Input
                id="send-thanks-recognition"
                value={recognition}
                onChange={(e) => setAnswer(SEND_ANSWER.recognition, e.target.value)}
                placeholder="entrega muito e quer que isso apareça"
                disabled={!api.canEdit}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="send-thanks-by">Te mando até</Label>
              <Input
                id="send-thanks-by"
                value={deliverBy}
                onChange={(e) => setAnswer(SEND_ANSWER.deliverBy, e.target.value)}
                placeholder="às 16:00"
                disabled={!api.canEdit}
                autoComplete="off"
              />
            </div>
          </div>
          {forbidden.length > 0 && <WarnNote>Vai para o lead. Evite: {forbidden.join(', ')}.</WarnNote>}
          {!defaultBy && deliverByEdit === null && (
            <WarnNote>O prazo de 2 horas já passou: escreva um horário que você consegue cumprir.</WarnNote>
          )}
          <MessagePreview text={message.text} label="Mensagem de agradecimento" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={copy} disabled={!canCopy}>
              <Copy className="h-4 w-4" aria-hidden="true" /> Copiar
            </Button>
            <Button type="button" size="sm" className="gap-1.5" onClick={open} disabled={!wa.ok || !api.canEdit}>
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Abrir no WhatsApp
            </Button>
          </div>
          {!wa.ok && <BlockedNote>{wa.reason}</BlockedNote>}
          <PhoneFix api={api} id="send-thanks-phone" />
        </>
      )}
    </StepCard>
  );
}
