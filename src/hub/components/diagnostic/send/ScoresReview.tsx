import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScoreSelector } from '@/components/diagnostic/capture/ScoreSelector';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { LEVEL_TEXT_CLASS } from '@/lib/diagnostic/capture';
import { ISSUE_ANCHOR } from '@/lib/diagnostic/send';
import { patchCallData, patchDiagnosis, SCORE_COLUMNS, scoresOf, type DiagnosisFields } from '@/lib/diagnostic/workspace';
import { findPillar } from '@diag/content.ts';
import { levelOf } from '@diag/derive.ts';
import { PILLAR_ORDER, type Pillar, type PillarId } from '@diag/types.ts';
import { SubSection } from './StepCard';

/** As 5 notas: resumo sempre visivel; as que faltam abrem o seletor. */
export function ScoresReview({ api, readOnly }: { api: ReadyWorkspace; readOnly: boolean }) {
  const { ws, content } = api;
  const scores = scoresOf(ws);
  const pillars = PILLAR_ORDER.map((id) => findPillar(content, id)).filter((p): p is Pillar => !!p);
  const missingKey = pillars
    .filter((p) => scores[p.id] === null)
    .map((p) => p.id)
    .join(',');
  const [opened, setOpened] = useState<string[]>(() => (missingKey ? missingKey.split(',') : []));
  const [showAll, setShowAll] = useState(false);

  // A nota que faltava continua aberta depois de escolhida (senao o seletor some no clique).
  useEffect(() => {
    if (!missingKey) return;
    const ids = missingKey.split(',');
    setOpened((prev) => (ids.every((id) => prev.includes(id)) ? prev : [...prev, ...ids.filter((id) => !prev.includes(id))]));
  }, [missingKey]);

  const visible = showAll ? pillars : pillars.filter((p) => opened.includes(p.id));
  const setScore = (id: PillarId, value: number | null) =>
    api.update((w) => patchDiagnosis(w, { [SCORE_COLUMNS[id]]: value } as Partial<DiagnosisFields>));
  const setNote = (id: PillarId, note: string) =>
    api.update((w) => patchCallData(w, { scoreNotes: { ...w.diagnosis.call_data.scoreNotes, [id]: note } }));

  return (
    <SubSection
      id={ISSUE_ANCHOR.scores}
      title="Notas dos 5 pilares"
      hint="A nota vem do que ele mostrou na call, não do que declarou."
      action={
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Mostrar menos' : readOnly ? 'Ver detalhes' : 'Ver todas'}
        </Button>
      }
    >
      <ul className="flex flex-wrap gap-1.5" aria-label="Notas dadas">
        {pillars.map((p) => {
          const score = scores[p.id];
          const level = levelOf(score);
          return (
            <li key={p.id} className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">
              {p.nome_curto}{' '}
              <span className={cn('font-semibold tabular-nums', level ? LEVEL_TEXT_CLASS[level] : 'text-amber-400')}>
                {score === null ? 'sem nota' : `${score}/5`}
              </span>
            </li>
          );
        })}
      </ul>
      {visible.length > 0 && (
        <div className="grid gap-2">
          {visible.map((p) => (
            <ScoreSelector
              key={p.id}
              pillar={p}
              value={scores[p.id]}
              onChange={(value) => setScore(p.id, value)}
              note={ws.diagnosis.call_data.scoreNotes[p.id] ?? ''}
              onNoteChange={(note) => setNote(p.id, note)}
              readOnly={readOnly}
              showQuestion
            />
          ))}
        </div>
      )}
    </SubSection>
  );
}
