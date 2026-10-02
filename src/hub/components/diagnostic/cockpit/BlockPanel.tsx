import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Lightbulb, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { CallQuestion } from '@diag/types.ts';
import { blockIndex, isChecked, nextBlock, scriptsForBlock, setChecked, uncoveredPillars } from '@/lib/diagnostic/cockpit';
import { patchCallData } from '@/lib/diagnostic/workspace';
import { nowIso, useCockpit } from './cockpitContext';
import { ScriptText } from './ScriptText';
import { PillarScore } from './PillarScore';
import { PriceReminder } from './PriceReminder';
import { NewsCapture } from './NewsCapture';
import { NeedCapture } from './NeedCapture';
import { CommitmentCapture, DevolutivaPrep } from './DevolutivaCapture';
import { CostCapture, GraduationGate, NextStepCapture, PitchCapture } from './ClosingCapture';
import { SectionLabel } from './parts';

function BlockHeader() {
  const { blocks, block, goToBlock } = useCockpit();
  const index = blockIndex(blocks, block.id);
  const prev = index > 0 ? blocks[index - 1] : null;
  const next = index >= 0 && index < blocks.length - 1 ? blocks[index + 1] : null;
  const beforeDevolutiva = index < blockIndex(blocks, 'devolutiva');
  return (
    <header className="space-y-1">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs tabular-nums text-muted-foreground">
            Bloco {index + 1} de {blocks.length}
            {block.sigla ? ` · ${block.sigla}` : ''} · min {block.min_inicio}-{block.min_fim}
          </p>
          <h2 className="section-title leading-tight">{block.titulo}</h2>
        </div>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={!prev} onClick={() => prev && goToBlock(prev.id)} aria-label="Bloco anterior">
          <ChevronLeft />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={!next} onClick={() => next && goToBlock(next.id)} aria-label="Próximo bloco (Alt+N)">
          <ChevronRight />
        </Button>
      </div>
      {beforeDevolutiva && <PriceReminder />}
    </header>
  );
}

function Alerts() {
  const { block } = useCockpit();
  if (!block.alertas.length) return null;
  return (
    <div role="note" className="space-y-1 rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2">
      {block.alertas.map((a, i) => (
        <div key={i} className="flex items-start gap-2 text-amber-300">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <ScriptText text={a} size="small" className="font-medium" />
        </div>
      ))}
    </div>
  );
}

/** Dados que o lead trouxe e ajudam neste bloco. */
function LeadContext() {
  const { api, block } = useCockpit();
  if (block.id === 'situacao') {
    const tasks = api.ws.session.precall_answers.tasks.filter((t) => t.label.trim());
    if (!tasks.length) return null;
    return (
      <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
        <SectionLabel>Tarefas que ele trouxe</SectionLabel>
        <ul className="mt-1 space-y-0.5">
          {tasks.map((t) => (
            <li key={t.id}>
              {t.label}
              {t.hoursPerWeek ? <span className="text-muted-foreground"> · {t.hoursPerWeek.toLocaleString('pt-BR')} h por semana</span> : null}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (block.id === 'problema') {
    const pain = api.ws.qualification.pain_text.trim();
    if (!pain) return null;
    return (
      <div className="rounded-md bg-muted/30 px-3 py-2 text-sm">
        <SectionLabel>Dor anotada pelo SDR</SectionLabel>
        <p className="mt-1">"{pain}"</p>
      </div>
    );
  }
  return null;
}

function Scripts() {
  const { api, block } = useCockpit();
  const scripts = scriptsForBlock(block, api.ws.lead.graduation_status, { soldOut: api.offer.view.soldOut });
  if (!scripts.length) return null;
  return (
    <div className="space-y-3">
      {scripts.map((s) => (
        <article key={s.id} className="space-y-1.5 border-l-2 border-primary/60 pl-3">
          <SectionLabel>{s.titulo}</SectionLabel>
          <ScriptText text={s.texto} />
        </article>
      ))}
    </div>
  );
}

function QuestionItem({ q, hint }: { q: CallQuestion; hint: string }) {
  const { api, readOnly, write } = useCockpit();
  const cd = api.ws.diagnosis.call_data;
  const done = isChecked(cd, q.id);
  const textId = `cockpit-q-${q.id}`;
  return (
    <li className={cn('space-y-2 rounded-md border p-3', done ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-border/60')}>
      <div className="flex items-start gap-3">
        <Checkbox
          checked={done}
          disabled={readOnly}
          onCheckedChange={(v) => write((w) => setChecked(w, q.id, v === true, nowIso()))}
          aria-labelledby={textId}
          title="Fiz esta pergunta"
          className="mt-1"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <ScriptText id={textId} text={q.texto} size="question" />
          {q.nota && <p className="text-xs text-muted-foreground">{q.nota}</p>}
        </div>
      </div>
      <Textarea
        value={cd.answers[q.id] ?? ''}
        onChange={(e) => {
          const value = e.target.value;
          write((w) => patchCallData(w, { answers: { ...w.diagnosis.call_data.answers, [q.id]: value } }));
        }}
        disabled={readOnly}
        rows={2}
        placeholder={hint}
        aria-labelledby={textId}
        className="min-h-[60px] text-sm"
      />
      {q.pilar && <PillarScore pillarId={q.pilar} />}
    </li>
  );
}

function Questions() {
  const { block } = useCockpit();
  const extra = uncoveredPillars(block);
  if (!block.perguntas.length && !extra.length) return null;
  // A resposta desta pergunta entra no roteiro da reportagem ({{como_usa_ia}}).
  const aiQuestionId = block.id === 'situacao' ? block.perguntas.find((q) => q.pilar === 'uso')?.id : undefined;
  return (
    <div className="space-y-2">
      <SectionLabel>Perguntas</SectionLabel>
      <ol className="space-y-2">
        {block.perguntas.map((q) => (
          <QuestionItem
            key={q.id}
            q={q}
            hint={q.id === aiQuestionId ? 'Como ele usa IA hoje (entra no roteiro da reportagem)' : 'O que ele respondeu'}
          />
        ))}
      </ol>
      {extra.map((p) => (
        <PillarScore key={p} pillarId={p} showQuestion />
      ))}
    </div>
  );
}

function BlockCapture() {
  const { block } = useCockpit();
  switch (block.id) {
    case 'reportagem':
      return <NewsCapture />;
    case 'implicacao':
      return <CostCapture />;
    case 'necessidade':
      return <NeedCapture />;
    case 'pitch':
      return <PitchCapture />;
    case 'proximo':
      return <NextStepCapture />;
    default:
      return null;
  }
}

function Checklist() {
  const { api, block, readOnly, write } = useCockpit();
  if (!block.checklist.length) return null;
  const cd = api.ws.diagnosis.call_data;
  return (
    <div className="space-y-2">
      <SectionLabel>Checklist do bloco</SectionLabel>
      <ul className="space-y-1.5">
        {block.checklist.map((item) => {
          const id = `chk-${block.id}-${item.id}`;
          return (
            <li key={item.id} className="flex items-start gap-2.5">
              <Checkbox
                id={id}
                checked={isChecked(cd, item.id)}
                disabled={readOnly}
                onCheckedChange={(v) => write((w) => setChecked(w, item.id, v === true, nowIso()))}
                className="mt-0.5"
              />
              <label htmlFor={id} className="text-sm leading-snug">
                {item.texto}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Tips() {
  const { block } = useCockpit();
  if (!block.dicas.length) return null;
  return (
    <ul className="space-y-1">
      {block.dicas.map((d, i) => (
        <li key={i} className="flex items-start gap-2 text-muted-foreground">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <ScriptText text={d} size="small" className="text-muted-foreground" />
        </li>
      ))}
    </ul>
  );
}

function NextFooter() {
  const { api, blocks, block, goToBlock } = useCockpit();
  const nextId = nextBlock(blocks, block.id, api.ws.diagnosis.call_data.shortMode);
  const next = blocks.find((b) => b.id === nextId);
  if (!next) return null;
  return (
    <div className="flex justify-end border-t border-border/60 pt-3">
      <Button type="button" variant="outline" size="sm" onClick={() => goToBlock(next.id)} title="Alt+N" className="max-w-full">
        <span className="truncate">Próximo: {next.titulo}</span>
        <ChevronRight />
      </Button>
    </div>
  );
}

/** Abaixo disto o topo do bloco fica escondido sob a barra fixa. */
const HIDDEN_TOP_PX = 120;

/** O bloco atual: o que falar, o que perguntar, onde anotar e o que capturar. */
export function BlockPanel() {
  const { block } = useCockpit();
  const ref = useRef<HTMLElement>(null);
  const mounted = useRef(false);

  // Trocou de bloco com a pagina rolada (o botao do fim do bloco): volta ao topo do novo.
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const el = ref.current;
    if (el && el.getBoundingClientRect().top < HIDDEN_TOP_PX) el.scrollIntoView?.({ block: 'start' });
  }, [block.id]);

  return (
    <section ref={ref} aria-label={block.titulo} className="glass-card scroll-mt-28 space-y-5 p-4 sm:p-5 lg:scroll-mt-[4.25rem]">
      <BlockHeader />
      <Alerts />
      <LeadContext />
      {block.id === 'devolutiva' && <DevolutivaPrep />}
      <GraduationGate />
      <Scripts />
      {block.id === 'devolutiva' && <CommitmentCapture />}
      <Questions />
      <BlockCapture />
      <Checklist />
      <Tips />
      <NextFooter />
    </section>
  );
}
