import { ExternalLink, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchPrepConfig, type PrepConfig } from '@/lib/diagnostic/workspace';
import {
  canGoOnScreen,
  MAX_PREP_NEWS,
  newsCount,
  newsModeOf,
  setNewsMode,
  triggerSuggestsFearful,
  type NewsMode,
} from '@/lib/diagnostic/prepChecklist';
import { suggestNews } from '@diag/archetype.ts';
import { hasNewsSource } from '@diag/content.ts';
import type { DiagnosticContent, NewsItem } from '@diag/types.ts';
import { Segmented } from './fields';
import { PrepSubheading } from './PrepCard';

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

function outletsOf(content: DiagnosticContent, ids: string[]): string {
  return ids.map((id) => content.reportagens.find((n) => n.id === id)?.veiculo || id).join(' e ');
}

/** Escolhas antigas sem fonte nao ocupam as duas vagas de reportagens da call. */
function sourcedPlan(prep: PrepConfig, content: DiagnosticContent): PrepConfig {
  const ready = (id: string) => hasNewsSource(content.reportagens.find((item) => item.id === id));
  return { ...prep, newsScreen: prep.newsScreen.filter(ready), newsSpoken: prep.newsSpoken.filter(ready) };
}

/** "Lead com medo" e as reportagens planejadas: na tela, so falar ou fora (no maximo 2). */
export function NewsSection({ api, archetypeId }: { api: ReadyWorkspace; archetypeId: string }) {
  const { ws, content } = api;
  const prep = sourcedPlan(ws.diagnosis.prep_config, content);
  const readOnly = !api.canEdit;

  const suggestion = suggestNews(content, archetypeId, prep.fearful);
  const suggestedIds = new Set([...suggestion.screen, ...suggestion.spoken]);
  const applied = sameList(prep.newsScreen, suggestion.screen) && sameList(prep.newsSpoken, suggestion.spoken);
  const fearfulPlan = suggestNews(content, archetypeId, true);
  const count = newsCount(prep);

  const setMode = (item: NewsItem, mode: NewsMode) =>
    api.update((w) => {
      const next = setNewsMode(sourcedPlan(w.diagnosis.prep_config, content), item, mode);
      return next ? patchPrepConfig(w, next) : w;
    });
  const applySuggestion = () =>
    api.update((w) => {
      const s = suggestNews(content, archetypeId, w.diagnosis.prep_config.fearful);
      return patchPrepConfig(w, { newsScreen: s.screen, newsSpoken: s.spoken });
    });

  const fearfulParts = [
    fearfulPlan.screen.length ? `${outletsOf(content, fearfulPlan.screen)} na tela` : '',
    fearfulPlan.spoken.length ? `${outletsOf(content, fearfulPlan.spoken)} só falado` : '',
  ].filter(Boolean);

  return (
    <div className="space-y-3 border-t border-border/60 pt-4">
      <div className="flex items-start gap-3 rounded-md border border-border/60 p-3">
        <Switch
          id="prep-fearful"
          checked={prep.fearful}
          onCheckedChange={(v) => api.update((w) => patchPrepConfig(w, { fearful: v }))}
          disabled={readOnly}
          className="mt-0.5"
        />
        <div className="space-y-1 min-w-0">
          <Label htmlFor="prep-fearful" className="text-sm">
            Lead com medo de perder espaço
          </Label>
          <p className="text-xs text-muted-foreground">
            Reportagens mais leves{fearfulParts.length ? `: a sugestão vira ${fearfulParts.join(' e ')}` : ''}. Nunca use medo
            de demissão como ameaça.
          </p>
          {triggerSuggestsFearful(ws.lead.trigger_event) && !prep.fearful && (
            <p className="text-xs text-amber-400">
              Ele marcou &quot;Tenho medo de perder espaço para quem usa IA&quot;. Vale ligar.
            </p>
          )}
        </div>
      </div>

      <PrepSubheading
        actions={
          <>
            <span className={cn('text-xs tabular-nums', count > MAX_PREP_NEWS ? 'text-red-400' : 'text-muted-foreground')}>
              {count} de {MAX_PREP_NEWS}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={applySuggestion}
              // Sem sugestao (sem perfil), aplicar so apagaria o que o vendedor escolheu.
              disabled={readOnly || applied || suggestedIds.size === 0}
            >
              <Sparkles className="h-3.5 w-3.5" /> Usar sugestão
            </Button>
          </>
        }
      >
        Reportagens
      </PrepSubheading>
      <p className="text-xs text-muted-foreground">
        Duas no máximo: mais que isso vira aula de medo. Use fontes publicadas e diga sempre o veículo e o ano, inclusive ao citar sem mostrar a tela.
      </p>

      <ul className="space-y-2">
        {content.reportagens.map((n) => {
          const mode = newsModeOf(prep, n.id);
          const screenOk = canGoOnScreen(n);
          const full = count >= MAX_PREP_NEWS && mode === 'fora';
          return (
            <li
              key={n.id}
              className={cn('rounded-md border p-3 space-y-2', mode === 'fora' ? 'border-border/60' : 'border-primary/40 bg-primary/5')}
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {[n.veiculo, n.data, n.selo].filter((x) => x && x.trim()).join(' · ')}
                    {suggestedIds.has(n.id) && <span className="ml-2 normal-case tracking-normal text-primary">sugerida</span>}
                  </p>
                  <p className="text-sm text-foreground">{hasNewsSource(n) ? n.manchete : 'Fonte pendente'}</p>
                  <p className="text-xs text-muted-foreground">
                    {hasNewsSource(n) ? n.quando_usar : 'Aguarde a publicação da fonte antes de usar este material na call. Não cite os dados enquanto ela estiver pendente.'}
                  </p>
                </div>
                <Segmented
                  label={`Como usar: ${n.veiculo}`}
                  value={mode}
                  onChange={(m) => setMode(n, m)}
                  disabled={readOnly}
                  options={[
                    {
                      value: 'tela',
                      label: 'Na tela',
                      disabled: !screenOk || full,
                      title: screenOk ? undefined : 'Fonte pendente ou material não liberado para a tela.',
                    },
                    { value: 'falar', label: 'Só falar', disabled: !hasNewsSource(n) || full },
                    { value: 'fora', label: 'Fora' },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {hasNewsSource(n) && n.url && (
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" /> Abrir matéria
                  </a>
                )}
                {n.link_interno && (
                  <a
                    href={n.link_interno}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <PlayCircle className="h-3 w-3" /> Abrir vídeo para revisão (só você)
                  </a>
                )}
                {!hasNewsSource(n) && <span className="text-amber-400">Fonte pendente: indisponível para apresentar ou citar.</span>}
                {hasNewsSource(n) && !screenOk && <span className="text-muted-foreground">Fonte disponível somente para citação, com veículo e ano.</span>}
                {full && <span className="text-muted-foreground">Já tem {MAX_PREP_NEWS}. Tire uma para trocar.</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
