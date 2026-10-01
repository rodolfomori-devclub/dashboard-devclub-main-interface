import { useMemo } from 'react';
import { CalendarCheck, CheckSquare, TrendingUp } from 'lucide-react';

const TOTAL_TASKS = 8;

interface ChecklistRecord {
  date: string;
  completed_tasks: string[];
}

interface Props {
  checklists: ChecklistRecord[];
  workingDays: number;
}

export function ProductivityStats({ checklists, workingDays }: Props) {
  const stats = useMemo(() => {
    const filledDays = checklists.length;
    const totalTasksDone = checklists.reduce((sum, c) => sum + (c.completed_tasks?.length || 0), 0);
    const maxTasks = workingDays * TOTAL_TASKS;
    const rate = maxTasks > 0 ? Math.round((totalTasksDone / maxTasks) * 100) : 0;

    return { filledDays, totalTasksDone, maxTasks, rate };
  }, [checklists, workingDays]);

  const items = [
    {
      icon: CalendarCheck,
      label: 'Checklist preenchido',
      value: `${stats.filledDays} / ${workingDays} dias úteis`,
    },
    {
      icon: CheckSquare,
      label: 'Tarefas concluídas',
      value: `${stats.totalTasksDone} / ${stats.maxTasks}`,
    },
    {
      icon: TrendingUp,
      label: 'Taxa de execução',
      value: `${stats.rate}%`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map(({ icon: Icon, label, value }) => (
        <div key={label} className="glass-card p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-sm font-semibold text-foreground">{value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
