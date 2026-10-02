import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addDaysYmd, diffDaysYmd, isValidYmd, weekdayLongBR, ymdToBR } from '@diag/dates.ts';
import { findForbidden } from '@diag/guardrails.ts';
import type { Guardrails, Pillar } from '@diag/types.ts';

const QUICK_DAYS = [3, 5, 7];

export interface CommitmentValue {
  text: string;
  dueDate: string | null;
  /** PillarId do movimento, 'custom' ou ''. */
  movement: string;
}

interface Props {
  value: CommitmentValue;
  onChange: (patch: Partial<CommitmentValue>) => void;
  /** Os 3 movimentos do plano (model.plan); vazio enquanto faltam notas. */
  plan: Pillar[];
  todayYmd: string;
  guardrails: Guardrails;
  readOnly?: boolean;
}

function dayLabel(ymd: string): string {
  return `${weekdayLongBR(ymd)}, ${ymdToBR(ymd).slice(0, 5)}`;
}

/** Ano entre o ano passado e daqui a 2 anos: o resto e o ano ainda sendo digitado. */
function plausibleDue(ymd: string, todayYmd: string): boolean {
  if (!isValidYmd(ymd)) return false;
  const year = Number(ymd.slice(0, 4));
  const now = Number(todayYmd.slice(0, 4));
  return year >= now - 1 && year <= now + 2;
}

/**
 * O campo de data do navegador solta datas como 0002-10-15 enquanto o ano e
 * digitado, e a data vai ao vivo para a tela do lead: so a data plausivel sai daqui.
 */
function DueDateInput({
  value,
  todayYmd,
  onChange,
  disabled,
}: {
  value: string | null;
  todayYmd: string;
  onChange: (ymd: string | null) => void;
  disabled?: boolean;
}) {
  const [raw, setRaw] = useState(value ?? '');
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setRaw(value ?? '');
  }, [value, focused]);
  return (
    <Input
      type="date"
      value={raw}
      min={todayYmd}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        setRaw(value ?? '');
      }}
      onChange={(e) => {
        const v = e.target.value;
        setRaw(v);
        if (!v) onChange(null);
        else if (plausibleDue(v, todayYmd)) onChange(v);
      }}
      disabled={disabled}
      className="w-[160px]"
      aria-label="Data do compromisso"
    />
  );
}

/** "Qual desses 3 movimentos você começa, e até quando?" — escolha dele, com data. */
export function CommitmentEditor({ value, onChange, plan, todayYmd, guardrails, readOnly }: Props) {
  const due = value.dueDate && isValidYmd(value.dueDate) ? value.dueDate : null;
  const daysAhead = due ? diffDaysYmd(todayYmd, due) : null;
  const forbidden = value.text ? findForbidden(value.text, guardrails) : [];

  return (
    <div className="space-y-3">
      {plan.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Movimento que ele escolheu:</p>
          <div className="flex flex-col gap-1.5">
            {plan.map((p, i) => (
              <button
                key={p.id}
                type="button"
                disabled={readOnly}
                onClick={() => onChange({ movement: value.movement === p.id ? '' : p.id })}
                className={cn(
                  'text-left rounded-md border px-2.5 py-2 text-xs transition-colors',
                  value.movement === p.id
                    ? 'border-primary/60 bg-primary/10 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground',
                )}
              >
                <span className="font-medium text-foreground">
                  {i + 1}. {p.nome}:
                </span>{' '}
                {p.movimento_90_dias}
              </button>
            ))}
            <button
              type="button"
              disabled={readOnly}
              onClick={() => onChange({ movement: value.movement === 'custom' ? '' : 'custom' })}
              className={cn(
                'text-left rounded-md border px-2.5 py-1.5 text-xs',
                value.movement === 'custom' ? 'border-primary/60 bg-primary/10 text-foreground' : 'border-border/60 text-muted-foreground',
              )}
            >
              Outro movimento, dito por ele
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Os 3 movimentos aparecem quando as 5 notas estiverem dadas.</p>
      )}

      <div className="space-y-1.5">
        <label htmlFor="diag-commitment-text" className="text-xs text-muted-foreground">
          O que ele vai fazer, nas palavras dele
        </label>
        <Input
          id="diag-commitment-text"
          value={value.text}
          onChange={(e) => onChange({ text: e.target.value })}
          disabled={readOnly}
          placeholder="Ex.: Refazer com IA o relatório mensal de despesas"
        />
        {forbidden.length > 0 && (
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            Vai para o diagnóstico do lead. Evite: {forbidden.join(', ')}.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-xs text-muted-foreground">Até quando</span>
        <div className="flex items-center gap-2 flex-wrap">
          <DueDateInput
            value={value.dueDate}
            todayYmd={todayYmd}
            onChange={(dueDate) => onChange({ dueDate })}
            disabled={readOnly}
          />
          {!readOnly &&
            QUICK_DAYS.map((d) => {
              const ymd = addDaysYmd(todayYmd, d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => onChange({ dueDate: ymd })}
                  className={cn(
                    'h-8 rounded-md border px-2 text-xs',
                    value.dueDate === ymd ? 'border-primary/60 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dayLabel(ymd)}
                </button>
              );
            })}
        </div>
        {due && daysAhead !== null && (
          <p className={cn('text-xs', daysAhead < 0 ? 'text-red-400' : 'text-muted-foreground')}>
            {daysAhead < 0 ? 'Essa data já passou.' : `${dayLabel(due)}: nesse dia você liga para saber como foi.`}
          </p>
        )}
      </div>
    </div>
  );
}
