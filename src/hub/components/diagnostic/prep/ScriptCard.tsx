import { useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { applicationAnswersOf } from '@/lib/diagnostic/prepChecklist';
import { suggestArchetype } from '@diag/archetype.ts';
import { PREP_SECTION } from './anchors';
import { DifferentialsSection } from './DifferentialsSection';
import { MaterialSection } from './MaterialSection';
import { NewsSection } from './NewsSection';
import { PrepCard } from './PrepCard';
import { ProfileSection } from './ProfileSection';

/** Roteiro da call: perfil, reportagens, diferenciais e material da area. */
export function ScriptCard({ api }: { api: ReadyWorkspace }) {
  const { ws, content } = api;
  const suggestion = useMemo(() => suggestArchetype(applicationAnswersOf(ws.lead), content), [ws.lead, content]);
  // Sem perfil gravado, as sugestoes partem do perfil sugerido pela aplicacao.
  // Sem sugestao (nada bateu), nenhum perfil: o diagnostico tambem fica sem (derive.ts).
  const archetypeId = ws.diagnosis.archetype_id || (suggestion.score > 0 ? suggestion.id : '');

  return (
    <PrepCard
      id={PREP_SECTION.script}
      icon={ScrollText}
      title="Roteiro"
      description="O que você leva pronto para a call. Na conversa, o que ele disser vale mais que a sugestão."
    >
      <ProfileSection api={api} suggestion={suggestion} archetypeId={archetypeId} />
      <NewsSection api={api} archetypeId={archetypeId} />
      <DifferentialsSection api={api} archetypeId={archetypeId} />
      <MaterialSection api={api} />
    </PrepCard>
  );
}
