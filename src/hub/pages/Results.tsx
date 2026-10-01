import { useState, useMemo } from 'react';
import { useSales, useProfiles } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { parseLocalDate } from '@/lib/utils';
import { ChevronRight, Trophy, ArrowLeft } from 'lucide-react';
import { MonthlyReport } from '@/components/results/MonthlyReport';

export default function Results() {
  const { data: sales } = useSales();
  const { data: profiles } = useProfiles();
  const { isManager, isFinancial } = useAuth();
  const canSeeFinancial = isManager || isFinancial;
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number } | null>(null);

  const completedMonths = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Find all months that have sales data and are completed
    const monthSet = new Set<string>();
    (sales || []).forEach((s: any) => {
      const d = parseLocalDate(s.date);
      const m = d.getMonth();
      const y = d.getFullYear();
      // Only include months that are fully completed (before current month)
      if (y < currentYear || (y === currentYear && m < currentMonth)) {
        monthSet.add(`${y}-${m}`);
      }
    });

    return Array.from(monthSet)
      .map(key => {
        const [year, month] = key.split('-').map(Number);
        return { month, year };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  }, [sales]);

  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  if (selectedMonth) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <button
          onClick={() => setSelectedMonth(null)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar aos Resultados
        </button>
        <MonthlyReport
          month={selectedMonth.month}
          year={selectedMonth.year}
          sales={sales || []}
          profiles={profiles || []}
          canSeeFinancial={canSeeFinancial}
        />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Resultados</h1>
          <p className="text-sm text-muted-foreground">Relatórios mensais de performance comercial</p>
        </div>
      </div>

      {completedMonths.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">Nenhum mês encerrado disponível ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Os relatórios ficam disponíveis após o encerramento de cada mês.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {completedMonths.map(({ month, year }) => (
            <button
              key={`${year}-${month}`}
              onClick={() => setSelectedMonth({ month, year })}
              className="glass-card p-4 md:p-5 flex items-center justify-between hover:border-primary/30 transition-all group text-left w-full"
            >
              <div>
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {monthNames[month]} {year}
                </h3>
                <p className="text-xs text-muted-foreground">Relatório completo do mês</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
