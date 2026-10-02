import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchLead, patchQualification, type QualificationFields } from '@/lib/diagnostic/workspace';
import { GRADUATION_LABEL } from '@/lib/diagnostic/prepChecklist';
import type { Graduation } from '@diag/types.ts';
import { PREP_SECTION } from './anchors';
import { ChoiceSelect, Field, Notice } from './fields';
import { PrepCard } from './PrepCard';

const DECISION_OPTIONS = Array.from({ length: 11 }, (_, n) => ({ value: String(n), label: String(n) }));
const YES_NO = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
];
const GRADUATION_OPTIONS = [
  { value: 'concluida', label: 'Concluída' },
  { value: 'cursando', label: 'Cursando' },
  { value: 'nao', label: 'Não tem' },
];

const fromBool = (v: boolean | null): string => (v === true ? 'sim' : v === false ? 'nao' : '');
const toBool = (v: string): boolean | null => (v === 'sim' ? true : v === 'nao' ? false : null);
const warn = (text: string) => <span className="text-amber-400">{text}</span>;
const gradLabel = (g: Graduation): string => (g ? GRADUATION_LABEL[g] : 'não confirmada');

/** As 4 perguntas de compromisso que o SDR registrou, e a graduacao que ele confirmou. */
export function SdrCard({ api }: { api: ReadyWorkspace }) {
  const { ws } = api;
  const q = ws.qualification;
  const readOnly = !api.canEdit;
  const leadLocked = !api.canEdit || api.frozen;
  const setQ = (p: Partial<QualificationFields>) => api.update((w) => patchQualification(w, p));

  const sdrGrad = q.graduation_confirmed;
  const leadGrad = ws.lead.graduation_status;
  const mismatch = sdrGrad !== '' && sdrGrad !== leadGrad;

  return (
    <PrepCard
      id={PREP_SECTION.sdr}
      icon={ClipboardList}
      title="Anotações do SDR"
      description="As perguntas de compromisso da ligação. A dor e a nota voltam na conversa, com as palavras dele."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="prep-sdr-name" label="SDR">
          <Input
            id="prep-sdr-name"
            value={q.sdr_name}
            placeholder="Quem fez a ligação"
            onChange={(e) => setQ({ sdr_name: e.target.value })}
            disabled={readOnly}
            className="h-9"
          />
        </Field>
        <Field
          id="prep-sdr-decision"
          label="Nota de decisão (0 a 10)"
          hint={
            q.decision_score !== null && q.decision_score < 7
              ? warn('Abaixo de 7: na call, entenda o que faria virar um 8.')
              : 'Na Implicação: "O que faz ela ser tão alta?"'
          }
        >
          <ChoiceSelect
            id="prep-sdr-decision"
            value={q.decision_score === null ? '' : String(q.decision_score)}
            options={DECISION_OPTIONS}
            onChange={(v) => setQ({ decision_score: v === '' ? null : Number(v) })}
            emptyLabel="Sem nota"
            disabled={readOnly}
          />
        </Field>
      </div>

      <Field id="prep-sdr-pain" label="A dor nas palavras dele" hint="Anote igual ao que ele disse ao SDR.">
        <Textarea
          id="prep-sdr-pain"
          rows={3}
          value={q.pain_text}
          placeholder="Ex.: A vaga de coordenação foi pra alguém de fora."
          onChange={(e) => setQ({ pain_text: e.target.value })}
          disabled={readOnly}
          className="text-sm"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          id="prep-sdr-status-quo"
          label="Tudo bem ficar como está daqui a um ano?"
          hint={q.accepts_status_quo === true ? warn('Disse que sim: na Implicação, deixe ele falar do custo com calma.') : undefined}
        >
          <ChoiceSelect
            id="prep-sdr-status-quo"
            value={fromBool(q.accepts_status_quo)}
            options={YES_NO}
            onChange={(v) => setQ({ accepts_status_quo: toBool(v) })}
            emptyLabel="Não perguntado"
            disabled={readOnly}
          />
        </Field>
        <Field
          id="prep-sdr-commits"
          label="Se comprometeu a aplicar o plano?"
          hint={q.commits_to_apply === false ? warn('Sem compromisso: retome o combinado logo na abertura.') : undefined}
        >
          <ChoiceSelect
            id="prep-sdr-commits"
            value={fromBool(q.commits_to_apply)}
            options={YES_NO}
            onChange={(v) => setQ({ commits_to_apply: toBool(v) })}
            emptyLabel="Não perguntado"
            disabled={readOnly}
          />
        </Field>
        <Field id="prep-sdr-graduation" label="Graduação confirmada pelo SDR">
          <ChoiceSelect
            id="prep-sdr-graduation"
            value={sdrGrad}
            options={GRADUATION_OPTIONS}
            onChange={(v) => setQ({ graduation_confirmed: v as Graduation })}
            emptyLabel="Não confirmada"
            disabled={readOnly}
          />
        </Field>
      </div>

      {mismatch && (
        <Notice tone="warn">
          <p>
            {`O SDR anotou "${gradLabel(sdrGrad)}", e a ficha do lead diz "${gradLabel(leadGrad)}". O diagnóstico usa a ficha do lead.`}
          </p>
          {!leadLocked && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => api.update((w) => patchLead(w, { graduation_status: sdrGrad }))}
            >
              Usar na ficha do lead
            </Button>
          )}
        </Notice>
      )}
    </PrepCard>
  );
}
