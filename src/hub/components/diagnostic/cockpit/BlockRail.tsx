import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallBlock } from '@diag/types.ts';
import { isBlockDone, isShortModeBlock, shortTitle } from '@/lib/diagnostic/cockpit';
import { patchCallData } from '@/lib/diagnostic/workspace';
import { useCockpit } from './cockpitContext';

function Badge({ block, index, done }: { block: CallBlock; index: number; done: boolean }) {
  return (
    <span
      className={cn(
        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
        done ? 'bg-emerald-500/15 text-emerald-400' : 'bg-muted text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {done ? <Check className="h-3.5 w-3.5" /> : block.sigla || index + 1}
    </span>
  );
}

/**
 * Os 9 blocos do playbook. Clique (ou Alt+1..9) vai para o bloco; o atual fica
 * destacado e os concluidos (visitados e com checklist completo) ganham check.
 * No modo curto so devolutiva e proximo passo ficam em destaque.
 */
export function BlockRail({ orientation }: { orientation: 'vertical' | 'horizontal' }) {
  const { api, blocks, block: current, goToBlock, readOnly, write } = useCockpit();
  const cd = api.ws.diagnosis.call_data;
  const listRef = useRef<HTMLOListElement>(null);
  const currentRef = useRef<HTMLButtonElement>(null);
  const horizontal = orientation === 'horizontal';

  // Centraliza o bloco atual so dentro da faixa (scrollIntoView tambem rolaria a pagina).
  useEffect(() => {
    const strip = listRef.current;
    const chip = currentRef.current;
    if (!horizontal || !strip || !chip || typeof strip.scrollBy !== 'function') return;
    const s = strip.getBoundingClientRect();
    const c = chip.getBoundingClientRect();
    strip.scrollBy({ left: c.left - s.left - (s.width - c.width) / 2 });
  }, [horizontal, current.id]);

  return (
    <nav aria-label="Blocos da call" className={cn(horizontal ? '-mx-3 px-3 sm:mx-0 sm:px-0' : 'space-y-2')}>
      {cd.shortMode && (
        <div className={cn('flex items-center gap-2 text-xs text-amber-300', horizontal && 'mb-1.5')}>
          <span className="font-medium">Modo curto: devolutiva, compromisso e encerramento</span>
          {!readOnly && (
            <button
              type="button"
              onClick={() => write((w) => patchCallData(w, { shortMode: false }))}
              className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Sair
            </button>
          )}
        </div>
      )}
      <ol ref={listRef} className={cn(horizontal ? 'flex gap-1.5 overflow-x-auto pb-1' : 'flex flex-col gap-1')}>
        {blocks.map((b, i) => {
          const active = b.id === current.id;
          const done = isBlockDone(b, cd);
          const dimmed = cd.shortMode && !isShortModeBlock(b.id) && !active;
          const highlighted = cd.shortMode && isShortModeBlock(b.id) && !active;
          return (
            <li key={b.id} className={cn(horizontal && 'shrink-0')}>
              <button
                ref={active ? currentRef : undefined}
                type="button"
                onClick={() => goToBlock(b.id)}
                aria-current={active ? 'step' : undefined}
                title={`Alt+${i + 1}`}
                className={cn(
                  'flex items-center gap-2 rounded-md border text-left transition-colors',
                  horizontal ? 'px-2.5 py-1.5' : 'w-full px-2.5 py-2',
                  active ? 'border-primary bg-primary/10' : 'border-transparent hover:bg-accent/50',
                  highlighted && 'border-amber-400/60 bg-amber-500/5',
                  dimmed && 'opacity-40',
                )}
              >
                <Badge block={b} index={i} done={done} />
                <span className="min-w-0">
                  <span className={cn('block text-sm leading-tight', active ? 'font-semibold text-foreground' : 'text-foreground/90')}>
                    {horizontal ? shortTitle(b) : b.titulo}
                  </span>
                  <span className="block text-[11px] tabular-nums text-muted-foreground">
                    min {b.min_inicio}-{b.min_fim}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {!horizontal && <p className="px-1 pt-1 text-[11px] text-muted-foreground">Alt+1 a 9 vai ao bloco · Alt+N próximo</p>}
    </nav>
  );
}
