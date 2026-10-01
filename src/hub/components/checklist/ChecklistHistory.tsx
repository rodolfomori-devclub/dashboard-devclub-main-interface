import { useMemo } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const TOTAL_TASKS = 8;

interface ChecklistRecord {
  date: string;
  completed_tasks: string[];
}

interface Props {
  checklists: ChecklistRecord[];
  month: number;
  year: number;
}

// Escada de intensidade do heatmap. O ultimo degrau (7/7) e o unico roxo do
// app nesta tela: `premium` e o token de escassez do DevClub e um dia completo
// e exatamente a "conquista rara" que ele existe para marcar.
//
// Todos os degraus ficam em ~50% de alpha de proposito: o numero do dia e
// desenhado por cima com `text-foreground` (navy-12, quase branco). Roxo
// premium CHAPADO tem L=0.721 e derruba esse texto para ~2.5:1 — a 50% sobre
// o card ele volta para ~6:1, no mesmo patamar dos outros degraus.
function getColor(count: number): string {
  if (count === 0) return 'bg-destructive/40';
  if (count <= 3) return 'bg-warning/50';
  if (count <= 6) return 'bg-success/50';
  return 'bg-premium/50'; // roxo de escassez — dia completo
}

function getLabel(count: number): string {
  if (count === 0) return '🔴 Nenhuma tarefa';
  if (count <= 3) return `🟡 ${count} tarefa${count > 1 ? 's' : ''}`;
  if (count <= 6) return `🟢 ${count} tarefas`;
  return `🟣 ${count} tarefas (completo!)`;
}

export function ChecklistHistory({ checklists, month, year }: Props) {
  const map = useMemo(() => {
    const m: Record<string, number> = {};
    checklists.forEach(c => {
      m[c.date] = c.completed_tasks?.length || 0;
    });
    return m;
  }, [checklists]);

  const monthStart = startOfMonth(new Date(year, month));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const monthName = format(monthStart, 'MMMM yyyy', { locale: ptBR });

  // Pad start to align with weekdays (Sun=0)
  const startPad = getDay(monthStart);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground capitalize">{monthName}</h3>

      {/* Weekday labels */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
          <span key={i} className="text-xs text-muted-foreground font-medium">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <TooltipProvider delayDuration={200}>
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for padding */}
          {Array.from({ length: startPad }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const count = map[dateStr] ?? -1; // -1 = no data
            const isPast = day <= new Date();
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

            return (
              <Tooltip key={dateStr}>
                <TooltipTrigger asChild>
                  <div
                    className={`aspect-square rounded-sm flex items-center justify-center text-xs font-medium transition-all cursor-default
                      ${isToday ? 'ring-2 ring-primary ring-offset-1 ring-offset-background' : ''}
                      ${count >= 0 ? getColor(count) : isPast ? 'bg-muted/30' : 'bg-muted/10'}
                      ${count >= 0 ? 'text-foreground' : 'text-muted-foreground/50'}
                    `}
                  >
                    {day.getDate()}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {count >= 0
                    ? `${getLabel(count)} — ${count}/${TOTAL_TASKS}`
                    : isPast ? 'Não preenchido' : 'Futuro'
                  }
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-destructive/40" /> 0</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-warning/50" /> 1-3</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-success/50" /> 4-6</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-premium/50" /> 7</span>
      </div>
    </div>
  );
}
