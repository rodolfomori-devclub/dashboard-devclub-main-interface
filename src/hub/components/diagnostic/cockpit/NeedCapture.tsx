import { useMemo } from 'react';
import { suggestDifferentials } from '@diag/archetype.ts';
import type { Differential } from '@diag/types.ts';
import { pillarPhrase } from '@/lib/diagnostic/cockpit';
import { patchCallData } from '@/lib/diagnostic/workspace';
import { useCockpit } from './cockpitContext';
import { ChoiceButton, Note, SectionLabel } from './parts';

const RESOLVE_OPTIONS = [
  { value: 'sim', label: 'Sim' },
  { value: 'nao', label: 'Não' },
] as const;

function DifferentialCard({ d }: { d: Differential }) {
  const { api, readOnly, write } = useCockpit();
  const answer = api.ws.diagnosis.call_data.differentialsResolve[d.id];
  const trava = pillarPhrase(api.content, d.resolve);
  const setAnswer = (value: 'sim' | 'nao') =>
    write((w) => {
      const current = { ...w.diagnosis.call_data.differentialsResolve };
      if (current[d.id] === value) delete current[d.id];
      else current[d.id] = value;
      return patchCallData(w, { differentialsResolve: current });
    });
  return (
    <article className="space-y-2 rounded-md border border-border/60 p-3">
      <p className="text-sm font-semibold text-foreground">{d.titulo}</p>
      <p className="text-base leading-relaxed text-foreground">"{d.como_falar}"</p>
      {trava && <p className="text-sm italic text-muted-foreground">Feche com: "Isso resolve o que você me falou sobre {trava}?"</p>}
      <div className="flex items-center gap-2" role="radiogroup" aria-label={`Resolve? ${d.titulo}`}>
        <span className="text-xs text-muted-foreground">Resolve?</span>
        {RESOLVE_OPTIONS.map((o) => (
          <ChoiceButton
            key={o.value}
            selected={answer === o.value}
            disabled={readOnly}
            onClick={() => setAnswer(o.value)}
            className="px-3 py-1 text-xs"
          >
            {o.label}
          </ChoiceButton>
        ))}
      </div>
    </article>
  );
}

/**
 * Diferenciais da pos ligados as travas dele: os da preparacao ou, sem eles,
 * a sugestao pelas notas, pelo perfil e pelo que pesa mais.
 */
export function DifferentialsList({ title }: { title: string }) {
  const { api } = useCockpit();
  const { ws, content, model } = api;
  const chosen = ws.diagnosis.prep_config.differentials;
  const needPriority = ws.diagnosis.call_data.needPriority;
  const items = useMemo(() => {
    const ids = chosen.length ? chosen : suggestDifferentials(content, model, ws.diagnosis.archetype_id, needPriority);
    return ids
      .map((id) => content.diferenciais.find((d) => d.id === id))
      .filter((d): d is Differential => !!d);
  }, [chosen, content, model, ws.diagnosis.archetype_id, needPriority]);

  return (
    <div className="space-y-2">
      <SectionLabel>{title}</SectionLabel>
      <p className="text-xs text-muted-foreground">
        {chosen.length ? 'Escolhidos na preparação.' : 'Sugeridos pelas notas, pelo perfil e pelo que pesa mais para ele.'} Sem preço
        nesta parte.
      </p>
      {items.length ? items.map((d) => <DifferentialCard key={d.id} d={d} />) : <Note>Nenhum diferencial sugerido ainda.</Note>}
    </div>
  );
}

/** Necessidade: o que pesa mais para ele define o primeiro diferencial. */
export function NeedCapture() {
  const { api, readOnly, write } = useCockpit();
  const selected = api.ws.diagnosis.call_data.needPriority;
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <SectionLabel>O que pesa mais para ele</SectionLabel>
        <div role="radiogroup" aria-label="O que pesa mais para ele" className="grid gap-2 sm:grid-cols-3">
          {api.content.necessidade_prioridades.map((p) => (
            <ChoiceButton
              key={p.id}
              selected={selected === p.id}
              disabled={readOnly}
              onClick={() => write((w) => patchCallData(w, { needPriority: selected === p.id ? null : p.id }))}
            >
              {p.rotulo}
            </ChoiceButton>
          ))}
        </div>
      </div>
      {api.model.eligible ? (
        <DifferentialsList title="Diferenciais para mostrar primeiro no pitch" />
      ) : (
        <Note>Cursando graduação: sem diferenciais da pós nesta call.</Note>
      )}
    </div>
  );
}
