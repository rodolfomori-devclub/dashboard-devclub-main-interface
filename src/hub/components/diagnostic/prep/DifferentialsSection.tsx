import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchPrepConfig } from '@/lib/diagnostic/workspace';
import { MAX_PREP_DIFFERENTIALS, toggleLimited } from '@/lib/diagnostic/prepChecklist';
import { suggestDifferentials } from '@diag/archetype.ts';
import { findPillar } from '@diag/content.ts';
import type { DiagnosticContent, Differential } from '@diag/types.ts';
import { PrepSubheading } from './PrepCard';

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function resolvesLabel(content: DiagnosticContent, d: Differential): string {
  if (d.resolve === 'confianca') return 'Confiança';
  return findPillar(content, d.resolve)?.nome_curto ?? d.resolve;
}

/** Ate 3 diferenciais a mostrar primeiro no pitch, na ordem escolhida. */
export function DifferentialsSection({ api, archetypeId }: { api: ReadyWorkspace; archetypeId: string }) {
  const { ws, content } = api;
  const chosen = ws.diagnosis.prep_config.differentials;
  const readOnly = !api.canEdit;
  const full = chosen.length >= MAX_PREP_DIFFERENTIALS;
  const suggestion = suggestDifferentials(content, null, archetypeId, ws.diagnosis.call_data.needPriority);

  const toggle = (id: string) =>
    api.update((w) => {
      const list = w.diagnosis.prep_config.differentials;
      const next = toggleLimited(list, id, MAX_PREP_DIFFERENTIALS);
      return next === list ? w : patchPrepConfig(w, { differentials: next });
    });
  const applySuggestion = () =>
    api.update((w) =>
      patchPrepConfig(w, { differentials: suggestDifferentials(content, null, archetypeId, w.diagnosis.call_data.needPriority) }),
    );

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <PrepSubheading
        actions={
          <>
            <span className="text-xs tabular-nums text-muted-foreground">
              {chosen.length} de {MAX_PREP_DIFFERENTIALS}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={applySuggestion}
              disabled={readOnly || suggestion.length === 0 || sameList(chosen, suggestion)}
            >
              <Sparkles className="h-3.5 w-3.5" /> Usar sugestão
            </Button>
          </>
        }
      >
        Diferenciais a mostrar primeiro
      </PrepSubheading>
      <p className="text-xs text-muted-foreground">
        Só os ligados às travas dele, cada um fechando com &quot;isso resolve o que você me falou sobre...?&quot;. Na call, a
        resposta dele sobre o que pesa mais pode mudar a ordem.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {(content.diferenciais ?? []).map((d) => {
          const index = chosen.indexOf(d.id);
          const on = index >= 0;
          return (
            <button
              key={d.id}
              type="button"
              aria-pressed={on}
              disabled={readOnly || (!on && full)}
              onClick={() => toggle(d.id)}
              className={cn(
                'text-left rounded-md border p-3 space-y-1 transition-colors disabled:cursor-not-allowed',
                on ? 'border-primary/60 bg-primary/10' : 'border-border/60 hover:border-foreground/30',
                !on && full && 'opacity-50 hover:border-border/60',
              )}
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    'h-5 w-5 shrink-0 rounded-full border text-[11px] font-semibold tabular-nums flex items-center justify-center',
                    on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-transparent',
                  )}
                  aria-hidden="true"
                >
                  {on ? index + 1 : '·'}
                </span>
                <span className="text-sm font-medium text-foreground flex-1 min-w-0">{d.titulo}</span>
                <span className="text-[11px] text-muted-foreground shrink-0">{resolvesLabel(content, d)}</span>
              </span>
              <span className="block text-xs text-muted-foreground">&quot;{d.como_falar}&quot;</span>
            </button>
          );
        })}
      </div>
      {full && <p className="text-xs text-muted-foreground">Já tem {MAX_PREP_DIFFERENTIALS}. Desmarque um para trocar.</p>}
    </div>
  );
}
