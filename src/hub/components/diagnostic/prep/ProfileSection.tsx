import { CircleCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchDiagnosis, patchPrepConfig } from '@/lib/diagnostic/workspace';
import { archetypeById } from '@diag/content.ts';
import type { ArchetypeSuggestion } from '@diag/types.ts';
import { ChoiceSelect } from './fields';
import { PrepSubheading } from './PrepCard';

/**
 * Perfil sugerido pela aplicacao, com os motivos. Escolher no select ja e uma
 * decisao do consultor (grava e confirma); "Confirmar perfil" aceita a sugestao.
 */
export function ProfileSection({
  api,
  suggestion,
  archetypeId,
}: {
  api: ReadyWorkspace;
  suggestion: ArchetypeSuggestion;
  /** O perfil gravado ou, sem nenhum, o sugerido; '' quando nao ha nenhum dos dois. */
  archetypeId: string;
}) {
  const { ws, content } = api;
  const d = ws.diagnosis;
  // archetype_id vai no diagnostico: depois de enviado fica travado.
  const locked = !api.canEdit || api.frozen;
  const chosen = archetypeById(content, archetypeId);
  const suggested = archetypeById(content, suggestion.id);
  const confirmed = d.prep_config.archetypeConfirmed && d.archetype_id !== '' && d.archetype_id === archetypeId;

  const confirm = (id: string) =>
    api.update((w) => patchPrepConfig(patchDiagnosis(w, { archetype_id: id }), { archetypeConfirmed: true }));

  const options = (content.arquetipos ?? []).map((a) => ({
    value: a.id,
    label: a.id === suggestion.id && suggestion.score > 0 ? `${a.nome} (sugerido)` : a.nome,
  }));

  return (
    <div className="space-y-3">
      <PrepSubheading>Perfil</PrepSubheading>

      {suggestion.score > 0 && suggested ? (
        <div className="text-xs text-muted-foreground space-y-1.5">
          <p>
            Sugerido pela aplicação: <span className="text-foreground font-medium">{suggested.nome}</span>
          </p>
          {suggestion.reasons.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {suggestion.reasons.map((r) => (
                <li key={r} className="rounded border border-border/60 px-1.5 py-0.5">
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">A aplicação não aponta um perfil. Escolha pelo que ouvir na call.</p>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <ChoiceSelect
          id="prep-profile"
          value={archetypeId}
          options={options}
          onChange={(v) => v && confirm(v)}
          allowEmpty={false}
          emptyLabel="Escolha o perfil"
          disabled={locked}
          className="sm:max-w-xs"
        />
        {confirmed ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <CircleCheck className="h-3.5 w-3.5" /> Perfil confirmado
          </span>
        ) : (
          <Button type="button" size="sm" onClick={() => archetypeId && confirm(archetypeId)} disabled={locked || !archetypeId}>
            Confirmar perfil
          </Button>
        )}
      </div>

      {chosen && (
        <dl className="rounded-md border border-border/60 p-3 grid gap-2 text-xs">
          <div>
            <dt className="text-muted-foreground">Como reconhecer</dt>
            <dd className="text-foreground">{chosen.como_reconhecer}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Causa raiz (vai no diagnóstico, se você não escrever outra)</dt>
            <dd className="text-foreground">{chosen.causa_raiz}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Diferencial para mostrar primeiro</dt>
            <dd className="text-foreground">{chosen.diferencial_para_mostrar_primeiro}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
