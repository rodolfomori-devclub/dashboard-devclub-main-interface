/** Pecas de formulario das telas de preparacao (tema escuro do Hub). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { formatDecimalBR, parseDecimalBR } from '@/lib/diagnostic/prepChecklist';

export function Field({
  id,
  label,
  hint,
  error,
  className,
  children,
}: {
  id?: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('space-y-1.5 min-w-0', className)}>
      <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-red-400">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

type Tone = 'info' | 'warn' | 'danger' | 'ok';

const TONE: Record<Tone, { box: string; icon: typeof Info }> = {
  info: { box: 'border-border/60 bg-muted/30 text-muted-foreground', icon: Info },
  warn: { box: 'border-amber-400/30 bg-amber-500/10 text-amber-300', icon: TriangleAlert },
  danger: { box: 'border-red-400/30 bg-red-500/10 text-red-300', icon: CircleAlert },
  ok: { box: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300', icon: CircleCheck },
};

export function Notice({ tone = 'info', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const { box, icon: Icon } = TONE[tone];
  return (
    <div className={cn('rounded-md border px-3 py-2 text-xs flex gap-2', box, className)}>
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1 space-y-1">{children}</div>
    </div>
  );
}

/** Problemas da oferta ao lado do campo que os causa. */
export function ProblemList({ items }: { items: { message: string }[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-0.5">
      {items.map((p) => (
        <p key={p.message} className="text-xs text-amber-400 flex gap-1">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>{p.message}</span>
        </p>
      ))}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  title?: string;
}

/** Escolha unica curta (mesmo desenho da troca de etapas do cabecalho). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-border p-0.5 shrink-0">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={o.title}
            disabled={disabled || o.disabled}
            onClick={() => !selected && onChange(o.value)}
            className={cn(
              'px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap disabled:cursor-not-allowed',
              selected ? 'bg-primary/15 text-primary font-medium' : 'text-muted-foreground hover:text-foreground',
              (disabled || o.disabled) && !selected && 'opacity-40 hover:text-muted-foreground',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ChoiceOption {
  value: string;
  label: string;
}

// O Select do Radix nao aceita item com valor vazio.
const EMPTY = '__vazio__';

/**
 * Select de uma resposta. Valor que nao esta na lista (resposta livre, conteudo
 * antigo) continua aparecendo como opcao, para nunca se perder ao abrir a tela.
 */
export function ChoiceSelect({
  id,
  value,
  options,
  onChange,
  emptyLabel = 'Não respondeu',
  allowEmpty = true,
  disabled,
  className,
}: {
  id?: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  emptyLabel?: string;
  /** false: sem a opcao "vazio" (ex.: perfil, que sempre tem um escolhido). */
  allowEmpty?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const extra = value && !options.some((o) => o.value === value) ? [{ value, label: `${value} (fora da lista)` }] : [];
  return (
    <Select value={value || (allowEmpty ? EMPTY : '')} onValueChange={(v) => onChange(v === EMPTY ? '' : v)} disabled={disabled}>
      <SelectTrigger id={id} className={cn('h-9 text-sm', !value && 'text-muted-foreground', className)}>
        <SelectValue placeholder={emptyLabel} />
      </SelectTrigger>
      <SelectContent>
        {allowEmpty && (
          <SelectItem value={EMPTY} className="text-muted-foreground">
            {emptyLabel}
          </SelectItem>
        )}
        {[...options, ...extra].map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface DecimalRules {
  integer?: boolean;
  /** Casas decimais aceitas. */
  maxDecimals?: number;
  min?: number;
  max?: number;
}

/** Por que o numero nao pode ser gravado; null quando pode (vazio tambem pode). */
function decimalProblem(n: number | null, { integer, maxDecimals, min, max }: DecimalRules): string | null {
  if (n === null) return null;
  if (Number.isNaN(n)) return 'Não é um número.';
  if (integer && !Number.isInteger(n)) return 'Use um número inteiro.';
  if (maxDecimals !== undefined) {
    const scale = 10 ** maxDecimals;
    if (Math.round(n * scale) / scale !== n) {
      return `Use no máximo ${maxDecimals} ${maxDecimals === 1 ? 'casa decimal' : 'casas decimais'}.`;
    }
  }
  if (min !== undefined && n < min) return `O mínimo é ${formatDecimalBR(min)}.`;
  if (max !== undefined && n > max) return `O máximo é ${formatDecimalBR(max)}.`;
  return null;
}

/**
 * Numero digitado no jeito brasileiro ("8.097,00", "2,5"). Guarda o texto
 * enquanto a pessoa digita e so grava numero valido dentro dos limites. Texto
 * invalido fica na tela, em vermelho, ate ser corrigido, e o valor gravado volta
 * ao de antes da edicao: nunca fica um pedaco do numero (o 20 de "200").
 */
export function DecimalInput({
  id,
  value,
  onCommit,
  cents,
  integer,
  maxDecimals,
  min,
  max,
  disabled,
  placeholder,
  className,
  ariaLabel,
}: {
  id?: string;
  value: number | null;
  onCommit: (value: number | null) => void;
  cents?: boolean;
  integer?: boolean;
  /** Casas decimais aceitas (ex.: 1 nas horas, como a tela do lead mostra). */
  maxDecimals?: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => formatDecimalBR(value, cents));
  const editingRef = useRef(false);
  // Valor gravado quando a edicao comecou: e o que fica se o texto final for invalido.
  const baseRef = useRef(value);

  // Valor trocado por fora (padrao do vendedor, outra janela): mostra o novo.
  useEffect(() => {
    if (editingRef.current) return;
    baseRef.current = value;
    setText(formatDecimalBR(value, cents));
  }, [value, cents]);

  const rules: DecimalRules = { integer, maxDecimals, min, max };
  const problem = decimalProblem(parseDecimalBR(text), rules);
  const saved = formatDecimalBR(value, cents);
  // O campo mostra o proprio valor gravado (fora da regra): so diz o que corrigir.
  const title = !problem
    ? undefined
    : text.trim() === saved
      ? problem
      : `${problem} Não foi salvo: continua ${saved || 'em branco'}.`;

  return (
    <Input
      id={id}
      value={text}
      inputMode={integer ? 'numeric' : 'decimal'}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={ariaLabel}
      aria-invalid={problem ? true : undefined}
      title={title}
      onFocus={() => {
        editingRef.current = true;
        baseRef.current = value;
      }}
      onBlur={() => {
        editingRef.current = false;
        baseRef.current = value;
        if (!problem) setText(formatDecimalBR(value, cents));
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const parsed = parseDecimalBR(next);
        if (!decimalProblem(parsed, rules)) onCommit(parsed);
        else if (value !== baseRef.current) onCommit(baseRef.current);
      }}
      className={cn('h-9 tabular-nums', problem && 'border-red-400 focus-visible:ring-red-400', className)}
    />
  );
}
