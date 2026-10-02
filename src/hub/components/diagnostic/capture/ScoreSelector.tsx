import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { LEVEL_TEXT_CLASS } from '@/lib/diagnostic/capture';
import { LEVEL_LABEL, levelOf } from '@diag/derive.ts';
import type { Level, Pillar } from '@diag/types.ts';

const LEVEL_BUTTON_CLASS: Record<Level, string> = {
  trava: 'bg-red-500/20 border-red-400 text-red-300',
  em_construcao: 'bg-amber-500/20 border-amber-400 text-amber-300',
  ponto_forte: 'bg-emerald-500/20 border-emerald-400 text-emerald-300',
};

const LEVEL_ROWS: { level: Level; range: string; key: 'texto_trava' | 'texto_em_construcao' | 'texto_ponto_forte' }[] = [
  { level: 'trava', range: '1-2', key: 'texto_trava' },
  { level: 'em_construcao', range: '3', key: 'texto_em_construcao' },
  { level: 'ponto_forte', range: '4-5', key: 'texto_ponto_forte' },
];

interface Props {
  pillar: Pillar;
  value: number | null;
  onChange: (value: number | null) => void;
  /** Evidencia curta da nota (call_data.scoreNotes). */
  note?: string;
  onNoteChange?: (note: string) => void;
  readOnly?: boolean;
  /** Mostra a pergunta que revela a nota (cockpit). */
  showQuestion?: boolean;
  className?: string;
}

/** Nota de 1 a 5 de um pilar, com os tres textos de nivel do PDF para comparar. */
export function ScoreSelector({ pillar, value, onChange, note, onNoteChange, readOnly, showQuestion, className }: Props) {
  const level = levelOf(value);
  return (
    <div className={cn('rounded-md border border-border/60 p-3 space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{pillar.nome}</span>
        <span className={cn('text-xs font-medium', level ? LEVEL_TEXT_CLASS[level] : 'text-muted-foreground')}>
          {level ? `${value}/5 · ${LEVEL_LABEL[level]}` : 'Sem nota'}
        </span>
      </div>
      {showQuestion && <p className="text-xs italic text-muted-foreground">"{pillar.pergunta_que_revela}"</p>}
      <div className="flex gap-1.5" role="radiogroup" aria-label={`Nota de ${pillar.nome}`}>
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          const l = levelOf(n)!;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={readOnly}
              // Clicar de novo na nota escolhida limpa a nota.
              onClick={() => onChange(selected ? null : n)}
              className={cn(
                'h-9 w-9 rounded-md border text-sm font-semibold tabular-nums transition-colors disabled:opacity-60',
                selected ? LEVEL_BUTTON_CLASS[l] : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/40',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <ul className="space-y-1">
        {LEVEL_ROWS.map((row) => (
          <li
            key={row.level}
            className={cn(
              'text-xs leading-snug',
              level === row.level ? cn(LEVEL_TEXT_CLASS[row.level], 'font-medium') : 'text-muted-foreground/80',
            )}
          >
            <span className="tabular-nums">{row.range}</span> · {pillar[row.key]}
          </li>
        ))}
      </ul>
      {onNoteChange && (
        <Input
          value={note ?? ''}
          onChange={(e) => onNoteChange(e.target.value)}
          disabled={readOnly}
          placeholder="Evidência: o que ele disse ou mostrou"
          className="h-8 text-xs"
        />
      )}
    </div>
  );
}
