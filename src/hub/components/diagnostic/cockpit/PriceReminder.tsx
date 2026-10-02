import { CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { priceReminder } from '@/lib/diagnostic/cockpit';
import { useCockpit } from './cockpitContext';

/** "Ele perguntou o preço" antes da devolutiva: o lembrete do playbook, sem número. */
export function PriceReminder() {
  const { api, block, goToBlock } = useCockpit();
  const costStated = api.ws.diagnosis.call_data.costStated;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className="-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground">
          <CircleDollarSign />
          Ele perguntou o preço
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] space-y-3">
        <p className="text-sm font-semibold text-foreground">Antes de falar de preço</p>
        <ul className="list-disc space-y-1 pl-4 text-sm">
          {priceReminder(api.content).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={cn('text-xs', costStated ? 'text-emerald-400' : 'text-amber-400')}>
          {costStated ? 'Ele já disse o custo de ficar como está.' : 'Ele ainda não disse o custo de ficar como está.'}
        </p>
        {block.id !== 'implicacao' && (
          <Button type="button" size="sm" variant="outline" onClick={() => goToBlock('implicacao')}>
            Ir para a Implicação
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
