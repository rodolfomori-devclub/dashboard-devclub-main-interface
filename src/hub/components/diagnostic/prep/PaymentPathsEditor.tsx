import { Plus, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { patchOfferConfig } from '@/lib/diagnostic/workspace';
import {
  CASH_LABEL,
  cashPath,
  isIncompletePath,
  MAX_PAYMENT_PATHS,
  newLocalId,
  updatePath,
  type OfferProblemGroups,
} from '@/lib/diagnostic/prepChecklist';
import { findForbidden } from '@diag/guardrails.ts';
import type { OfferConfig, PaymentPath } from '@diag/types.ts';
import { DecimalInput, Field, ProblemList } from './fields';

const MAX_INSTALLMENTS = 60;

/** Ate 3 caminhos de pagamento; total = parcelas x valor (editavel). */
export function PaymentPathsEditor({ api, problems }: { api: ReadyWorkspace; problems: OfferProblemGroups }) {
  const { ws, content } = api;
  const paths = ws.diagnosis.prep_config.offer.paths;
  const readOnly = !api.canEdit;
  const full = paths.length >= MAX_PAYMENT_PATHS;

  const setPaths = (fn: (offer: OfferConfig) => PaymentPath[] | null) =>
    api.update((w) => {
      const next = fn(w.diagnosis.prep_config.offer);
      return next ? patchOfferConfig(w, { paths: next }) : w;
    });
  const edit = (id: string, patch: Partial<Omit<PaymentPath, 'id'>>) =>
    setPaths((o) => o.paths.map((p) => (p.id === id ? updatePath(p, patch) : p)));
  const remove = (id: string) => setPaths((o) => o.paths.filter((p) => p.id !== id));
  const add = (make: (o: OfferConfig) => PaymentPath) =>
    setPaths((o) => (o.paths.length >= MAX_PAYMENT_PATHS ? null : [...o.paths, make(o)]));

  const hasCash = paths.some((p) => p.label.trim() === CASH_LABEL);

  return (
    <div className="space-y-2">
      {paths.length === 0 && <p className="text-xs text-muted-foreground">Nenhum caminho de pagamento ainda.</p>}
      {paths.map((p, i) => {
        // O nome do caminho vai para a tela do lead: avisa, nunca bloqueia.
        const forbidden = p.label.trim() ? findForbidden(p.label, content.guardrails) : [];
        return (
          <div key={p.id} className="rounded-md border border-border/60 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={p.label}
                onChange={(e) => edit(p.id, { label: e.target.value })}
                placeholder="Ex.: 12x no cartão"
                aria-label={`Nome do caminho ${i + 1}`}
                disabled={readOnly}
                className="h-9 flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => remove(p.id)}
                aria-label={`Remover caminho ${i + 1}`}
                disabled={readOnly}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Field id={`prep-path-n-${p.id}`} label="Parcelas">
                <DecimalInput
                  id={`prep-path-n-${p.id}`}
                  value={p.installments}
                  onCommit={(v) => v !== null && edit(p.id, { installments: v })}
                  integer
                  min={1}
                  max={MAX_INSTALLMENTS}
                  disabled={readOnly}
                />
              </Field>
              <Field id={`prep-path-v-${p.id}`} label="Valor da parcela (R$)">
                <DecimalInput
                  id={`prep-path-v-${p.id}`}
                  value={p.installmentValue}
                  onCommit={(v) => edit(p.id, { installmentValue: v ?? 0 })}
                  cents
                  maxDecimals={2}
                  min={0}
                  disabled={readOnly}
                />
              </Field>
              <Field id={`prep-path-t-${p.id}`} label="Total (R$)">
                <DecimalInput
                  id={`prep-path-t-${p.id}`}
                  value={p.total}
                  onCommit={(v) => edit(p.id, { total: v ?? 0 })}
                  cents
                  maxDecimals={2}
                  min={0}
                  disabled={readOnly}
                />
              </Field>
            </div>
            {isIncompletePath(p) && <p className="text-xs text-muted-foreground">Falta o nome ou o valor deste caminho.</p>}
            {forbidden.length > 0 && (
              <p className="text-xs text-amber-400">Aparece na tela do lead. Evite: {forbidden.join(', ')}.</p>
            )}
            <ProblemList items={problems.paths[p.id] ?? []} />
          </div>
        );
      })}
      <ProblemList items={problems.pathCount} />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => add((o) => cashPath(o.finalPrice, newLocalId('p')))}
          disabled={readOnly || full || hasCash}
        >
          <Zap className="h-3.5 w-3.5" /> {CASH_LABEL}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => add(() => ({ id: newLocalId('p'), label: '', installments: 1, installmentValue: 0, total: 0 }))}
          disabled={readOnly || full}
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar caminho
        </Button>
        {full && <span className="text-xs text-muted-foreground">No máximo {MAX_PAYMENT_PATHS} caminhos.</span>}
      </div>
    </div>
  );
}
