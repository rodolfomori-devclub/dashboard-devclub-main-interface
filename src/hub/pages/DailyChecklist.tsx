import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Square, ClipboardCheck, Sparkles, StickyNote, CalendarDays } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReminderNotes, type Reminder } from '@/components/checklist/ReminderNotes';
import { TeamChecklistOverview } from '@/components/checklist/TeamChecklistOverview';
import { ChecklistHistory } from '@/components/checklist/ChecklistHistory';
import { ProductivityStats } from '@/components/checklist/ProductivityStats';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const CHECKLIST_ITEMS_SELLER = [
  'Preencher KPIs',
  'Atualizar ranking de vendas',
  'Confirmar calls do dia',
  'Organizar disparos do dia',
  'Responder leads em aberto',
  'Fazer follows (Global - DevClub)',
];

const CHECKLIST_ITEMS_PRESALES = [
  'Agendar 15 novas calls',
  'Follow-up de calls agendadas para hoje',
  'Follow-up de calls agendadas para amanhã',
  'Leitura Diária (Spin Selling)',
];

const today = () => format(new Date(), 'yyyy-MM-dd');

function getWorkingDays(month: number, year: number): number {
  const start = startOfMonth(new Date(year, month));
  const end = endOfMonth(start);
  return eachDayOfInterval({ start, end }).filter(d => !isWeekend(d)).length;
}

export default function DailyChecklist() {
  const { user, isManager } = useAuth();
  const isPreSales = user?.role === 'pre-vendedor';
  const CHECKLIST_ITEMS = isPreSales ? CHECKLIST_ITEMS_PRESALES : CHECKLIST_ITEMS_SELLER;
  const queryClient = useQueryClient();
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [justChecked, setJustChecked] = useState<string | null>(null);
  const [showGreeting, setShowGreeting] = useState(false);

  // History month/year state (shared by seller & manager)
  const now = new Date();
  const [histMonth, setHistMonth] = useState(now.getMonth());
  const [histYear, setHistYear] = useState(now.getFullYear());

  // Manager filter state
  const [selectedSellerId, setSelectedSellerId] = useState<string>('');

  // ── Seller: today's checklist ──
  const { data: checklistData, isLoading } = useQuery({
    queryKey: ['daily_checklist', user?.id, today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('*')
        .eq('seller_id', user!.id)
        .eq('date', today())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !isManager,
  });

  // ── Seller: monthly history ──
  const { data: sellerMonthlyData = [] } = useQuery({
    queryKey: ['daily_checklist_month', user?.id, histMonth, histYear],
    queryFn: async () => {
      const start = format(startOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('date, completed_tasks')
        .eq('seller_id', user!.id)
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      return (data || []) as { date: string; completed_tasks: string[] }[];
    },
    enabled: !!user && !isManager,
  });

  // ── Manager queries ──
  const { data: teamChecklists } = useQuery({
    queryKey: ['daily_checklist_team', today()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('*')
        .eq('date', today());
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && isManager,
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('active', true);
      return data || [];
    },
    enabled: isManager,
  });

  // Manager: selected seller monthly history
  const { data: managerMonthlyData = [] } = useQuery({
    queryKey: ['daily_checklist_month', selectedSellerId, histMonth, histYear],
    queryFn: async () => {
      const start = format(startOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const end = format(endOfMonth(new Date(histYear, histMonth)), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_checklist')
        .select('date, completed_tasks, notes, reminders')
        .eq('seller_id', selectedSellerId)
        .gte('date', start)
        .lte('date', end);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!selectedSellerId && isManager,
  });

  // ── Seller: sync state from DB ──
  useEffect(() => {
    if (checklistData) {
      setCompletedTasks(checklistData.completed_tasks || []);
      setNotes(checklistData.notes || '');
      const raw = checklistData as any;
      setReminders(Array.isArray(raw.reminders) ? raw.reminders : []);
    } else if (!isLoading && !isManager) {
      setCompletedTasks([]);
      setNotes('');
      setReminders([]);
      const greetingKey = `checklist_greeting_${today()}`;
      if (!sessionStorage.getItem(greetingKey)) {
        setShowGreeting(true);
        sessionStorage.setItem(greetingKey, 'true');
      }
    }
  }, [checklistData, isLoading, isManager]);

  const saveMutation = useMutation({
    mutationFn: async ({ tasks, noteText, rems }: { tasks: string[]; noteText: string; rems: Reminder[] }) => {
      const payload = {
        seller_id: user!.id,
        date: today(),
        completed_tasks: tasks,
        notes: noteText,
        reminders: rems as any,
      };
      const { error } = await supabase
        .from('daily_checklist')
        .upsert(payload as any, { onConflict: 'seller_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_checklist'] });
    },
  });

  const persist = useCallback((tasks: string[], noteText: string, rems: Reminder[]) => {
    saveMutation.mutate({ tasks, noteText, rems });
  }, [saveMutation]);

  const toggleTask = useCallback((task: string) => {
    setCompletedTasks(prev => {
      const next = prev.includes(task) ? prev.filter(t => t !== task) : [...prev, task];
      if (!prev.includes(task)) {
        setJustChecked(task);
        setTimeout(() => setJustChecked(null), 600);
      }
      persist(next, notes, reminders);
      return next;
    });
  }, [notes, reminders, persist]);

  const saveNotes = useCallback(() => {
    persist(completedTasks, notes, reminders);
    toast.success('Observações salvas!');
  }, [completedTasks, notes, reminders, persist]);

  const addReminder = useCallback((text: string) => {
    const newRem: Reminder = { id: crypto.randomUUID(), text, done: false };
    setReminders(prev => {
      const next = [...prev, newRem];
      persist(completedTasks, notes, next);
      toast.success('Lembrete criado!');
      return next;
    });
  }, [completedTasks, notes, persist]);

  const toggleReminder = useCallback((id: string) => {
    setReminders(prev => {
      const next = prev.map(r => r.id === id ? { ...r, done: !r.done } : r);
      persist(completedTasks, notes, next);
      return next;
    });
  }, [completedTasks, notes, persist]);

  const deleteReminder = useCallback((id: string) => {
    setReminders(prev => {
      const next = prev.filter(r => r.id !== id);
      persist(completedTasks, notes, next);
      return next;
    });
  }, [completedTasks, notes, persist]);

  const progress = Math.round((completedTasks.length / CHECKLIST_ITEMS.length) * 100);
  const allDone = completedTasks.length === CHECKLIST_ITEMS.length;

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2026, i, 1), 'MMMM', { locale: ptBR }),
  }));

  if (!user) return null;

  // ═══════════════════ MANAGER VIEW ═══════════════════
  if (isManager) {
    return <TeamChecklistOverview />;
  }

  // ═══════════════════ SELLER VIEW ═══════════════════
  const workingDays = getWorkingDays(histMonth, histYear);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Greeting banner */}
      {showGreeting && (
        <div className="glass-card p-5 border-primary/30 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-500 mb-6">
          <div>
            <p className="text-lg font-semibold text-foreground">☀️ Bom dia! Vamos começar com seu checklist do dia.</p>
            <p className="text-sm text-muted-foreground mt-1">Complete todas as tarefas para manter sua disciplina operacional.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowGreeting(false)}>Fechar</Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <ClipboardCheck className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Checklist Diário</h1>
        <span className="text-sm text-muted-foreground ml-auto">{format(new Date(), 'dd/MM/yyyy')}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column — checklist + notes + history */}
        <div className="flex-1 space-y-6 min-w-0">
          {/* Progress */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Progresso do dia</p>
              <p className="text-sm font-semibold text-foreground">
                {completedTasks.length} / {CHECKLIST_ITEMS.length} tarefas concluídas
              </p>
            </div>
            <Progress value={progress} className="h-3" />
            {allDone && (
              <div className="flex items-center gap-2 text-emerald-400 animate-in fade-in duration-500">
                <Sparkles className="h-4 w-4" />
                <span className="text-sm font-medium">Parabéns! Todas as tarefas concluídas! 🎉</span>
              </div>
            )}
          </div>

          {/* Checklist items */}
          <div className="glass-card divide-y divide-border/30">
            {CHECKLIST_ITEMS.map((task) => {
              const checked = completedTasks.includes(task);
              const wasJustChecked = justChecked === task;

              return (
                <button
                  key={task}
                  onClick={() => toggleTask(task)}
                  className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-300 hover:bg-accent/30 ${
                    checked ? 'bg-primary/5' : ''
                  } ${wasJustChecked ? 'bg-emerald-500/10' : ''}`}
                >
                  {checked ? (
                    <CheckSquare className={`h-5 w-5 text-emerald-400 shrink-0 transition-transform ${wasJustChecked ? 'scale-125' : ''}`} />
                  ) : (
                    <Square className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <span className={`text-sm transition-all duration-300 ${
                    checked ? 'line-through text-muted-foreground' : 'text-foreground'
                  }`}>
                    {task}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Notes */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-foreground">Observações do dia</p>
            </div>
            <Textarea
              placeholder="Registre insights, dificuldades, aprendizados ou feedback sobre o dia..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="bg-background/50 border-border/50 resize-none"
            />
            <Button variant="outline" size="sm" onClick={saveNotes}>Salvar observações</Button>
          </div>

          {/* ── Activity History ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Histórico de Atividades
              </h2>
              <div className="flex gap-2">
                <Select value={histMonth.toString()} onValueChange={v => setHistMonth(parseInt(v))}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()} className="capitalize">{m.label}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={histYear.toString()} onValueChange={v => setHistYear(parseInt(v))}>
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            <ProductivityStats checklists={sellerMonthlyData} workingDays={workingDays} />

            <div className="glass-card p-5">
              <ChecklistHistory checklists={sellerMonthlyData} month={histMonth} year={histYear} />
            </div>
          </div>
        </div>

        {/* Right column — Reminders (sticky notes) */}
        <div className="w-full lg:w-80 lg:sticky lg:top-6 lg:self-start">
          <div className="glass-card p-4">
            <ReminderNotes
              reminders={reminders}
              onAdd={addReminder}
              onToggle={toggleReminder}
              onDelete={deleteReminder}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
