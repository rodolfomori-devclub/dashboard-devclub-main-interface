import { FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { openPrintWindow } from '@/lib/diagnostic/pdfBrowser';
import { doneLabel, lessonUrlProblem, SEND_ANCHOR, withPdfGenerated } from '@/lib/diagnostic/send';
import { pdfFileName } from '@diag/pdfHtml.ts';
import { BlockedNote, StepCard, WarnNote, type StepProps } from './StepCard';

function pagesText(pages: number[]): string {
  if (pages.length === 1) return `A página ${pages[0]} passou`;
  return `As páginas ${pages.slice(0, -1).join(', ')} e ${pages[pages.length - 1]} passaram`;
}

/** Passo 4: o PDF pela impressao do navegador (o mesmo HTML da previa). */
export function PdfStep({ api, step, index, now, overflow }: StepProps & { overflow: number[] }) {
  const fileName = pdfFileName(api.model);
  const lessonProblem = lessonUrlProblem(api.ws.diagnosis.lesson_url_override);
  const stale = !!step.stale && !step.blocked;

  // Chamado direto do clique: senao o navegador bloqueia a janela.
  const generate = () => {
    const model = api.model;
    if (!openPrintWindow(model)) {
      toast.error('O navegador bloqueou a janela. Permita pop-ups para este site e tente de novo.');
      return;
    }
    api.update((w) => withPdfGenerated(w, model, new Date().toISOString()));
  };

  let status = 'Pendente';
  if (step.done) status = doneLabel('Preparado para salvar', step.at, now);
  else if (step.blocked) status = 'Travado';
  else if (stale) status = 'Desatualizado';

  let hint = 'Igual à prévia ao lado: 2 páginas com a aula, 3 com o kit de prompts.';
  // Depois de enviado a previa e a versao congelada; com o PDF velho, nao da para garantir que foi a que ele recebeu.
  if (api.frozen) hint = 'A versão marcada como enviada.';

  return (
    <StepCard
      id={SEND_ANCHOR.pdf}
      index={index}
      title="PDF"
      hint={hint}
      done={step.done}
      status={status}
      tone={step.done ? 'done' : step.blocked ? 'muted' : 'pending'}
    >
      {step.blocked && <BlockedNote>{step.reason}</BlockedNote>}
      {stale && <WarnNote>{step.reason}</WarnNote>}
      <div>
        <Button type="button" className="gap-1.5" onClick={generate} disabled={step.blocked || overflow.length > 0}>
          <FileDown className="h-4 w-4" aria-hidden="true" /> Gerar PDF
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Na janela de impressão, escolha "Salvar como PDF". O nome do arquivo já vem certo:{' '}
        <span className="break-all font-medium text-foreground">{fileName}</span>.
      </p>
      {overflow.length > 0 && (
        <WarnNote>{pagesText(overflow)} do tamanho de uma folha A4 na prévia: encurte as frases ou a causa raiz.</WarnNote>
      )}
      {lessonProblem && <WarnNote>Corrija o link da aula no passo 1 antes de gerar o PDF ou apague-o para entregar o kit de prompts.</WarnNote>}
    </StepCard>
  );
}
