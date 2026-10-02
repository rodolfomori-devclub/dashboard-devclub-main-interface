import { ScoreSelector } from '@/components/diagnostic/capture/ScoreSelector';
import { patchCallData, patchDiagnosis, SCORE_COLUMNS } from '@/lib/diagnostic/workspace';
import { findPillar } from '@diag/content.ts';
import type { PillarId } from '@diag/types.ts';
import { useCockpit } from './cockpitContext';

/** Nota de um pilar ligada a coluna do diagnostico e a evidencia em call_data. */
export function PillarScore({ pillarId, showQuestion, className }: { pillarId: PillarId; showQuestion?: boolean; className?: string }) {
  const { api, readOnly, write } = useCockpit();
  const pillar = findPillar(api.content, pillarId);
  if (!pillar) return null;
  const column = SCORE_COLUMNS[pillarId];
  const value = api.ws.diagnosis[column] as number | null;
  return (
    <ScoreSelector
      pillar={pillar}
      value={value}
      onChange={(score) => write((w) => patchDiagnosis(w, { [column]: score }))}
      note={api.ws.diagnosis.call_data.scoreNotes[pillarId] ?? ''}
      onNoteChange={(note) =>
        write((w) => patchCallData(w, { scoreNotes: { ...w.diagnosis.call_data.scoreNotes, [pillarId]: note } }))
      }
      readOnly={readOnly}
      showQuestion={showQuestion}
      className={className}
    />
  );
}
