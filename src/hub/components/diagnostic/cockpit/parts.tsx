import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-wider text-muted-foreground', className)}>{children}</p>;
}

/** Botao de escolha unica (clicar de novo na escolhida limpa). */
export function ChoiceButton({
  selected,
  disabled,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        selected
          ? 'border-primary/60 bg-primary/10 font-medium text-foreground'
          : 'border-border/60 text-muted-foreground enabled:hover:border-foreground/40 enabled:hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Aviso curto dentro do bloco. */
export function Note({ tone = 'muted', children, className }: { tone?: 'muted' | 'warn' | 'ok'; children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        tone === 'warn' && 'border-amber-400/40 bg-amber-500/10 text-amber-300',
        tone === 'ok' && 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300',
        tone === 'muted' && 'border-border/60 bg-muted/30 text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  );
}
