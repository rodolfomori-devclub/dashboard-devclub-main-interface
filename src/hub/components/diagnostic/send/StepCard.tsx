import type { ReactNode } from 'react';
import { Check, Lock, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import type { DeliveryStep } from '@/lib/diagnostic/send';

/** O que cada passo da entrega recebe da tela. */
export interface StepProps {
  api: ReadyWorkspace;
  step: DeliveryStep;
  index: number;
  now: number;
}

export type StatusTone = 'done' | 'pending' | 'late' | 'muted';

const TONE_CLASS: Record<StatusTone, string> = {
  done: 'text-emerald-400',
  pending: 'text-amber-400',
  late: 'text-red-400',
  muted: 'text-muted-foreground',
};

interface StepCardProps {
  /** Ancora (links "ir para"). */
  id: string;
  index: number;
  title: string;
  hint?: string;
  done: boolean;
  /** Texto curto a direita do titulo. */
  status?: ReactNode;
  tone?: StatusTone;
  children?: ReactNode;
}

/** Cartao de um passo da entrega: numero (ou check quando feito), titulo e estado. */
export function StepCard({ id, index, title, hint, done, status, tone = 'muted', children }: StepCardProps) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="glass-card p-4 md:p-5 space-y-4 scroll-mt-4">
      <header className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums',
            done ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-400' : 'border-border text-muted-foreground',
          )}
        >
          {done ? <Check className="h-4 w-4" aria-hidden="true" /> : <span aria-hidden="true">{index}</span>}
          <span className="sr-only">{done ? `Passo ${index}, feito` : `Passo ${index}`}</span>
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id}-title`} className="section-title leading-tight">
            {title}
          </h3>
          {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
        </div>
        {status && <span className={cn('shrink-0 text-right text-xs font-medium', TONE_CLASS[tone])}>{status}</span>}
      </header>
      {children}
    </section>
  );
}

/** Bloco dentro de um passo, com titulo pequeno e acao opcional a direita. */
export function SubSection({
  id,
  title,
  hint,
  action,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div id={id} className="space-y-2.5 border-t border-border/60 pt-4 scroll-mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-foreground">{title}</h4>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** Por que a acao do passo esta travada. */
export function BlockedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Aviso que nao trava (palavra a evitar, pagina passando do A4). */
export function WarnNote({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p role="status" className={cn('flex items-start gap-1.5 text-xs text-amber-400', className)}>
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
