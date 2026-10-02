import { useState } from 'react';
import { PenLine, RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CommitmentEditor } from '@/components/diagnostic/capture/CommitmentEditor';
import { commitmentPatch } from '@/lib/diagnostic/cockpit';
import { patchCallData, patchDiagnosis } from '@/lib/diagnostic/workspace';
import { todayYmd } from '@diag/dates.ts';
import { findForbidden } from '@diag/guardrails.ts';
import { PILLAR_ORDER } from '@diag/types.ts';
import { useCockpit } from './cockpitContext';
import { PillarScore } from './PillarScore';
import { ChoiceButton, Note, SectionLabel } from './parts';

function ScoresGrid() {
  const { api } = useCockpit();
  const { model, content } = api;
  const missing = model.missingScores.map((id) => content.pilares.find((p) => p.id === id)?.nome_curto ?? id);
  return (
    <div className="space-y-2">
      <SectionLabel>As 5 notas</SectionLabel>
      {missing.length ? (
        <Note tone="warn">Faltam notas: {missing.join(', ')}. A devolutiva e o PDF precisam das 5.</Note>
      ) : (
        <Note tone="ok">
          Índice {model.total}/25
          {model.strongest ? ` · forte em ${model.strongest.nome_curto}` : ''}
          {model.weakest ? ` · o que mais pesa: ${model.weakest.nome_curto}` : ''}
          {!model.strongest && !model.weakest ? ' · notas iguais nos 5 pontos' : ''}
        </Note>
      )}
      <div className="grid gap-2 md:grid-cols-2">
        {PILLAR_ORDER.map((id) => (
          <PillarScore key={id} pillarId={id} />
        ))}
      </div>
    </div>
  );
}

/** Causa raiz do perfil, ou com as palavras do consultor (vai para o lead: verificador avisa). */
function RootCause() {
  const { api, readOnly, write } = useCockpit();
  const { ws, model, content } = api;
  const override = ws.diagnosis.root_cause_override;
  const [editing, setEditing] = useState(false);
  // Sem perfil confirmado ou sugerido, model.archetype e so um tipo: o texto dele nao vale.
  const profile = model.archetypeSource === 'none' ? null : model.archetype;
  const profileText = (profile?.causa_raiz ?? '').trim();
  const own = editing || override.trim() !== '' || !profileText;
  const forbidden = override ? findForbidden(override, content.guardrails) : [];
  const source = !model.rootCause ? '' : own ? '· com as suas palavras' : `· do perfil ${profile?.nome ?? ''}`;

  return (
    <div className="space-y-2">
      <SectionLabel>Causa raiz {source}</SectionLabel>
      {!model.rootCause && (
        <Note tone="warn">Falta a causa raiz: escreva com as suas palavras ou confirme o perfil na preparação.</Note>
      )}
      {own && !readOnly ? (
        <>
          <Textarea
            value={override}
            onChange={(e) => {
              const value = e.target.value;
              write((w) => patchDiagnosis(w, { root_cause_override: value }));
            }}
            rows={4}
            placeholder={profileText || 'O que está travando ele, com as suas palavras.'}
            aria-label="Causa raiz com as suas palavras"
            className="text-sm"
          />
          {forbidden.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-amber-400">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
              Vai para o diagnóstico do lead. Evite: {forbidden.join(', ')}.
            </p>
          )}
          {profileText && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={() => {
                setEditing(false);
                write((w) => patchDiagnosis(w, { root_cause_override: '' }));
              }}
            >
              <RotateCcw />
              Voltar ao texto do perfil
            </Button>
          )}
        </>
      ) : model.rootCause ? (
        <>
          <p className="text-base leading-relaxed text-foreground">{model.rootCause}</p>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => {
                setEditing(true);
                write((w) => patchDiagnosis(w, { root_cause_override: w.diagnosis.root_cause_override || profileText }));
              }}
            >
              <PenLine />
              Escrever com as minhas palavras
            </Button>
          )}
        </>
      ) : null}
    </div>
  );
}

/** Qual frase dele entra em "você mesmo disse que ..." ({{frase}}). */
function FeaturedQuotePicker() {
  const { api, readOnly, write } = useCockpit();
  const { quotes, call_data: cd } = api.ws.diagnosis;
  const usable = quotes.filter((q) => q.text.trim());
  return (
    <div className="space-y-2">
      <SectionLabel>Frase dele na devolutiva</SectionLabel>
      {usable.length === 0 ? (
        <Note tone="warn">Nenhuma frase guardada ainda. Guarde pelo menos uma no campo de frases.</Note>
      ) : (
        <div role="radiogroup" aria-label="Frase dele na devolutiva" className="flex flex-col gap-1.5">
          {usable.map((q) => (
            <ChoiceButton
              key={q.id}
              selected={cd.featuredQuoteId === q.id}
              disabled={readOnly}
              onClick={() => write((w) => patchCallData(w, { featuredQuoteId: cd.featuredQuoteId === q.id ? null : q.id }))}
            >
              "{q.text}"
            </ChoiceButton>
          ))}
        </div>
      )}
      {usable.length > 0 && !cd.featuredQuoteId && (
        <p className="text-xs text-muted-foreground">Sem escolha, o roteiro usa a primeira frase do diagnóstico.</p>
      )}
    </div>
  );
}

/** Antes de devolver: as notas, a causa raiz e a frase que o roteiro cita. */
export function DevolutivaPrep() {
  return (
    <div className="space-y-5">
      <ScoresGrid />
      <RootCause />
      <FeaturedQuotePicker />
    </div>
  );
}

/** "Qual desses 3 movimentos você começa, e até quando?" */
export function CommitmentCapture() {
  const { api, readOnly, write } = useCockpit();
  const d = api.ws.diagnosis;
  return (
    <div className="space-y-2">
      <SectionLabel>Compromisso com data</SectionLabel>
      <CommitmentEditor
        value={{ text: d.commitment_text, dueDate: d.commitment_due_date, movement: d.commitment_movement }}
        onChange={(p) => write((w) => patchDiagnosis(w, commitmentPatch(p)))}
        plan={api.model.plan}
        todayYmd={todayYmd(Date.now())}
        guardrails={api.content.guardrails}
        readOnly={readOnly}
      />
    </div>
  );
}
