import { useMemo } from 'react';
import { Check, MonitorPlay, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { findNews, hasNewsSource } from '@diag/content.ts';
import { plannedNews, toggleNewsShown, type PlannedNews } from '@/lib/diagnostic/cockpit';
import { MAX_NEWS_SHOWN } from '@/lib/diagnostic/presentationEffects';
import { useCockpit } from './cockpitContext';
import { Note, SectionLabel } from './parts';

function NewsCard({ planned, shown, full }: { planned: PlannedNews; shown: boolean; full: boolean }) {
  const { api, readOnly, write } = useCockpit();
  const { item, mode, suggested } = planned;
  const screen = mode === 'screen';
  let action = screen ? 'Registrar como mostrada' : 'Citei';
  if (shown) action = screen ? 'Mostrada' : 'Citada';
  return (
    <article className="space-y-1.5 rounded-md border border-border/60 p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{item.veiculo}</span>
        {item.data && <span className="tabular-nums">{item.data}</span>}
        {item.selo && <span className="rounded border border-amber-400/40 px-1.5 text-amber-300">{item.selo}</span>}
        <span className="ml-auto inline-flex items-center gap-1">
          {screen ? <MonitorPlay className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          {screen ? 'Na tela' : 'Só falar'}
        </span>
      </div>
      <p className="text-base font-semibold leading-snug text-foreground">{item.manchete}</p>
      <p className="text-sm leading-relaxed">{item.dado_principal}</p>
      {item.pergunta_depois && <p className="text-sm italic text-muted-foreground">Depois: "{item.pergunta_depois}"</p>}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {screen && !shown && (
          <span className="text-xs text-sky-300">
            {suggested ? 'Para mostrar pela Tela do lead, marque na preparação.' : 'Mostre pela Tela do lead.'}
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant={shown ? 'default' : 'outline'}
          className="ml-auto h-8"
          disabled={readOnly || (!shown && full)}
          aria-pressed={shown}
          onClick={() => write((w) => toggleNewsShown(w, item.id, api.content))}
        >
          {shown && <Check />}
          {action}
        </Button>
      </div>
    </article>
  );
}

/** Momento reportagem: as planejadas na preparacao, com o que dizer depois. */
export function NewsCapture() {
  const { api } = useCockpit();
  const { ws, content, model } = api;
  const prep = ws.diagnosis.prep_config;
  // Sem plano, a sugestao segue o perfil que vale (confirmado ou sugerido), como na preparacao.
  const archetypeId = model.archetypeSource !== 'none' ? (model.archetype?.id ?? '') : '';
  const planned = useMemo(() => plannedNews(content, prep, archetypeId), [content, prep, archetypeId]);
  const pendingSources = [...new Set([...prep.newsScreen, ...prep.newsSpoken])]
    .map((id) => findNews(content, id))
    .filter((item) => item && !hasNewsSource(item));
  const shownIds = ws.diagnosis.news_shown_ids.filter((id) => hasNewsSource(findNews(content, id)));
  const full = shownIds.length >= MAX_NEWS_SHOWN;
  const shownNames = shownIds.map((id) => findNews(content, id)?.veiculo ?? id);
  const closing = content.reportagem_fecho?.trim();

  return (
    <div className="space-y-3">
      <SectionLabel>Reportagens</SectionLabel>
      {planned.length === 0 && <Note>Nenhuma reportagem para este perfil. Escolha na preparação.</Note>}
      {pendingSources.length > 0 && (
        <Note tone="warn">
          Fonte pendente: {pendingSources.map((item) => item!.veiculo).join(', ')}. Esses materiais não entram no roteiro; não cite os dados antes da publicação da fonte.
        </Note>
      )}
      {planned.some((p) => p.suggested) && (
        <p className="text-xs text-muted-foreground">Nada planejado na preparação: sugestão pelo perfil.</p>
      )}
      {planned.map((p) => (
        <NewsCard key={p.item.id} planned={p} shown={shownIds.includes(p.item.id)} full={full} />
      ))}
      <p className={full ? 'text-xs text-amber-400' : 'text-xs text-muted-foreground'}>
        Registradas na call: {shownIds.length} de {MAX_NEWS_SHOWN}
        {shownNames.length ? ` (${shownNames.join(', ')})` : ''}. As que têm link vão para o PDF, para ler depois.
      </p>
      {closing && <Note tone="ok">Feche no positivo: "{closing}"</Note>}
    </div>
  );
}
