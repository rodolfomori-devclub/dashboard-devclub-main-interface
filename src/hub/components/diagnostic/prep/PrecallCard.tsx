import { useState } from 'react';
import { ListTodo, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchSession, type PrecallAnswers } from '@/lib/diagnostic/workspace';
import { sceneOrder } from '@/lib/diagnostic/presentation';
import {
  addUnique,
  formatDecimalBR,
  MAX_HOURS_PER_WEEK,
  MAX_PRECALL_TASKS,
  MAX_PRECALL_TOOLS,
  newLocalId,
  precallTotals,
} from '@/lib/diagnostic/prepChecklist';
import type { WeeklyTask } from '@diag/types.ts';
import { PREP_SECTION } from './anchors';
import { DecimalInput, Notice } from './fields';
import { PrepCard, PrepSubheading } from './PrepCard';

/** Tarefa de casa do lead: tarefas que mais tomam tempo, horas por semana e ferramentas. */
export function PrecallCard({ api }: { api: ReadyWorkspace }) {
  const { ws } = api;
  const precall = ws.session.precall_answers;
  const readOnly = !api.canEdit;
  const [tool, setTool] = useState('');

  const setPrecall = (fn: (p: PrecallAnswers) => Partial<PrecallAnswers> | null) =>
    api.update((w) => {
      const current = w.session.precall_answers;
      const patch = fn(current);
      if (!patch) return w;
      return patchSession(w, { precall_answers: { ...current, ...patch, source: current.source ?? 'consultor' } });
    });

  const updateTask = (id: string, patch: Partial<WeeklyTask>) =>
    setPrecall((p) => ({ tasks: p.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const removeTask = (id: string) => setPrecall((p) => ({ tasks: p.tasks.filter((t) => t.id !== id) }));
  const addTask = () =>
    setPrecall((p) =>
      p.tasks.length >= MAX_PRECALL_TASKS ? null : { tasks: [...p.tasks, { id: newLocalId('t'), label: '', hoursPerWeek: null }] },
    );
  const addTool = () => {
    setPrecall((p) => {
      const next = addUnique(p.tools, tool, MAX_PRECALL_TOOLS);
      return next === p.tools ? null : { tools: next };
    });
    setTool('');
  };
  const removeTool = (name: string) => setPrecall((p) => ({ tools: p.tools.filter((t) => t !== name) }));

  const totals = precallTotals({ ws, model: api.model, content: api.content, offer: api.offer });
  const sceneOn = sceneOrder(ws.diagnosis.prep_config).find((s) => s.id === 'tempo')?.enabled ?? false;

  return (
    <PrepCard
      id={PREP_SECTION.precall}
      icon={ListTodo}
      title="Tarefas da semana (pré-diagnóstico)"
      description="A tarefa de casa: as tarefas que mais tomam o tempo dele e quantas horas por semana."
      actions={
        precall.source === 'lead' ? (
          <span className="text-[11px] rounded border border-border px-1.5 py-0.5 text-muted-foreground">Preenchido pelo lead</span>
        ) : null
      }
    >
      <div className="space-y-2">
        {precall.tasks.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma tarefa ainda. Se ele mandou pelo WhatsApp, anote aqui; se não, pergunte na Situação.
          </p>
        )}
        {precall.tasks.map((t, i) => (
          <div key={t.id} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums w-4 shrink-0">{i + 1}.</span>
            <Input
              value={t.label}
              onChange={(e) => updateTask(t.id, { label: e.target.value })}
              placeholder="Ex.: Relatório mensal de despesas"
              aria-label={`Tarefa ${i + 1}`}
              disabled={readOnly}
              className="h-9 flex-1 min-w-0"
            />
            <DecimalInput
              value={t.hoursPerWeek}
              onCommit={(v) => updateTask(t.id, { hoursPerWeek: v })}
              // A tela do lead mostra cada tarefa com 1 casa: com mais, a soma visivel nao fecha.
              maxDecimals={1}
              min={0}
              max={MAX_HOURS_PER_WEEK}
              placeholder="0"
              ariaLabel={`Horas por semana da tarefa ${i + 1}`}
              disabled={readOnly}
              className="w-16 text-right shrink-0"
            />
            <span className="text-xs text-muted-foreground shrink-0">h/sem</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              onClick={() => removeTask(t.id)}
              aria-label={`Remover tarefa ${i + 1}`}
              disabled={readOnly}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={addTask}
          disabled={readOnly || precall.tasks.length >= MAX_PRECALL_TASKS}
        >
          <Plus className="h-4 w-4" /> Adicionar tarefa
        </Button>
        {precall.tasks.length >= MAX_PRECALL_TASKS && (
          <span className="text-xs text-muted-foreground ml-2">No máximo {MAX_PRECALL_TASKS} tarefas.</span>
        )}
      </div>

      <Notice tone={totals ? 'ok' : 'info'}>
        {totals ? (
          <p className="text-foreground">
            Total: <strong className="tabular-nums">{formatDecimalBR(totals.weekly)} h</strong> por semana, cerca de{' '}
            <strong className="tabular-nums">{formatDecimalBR(totals.yearly)} horas</strong> por ano ({formatDecimalBR(totals.weekly)} h ×{' '}
            {totals.weeks} semanas).
          </p>
        ) : (
          <p>Sem horas informadas, a conta do ano não aparece.</p>
        )}
        <p className="text-muted-foreground">
          Só aparece para o lead se ele informou horas.
          {!sceneOn && ' A cena "Onde seu tempo vai" está desligada na tela do lead.'}
        </p>
      </Notice>

      <div className="space-y-2 border-t border-border/60 pt-4">
        <PrepSubheading>Ferramentas que ele já usa</PrepSubheading>
        {precall.tools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {precall.tools.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
                {name}
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeTool(name)}
                    aria-label={`Remover ${name}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTool();
          }}
        >
          <Input
            value={tool}
            onChange={(e) => setTool(e.target.value)}
            placeholder="Ex.: ChatGPT, Excel, Power BI"
            aria-label="Nova ferramenta"
            disabled={readOnly || precall.tools.length >= MAX_PRECALL_TOOLS}
            className="h-9 max-w-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={readOnly || !tool.trim()}>
            Adicionar
          </Button>
        </form>
      </div>
    </PrepCard>
  );
}
