import { Button } from '@/components/ui/button';
import type { DateRange } from 'react-day-picker';

interface Props {
  onSelect: (range: DateRange) => void;
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export default function DateRangePresets({ onSelect }: Props) {
  const today = startOfDay(new Date());

  const presets: { label: string; get: () => DateRange }[] = [
    { label: 'Hoje', get: () => ({ from: today, to: today }) },
    {
      label: 'Ontem',
      get: () => {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        return { from: y, to: y };
      },
    },
    {
      label: '7 dias',
      get: () => {
        const f = new Date(today);
        f.setDate(f.getDate() - 6);
        return { from: f, to: today };
      },
    },
    {
      label: '30 dias',
      get: () => {
        const f = new Date(today);
        f.setDate(f.getDate() - 29);
        return { from: f, to: today };
      },
    },
    {
      label: 'Esse mês',
      get: () => ({
        from: new Date(today.getFullYear(), today.getMonth(), 1),
        to: today,
      }),
    },
  ];

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-border">
      {presets.map((p) => (
        <Button
          key={p.label}
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={() => onSelect(p.get())}
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
