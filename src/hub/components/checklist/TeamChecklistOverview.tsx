import { filterVisibleProfiles } from '@/lib/hiddenUsers';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Users, CalendarDays, BarChart3, ChevronDown, ChevronUp, CheckCircle2, AlertCircle, Clock, StickyNote, Sparkles } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { SellerAvatar } from '@/components/SellerAvatar';
import { ChecklistHistory } from '@/components/checklist/ChecklistHistory';
import { ProductivityStats } from '@/components/checklist/ProductivityStats';

const TOTAL_TASKS = 8;

function getWorkingDays(month: number, year: number): number {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
}

const today = () => format(new Date(), 'yyyy-MM-dd');

type TodayStatus = 'completed' | 'partial' | 'not_filled';

function getTodayStatus(count: number | undefined): TodayStatus {
  if (count === undefined || count === 0) return 'not_filled';
  if (count >= TOTAL_TASKS) return 'completed';
  return 'partial';
}

function StatusBadge({ status }: { status: TodayStatus }) {
  const config = {
    completed: { icon: CheckCircle2, label: 'Completo', className: 'text-emerald-400 bg-emerald-400/10' },
    partial: { icon: Clock, label: 'Parcial', className: 'text-warning bg-warning/10' },
    not_filled: { icon: AlertCircle, label: 'Não preenchido', className: 'text-error bg-destructive/10' },
  };
  const { icon: Icon, label, className } = config[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function TeamChecklistOverview() {
  const now = new Date();
  const [histMonth, setHistMonth] = useState(now.getMonth());
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [expandedSellers, setExpandedSellers] = useState<Set<string>>(new Set());
  const [selectedSellerId, setSelectedSellerId] = useState<string>('all');

  const workingDays = getWorkingDays(histMonth, histYear);

  // Profiles
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('active', true);
      return data || [];
    },
  });

  const sellers = useMemo(() => filterVisibleProfiles(profiles).filter(p => p.role !== 'gestor'), [profiles]);

  // Today's checklists
  const { data: todayChecklists = [] } = useQuery({
    queryKey: ['daily_checklist_team', today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('*')
        .eq('date', today());
      if (error) throw error;
      return data || [];
    },
  });

  // Monthly checklists for ALL sellers
  const { data: monthlyChecklists = [] } = useQuery({
    queryKey: ['daily_checklist_team_month', histMonth, histYear],
    queryFn: async () => {
      const start = format(startOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('seller_id, date, completed_tasks, notes, reminders')
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Build per-seller data
  const sellerDataMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    monthlyChecklists.forEach((c: any) => {
      if (!map[c.seller_id]) map[c.seller_id] = [];
      map[c.seller_id].push(c);
    });
    return map;
  }, [monthlyChecklists]);

  // Today map
  const todayMap = useMemo(() => {
    const map: Record<string, number> = {};
    todayChecklists.forEach((c: any) => {
      map[c.seller_id] = c.completed_tasks?.length || 0;
    });
    return map;
  }, [todayChecklists]);

  // Team summary
  const teamSummary = useMemo(() => {
    const totalSellers = sellers.length;
    const completedToday = sellers.filter(s => (todayMap[s.id] || 0) >= TOTAL_TASKS).length;
    const incompleteToday = totalSellers - completedToday;

    const participantIds = new Set(sellers.map(seller => seller.id));
    const totalTasksMonth = monthlyChecklists.filter((checklist: any) => participantIds.has(checklist.seller_id)).reduce((sum: number, c: any) => sum + (c.completed_tasks?.length || 0), 0);
    const maxTasks = sellers.length * workingDays * TOTAL_TASKS;
    const avgRate = maxTasks > 0 ? Math.round((totalTasksMonth / maxTasks) * 100) : 0;

    return { totalSellers, completedToday, incompleteToday, totalTasksMonth, avgRate };
  }, [sellers, todayMap, monthlyChecklists, workingDays]);

  const toggleExpand = (id: string) => {
    setExpandedSellers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2026, i, 1), 'MMMM', { locale: ptBR }),
  }));

  // Seller stats helper
  const getSellerStats = (sellerId: string) => {
    const data = sellerDataMap[sellerId] || [];
    const filledDays = data.length;
    const totalTasksDone = data.reduce((sum: number, c: any) => sum + (c.completed_tasks?.length || 0), 0);
    const maxTasks = workingDays * TOTAL_TASKS;
    const avgPerDay = filledDays > 0 ? (totalTasksDone / filledDays).toFixed(1) : '0';
    const rate = maxTasks > 0 ? Math.round((totalTasksDone / maxTasks) * 100) : 0;
    const notes = data.filter((d: any) => d.notes?.trim());
    return { filledDays, totalTasksDone, maxTasks, avgPerDay, rate, notes, data };
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Checklist do Time</h1>
        <span className="text-sm text-muted-foreground ml-auto">{format(new Date(), 'dd/MM/yyyy')}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={histMonth.toString()} onValueChange={v => setHistMonth(parseInt(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()} className="capitalize">{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={histYear.toString()} onValueChange={v => setHistYear(parseInt(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Todos os vendedores" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os vendedores</SelectItem>
            {sellers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Team Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Vendedores', value: teamSummary.totalSellers, icon: Users },
          { label: 'Completos hoje', value: teamSummary.completedToday, icon: CheckCircle2 },
          { label: 'Incompletos hoje', value: teamSummary.incompleteToday, icon: AlertCircle },
          { label: 'Taxa média mensal', value: `${teamSummary.avgRate}%`, icon: BarChart3 },
          { label: 'Tarefas no mês', value: teamSummary.totalTasksMonth, icon: CalendarDays },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className="text-lg font-bold text-foreground">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Seller Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Desempenho Individual
        </h2>

        {sellers.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum vendedor cadastrado.</p>
        )}

        {(selectedSellerId === 'all' ? sellers : sellers.filter(s => s.id === selectedSellerId)).map(seller => {
          const stats = getSellerStats(seller.id);
          const todayCount = todayMap[seller.id];
          const status = getTodayStatus(todayCount);
          const isExpanded = expandedSellers.has(seller.id);

          return (
            <div key={seller.id} className="glass-card overflow-hidden">
              {/* Collapsed header */}
              <button
                onClick={() => toggleExpand(seller.id)}
                className="w-full p-4 flex items-center gap-4 text-left hover:bg-accent/20 transition-colors"
              >
                <SellerAvatar name={seller.name} avatarUrl={seller.avatar_url} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-foreground truncate">{seller.name}</p>
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1.5">
                    <Progress value={stats.rate} className="flex-1 h-2 max-w-48" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {stats.filledDays}/{workingDays} dias · {stats.rate}%
                    </span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span>{stats.totalTasksDone} tarefas</span>
                  <span>~{stats.avgPerDay}/dia</span>
                </div>
                {stats.rate === 100 && <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />}
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  {/* Stats cards */}
                  <ProductivityStats checklists={stats.data} workingDays={workingDays} />

                  {/* Calendar heatmap */}
                  <div className="glass-card p-5">
                    <ChecklistHistory checklists={stats.data} month={histMonth} year={histYear} />
                  </div>

                  {/* Notes */}
                  {stats.notes.length > 0 && (
                    <div className="glass-card p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <StickyNote className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Observações do mês</h3>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {stats.notes
                          .sort((a: any, b: any) => a.date.localeCompare(b.date))
                          .map((d: any) => (
                            <div key={d.date} className="text-sm border-l-2 border-primary/30 pl-3 py-1">
                              <span className="text-xs text-muted-foreground font-medium">
                                {format(new Date(d.date + 'T12:00:00'), 'dd/MM')}
                              </span>
                              <p className="text-foreground/80 mt-0.5">{d.notes}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
