import { Circle, CircleAlert, CircleCheck, ListChecks } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchCallData } from '@/lib/diagnostic/workspace';
import { openBlockers, toggleTick, type PrepChecklistItem } from '@/lib/diagnostic/prepChecklist';
import { CHECKLIST_SECTION } from './anchors';

function StatusIcon({ item }: { item: PrepChecklistItem }) {
  if (item.done) return <CircleCheck className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" aria-label="Pronto" />;
  if (item.severity === 'block') return <CircleAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-400" aria-label="Falta, pede confirmação" />;
  return <Circle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-label="Falta" />;
}

function goToSection(itemId: string) {
  const section = CHECKLIST_SECTION[itemId];
  if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** "Antes de comecar": o que falta (e por que) e os itens do playbook para marcar. */
export function PrepChecklistPanel({ api, items }: { api: ReadyWorkspace; items: PrepChecklistItem[] }) {
  const readOnly = !api.canEdit;
  const checks = items.filter((i) => i.severity !== 'info');
  const manual = items.filter((i) => i.severity === 'info');
  const done = items.filter((i) => i.done).length;
  const blockers = openBlockers(items).length;

  const tick = (id: string) =>
    api.update((w) => patchCallData(w, { ticks: toggleTick(w.diagnosis.call_data.ticks, id, new Date().toISOString()) }));

  return (
    <section className="glass-card p-4 space-y-4" aria-labelledby="prep-checklist-title">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 id="prep-checklist-title" className="section-title flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-muted-foreground" />
            Antes de começar
          </h3>
          <span className="text-xs tabular-nums text-muted-foreground">
            {done} de {items.length}
          </span>
        </div>
        {blockers > 0 ? (
          <p className="text-xs text-red-400">
            {blockers === 1 ? '1 item pede' : `${blockers} itens pedem`} confirmação antes da call. Dá para começar assim mesmo.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Nada impede a call. O que estiver em aberto ainda pode ser completado.</p>
        )}
      </div>

      <ul className="space-y-1">
        {checks.map((item) => {
          const linked = !!CHECKLIST_SECTION[item.id];
          const body = (
            <>
              <StatusIcon item={item} />
              <span className="min-w-0">
                <span className={cn('block text-sm', item.done ? 'text-muted-foreground' : 'text-foreground')}>{item.label}</span>
                {!item.done && item.hint && <span className="block text-xs text-muted-foreground">{item.hint}</span>}
              </span>
            </>
          );
          return (
            <li key={item.id}>
              {linked && !item.done ? (
                <button
                  type="button"
                  onClick={() => goToSection(item.id)}
                  className="w-full text-left flex gap-2 rounded-md px-1.5 py-1 hover:bg-accent/40 transition-colors"
                >
                  {body}
                </button>
              ) : (
                <div className="flex gap-2 px-1.5 py-1">{body}</div>
              )}
            </li>
          );
        })}
      </ul>

      {manual.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Do playbook, para marcar</p>
          <ul className="space-y-2">
            {manual.map((item) => (
              <li key={item.id} className="flex items-start gap-2 px-1.5">
                <Checkbox
                  id={`prep-tick-${item.id}`}
                  checked={item.done}
                  onCheckedChange={() => tick(item.id)}
                  disabled={readOnly}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`prep-tick-${item.id}`}
                  className={cn('text-xs leading-snug cursor-pointer', item.done ? 'text-muted-foreground' : 'text-foreground')}
                >
                  {item.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
