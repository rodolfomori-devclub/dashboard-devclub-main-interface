import { CircleCheck, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CommitmentEditor, type CommitmentValue } from '@/components/diagnostic/capture/CommitmentEditor';
import { QuotesEditor } from '@/components/diagnostic/capture/QuotesEditor';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { ISSUE_ANCHOR, SEND_ANCHOR } from '@/lib/diagnostic/send';
import { withGraduation } from '@/lib/diagnostic/sendScholarship';
import { patchDiagnosis, patchLead, type DiagnosisFields } from '@/lib/diagnostic/workspace';
import { todayYmd } from '@diag/dates.ts';
import type { Graduation, ValidationIssue } from '@diag/types.ts';
import { scrollToId } from './dom';
import { useLatch } from './hooks';
import { ConsultantFields, LessonUrlField, RootCauseField } from './PdfTextFields';
import { ScoresReview } from './ScoresReview';
import { StepCard, SubSection, WarnNote, type StepProps } from './StepCard';

const GRADUATION_OPTIONS: { value: Exclude<Graduation, ''>; label: string }[] = [
  { value: 'concluida', label: 'Concluída' },
  { value: 'nao', label: 'Não tem' },
  { value: 'cursando', label: 'Cursando' },
];

function IssueList({ issues }: { issues: ValidationIssue[] }) {
  if (!issues.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-400">
        <CircleCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
        Tudo certo para gerar o PDF e marcar como enviado.
      </p>
    );
  }
  return (
    <ul className="space-y-1.5 rounded-md border border-amber-400/30 bg-amber-500/10 p-3" aria-label="O que falta">
      {issues.map((issue) => (
        <li key={issue.field}>
          <button
            type="button"
            onClick={() => scrollToId(ISSUE_ANCHOR[issue.field])}
            className="flex items-start gap-2 text-left text-sm text-amber-300 hover:underline"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {issue.message}
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Nome e graduacao, so quando faltavam (ficam na tela ate o fim para corrigir). */
function LeadFields({ api, readOnly }: { api: ReadyWorkspace; readOnly: boolean }) {
  const { lead } = api.ws;
  const showName = useLatch(!lead.name.trim());
  const showGraduation = useLatch(!lead.graduation_status);
  if (!showName && !showGraduation) return null;

  const onGraduation = (value: Graduation) => {
    const resetsBolsa = value === 'cursando' && api.ws.diagnosis.scholarship_status !== 'none';
    api.update((w) => withGraduation(w, value));
    if (resetsBolsa) toast.info('A bolsa voltou para "Não apresentada": quem está cursando graduação não tem bolsa.');
  };

  return (
    <SubSection id={ISSUE_ANCHOR.name} title="Lead">
      <div className="grid gap-3 sm:grid-cols-2">
        {showName && (
          <div className="space-y-1.5">
            <Label htmlFor="send-lead-name">Nome do lead</Label>
            <Input
              id="send-lead-name"
              value={lead.name}
              onChange={(e) => api.update((w) => patchLead(w, { name: e.target.value }))}
              placeholder="Nome e sobrenome"
              disabled={readOnly}
              autoComplete="off"
            />
          </div>
        )}
        {showGraduation && (
          <div className="space-y-1.5">
            <Label htmlFor="send-lead-graduation">Graduação</Label>
            <Select
              value={lead.graduation_status}
              onValueChange={(v) => onGraduation(v as Graduation)}
              disabled={readOnly}
            >
              <SelectTrigger id="send-lead-graduation">
                <SelectValue placeholder="Escolha" />
              </SelectTrigger>
              <SelectContent>
                {GRADUATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Define a credencial que vai no PDF.</p>
          </div>
        )}
      </div>
      {lead.graduation_status === 'cursando' && (
        <WarnNote>
          Quem está cursando graduação não entra no MBA nem na Extensão. Entregue o diagnóstico normalmente e não apresente bolsa.
        </WarnNote>
      )}
    </SubSection>
  );
}

/** Passo 1: o que falta para entregar, corrigido aqui mesmo, sem voltar a call. */
export function CompleteStep({ api, step, index, now }: StepProps) {
  const { ws, model, content, issues } = api;
  const d = ws.diagnosis;
  const readOnly = !api.canEdit || api.frozen;

  const commitment: CommitmentValue = {
    text: d.commitment_text,
    dueDate: d.commitment_due_date,
    movement: d.commitment_movement,
  };
  const onCommitment = (p: Partial<CommitmentValue>) => {
    const patch: Partial<DiagnosisFields> = {};
    if (p.text !== undefined) patch.commitment_text = p.text;
    if (p.dueDate !== undefined) patch.commitment_due_date = p.dueDate;
    if (p.movement !== undefined) patch.commitment_movement = p.movement;
    api.update((w) => patchDiagnosis(w, patch));
  };

  return (
    <StepCard
      id={SEND_ANCHOR.complete}
      index={index}
      title="Completar o diagnóstico"
      hint="O que falta para gerar o PDF e marcar como enviado. Corrija aqui mesmo, sem voltar à call."
      done={step.done}
      status={step.done ? 'Pronto' : step.reason}
      tone={step.done ? 'done' : 'pending'}
    >
      <IssueList issues={issues} />
      {api.frozen && api.canEdit && (
        <p className="text-xs text-muted-foreground">
          Só leitura: o lead já recebeu este diagnóstico. Para corrigir, reabra no passo 7.
        </p>
      )}
      <LeadFields api={api} readOnly={readOnly} />
      <ConsultantFields api={api} readOnly={readOnly} />
      <ScoresReview api={api} readOnly={readOnly} />
      <SubSection
        id={ISSUE_ANCHOR.commitmentText}
        title="Compromisso com data"
        hint="O movimento que ele escolheu e até quando. É o motivo do próximo contato."
      >
        <CommitmentEditor
          value={commitment}
          onChange={onCommitment}
          plan={model.plan}
          todayYmd={todayYmd(now)}
          guardrails={content.guardrails}
          readOnly={readOnly}
        />
      </SubSection>
      <SubSection id="send-quotes" title="Frases no diagnóstico" hint="As palavras dele, entre aspas. Até 3 vão para o PDF.">
        <QuotesEditor
          quotes={d.quotes}
          onChange={(quotes) => api.update((w) => patchDiagnosis(w, { quotes }))}
          defaultTag="outro"
          readOnly={readOnly}
        />
      </SubSection>
      <RootCauseField api={api} readOnly={readOnly} />
      <LessonUrlField api={api} readOnly={readOnly} />
    </StepCard>
  );
}
