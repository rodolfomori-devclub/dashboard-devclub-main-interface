import { useMemo, useState } from 'react';
import { PdfPreview } from '@/components/diagnostic/PdfPreview';
import { WorkspaceHeader, type ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { deliverySteps, stepById } from '@/lib/diagnostic/send';
import { crmNoteFor } from '@/lib/diagnostic/sendScholarship';
import { CompleteStep } from './CompleteStep';
import { CrmStep } from './CrmStep';
import { DeadlineCard } from './DeadlineCard';
import { useNow } from './hooks';
import { MessageStep } from './MessageStep';
import { PdfStep } from './PdfStep';
import { ScholarshipStep } from './ScholarshipStep';
import { SentStep } from './SentStep';
import { ThanksStep } from './ThanksStep';

/**
 * Entrega depois da call: completar o que faltou, agradecer, registrar a bolsa,
 * gerar o PDF, mandar no WhatsApp, registrar no Nold e marcar como enviado, em
 * ate 2 horas. A bolsa vem antes porque muda o PDF e a nota do CRM.
 * Passos a esquerda; a previa do PDF fica fixa a direita (abaixo no celular).
 */
export function SendView({ api }: { api: ReadyWorkspace }) {
  const now = useNow(30_000);
  const [overflow, setOverflow] = useState<number[]>([]);
  const { ws, input, model, content, offer, issues } = api;
  const note = useMemo(() => crmNoteFor({ ws, input, model, content, offer }), [ws, input, model, content, offer]);
  const steps = useMemo(() => deliverySteps(ws, model, issues, note), [ws, model, issues, note]);
  const common = { api, now };

  return (
    <div className="page-container space-y-5">
      <WorkspaceHeader api={api} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-4">
          <DeadlineCard api={api} now={now} />
          <CompleteStep {...common} step={stepById(steps, 'complete')} index={1} />
          <ThanksStep {...common} step={stepById(steps, 'thanks')} index={2} />
          <ScholarshipStep {...common} step={stepById(steps, 'scholarship')} index={3} />
          <PdfStep {...common} step={stepById(steps, 'pdf')} index={4} overflow={overflow} />
          <MessageStep {...common} step={stepById(steps, 'message')} index={5} />
          <CrmStep {...common} step={stepById(steps, 'crm')} index={6} note={note} />
          <SentStep {...common} step={stepById(steps, 'sent')} index={7} steps={steps} />
        </div>
        <aside
          aria-label="Prévia do PDF"
          className="h-[80vh] min-w-0 lg:sticky lg:top-4 lg:h-[calc(100vh-5.5rem)]"
        >
          <PdfPreview model={api.model} onOverflow={setOverflow} className="h-full" />
        </aside>
      </div>
    </div>
  );
}
