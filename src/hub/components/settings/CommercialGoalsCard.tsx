import { forwardRef, useEffect, useMemo, useState } from 'react';
import { Target, Save, Sparkles, TrendingUp, CalendarRange, Calendar, Sun, Loader2, Info, Wallet } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useGoals, useUpsertGoals, DEFAULT_GOALS } from '@/hooks/useGoals';

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const fmtBRL = (raw: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  const n = parseInt(digits, 10);
  return n.toLocaleString('pt-BR');
};
const parseBRL = (s: string) => parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;

interface FieldProps {
  icon: any;
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  accent?: 'primary' | 'amber' | 'emerald' | 'rose';
}

const accentMap = {
  primary: 'text-primary border-primary/30 bg-primary/5',
  amber:   'text-amber-400 border-amber-500/30 bg-amber-500/5',
  emerald: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
  rose:    'text-rose-400 border-rose-500/30 bg-rose-500/5',
};

const GoalField = forwardRef<HTMLInputElement, FieldProps>(function GoalField({ icon: Icon, label, hint, value, onChange, accent = 'primary' }, ref) {
  return (
    <div className={`rounded-xl border ${accentMap[accent]} p-4 space-y-2 transition-colors`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <Label className="text-xs font-semibold uppercase tracking-wide">{label}</Label>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm text-muted-foreground">R$</span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(fmtBRL(e.target.value))}
          placeholder="0"
          className="flex-1 bg-transparent border-0 outline-none text-2xl font-bold text-foreground placeholder:text-muted-foreground/40"
        />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  );
});

export function CommercialGoalsCard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data: goals, isLoading } = useGoals(month, year);
  const upsert = useUpsertGoals();

  const [teamGoal, setTeamGoal] = useState('');
  const [hyperGoal, setHyperGoal] = useState('');
  const [weeklyGoal, setWeeklyGoal] = useState('');

  const [dailyGoal, setDailyGoal] = useState('');
  const [dailySpecialBonus, setDailySpecialBonus] = useState('');

  const [cashCollectedTarget, setCashCollectedTarget] = useState('');

  useEffect(() => {
    if (!goals) return;
    setTeamGoal(fmtBRL(String(goals.team_goal || '')));
    setHyperGoal(fmtBRL(String(goals.monthly_hyper_goal || '')));
    setWeeklyGoal(fmtBRL(String(goals.weekly_goal || DEFAULT_GOALS.weekly_goal)));
    setDailyGoal(fmtBRL(String(goals.daily_goal || DEFAULT_GOALS.daily_goal)));
    setDailySpecialBonus(fmtBRL(String((goals as any).daily_special_bonus_threshold || 0)));

    setCashCollectedTarget(fmtBRL(String(goals.cash_collected_target || 0)));
  }, [goals]);

  const yearOptions = useMemo(() => {
    const base = now.getFullYear();
    return [base - 1, base, base + 1, base + 2];
  }, [now]);

  const handleSave = () => {
    upsert.mutate({
      month, year,
      team_goal: parseBRL(teamGoal),
      monthly_hyper_goal: parseBRL(hyperGoal),
      weekly_goal: parseBRL(weeklyGoal),

      daily_goal: parseBRL(dailyGoal),
      daily_special_bonus_threshold: parseBRL(dailySpecialBonus),

      cash_collected_target: parseBRL(cashCollectedTarget),
    });
  };

  const isFallback = goals?.isFallback;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Metas Comerciais</h3>
            <p className="text-xs text-muted-foreground">
              Fonte única para todas as metas exibidas no dashboard. Configure por mês.
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 bg-muted/30 border border-border/40 rounded-lg p-1">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer"
          >
            {MONTH_NAMES.map((n, i) => (
              <option key={i} value={i + 1}>{n}</option>
            ))}
          </select>
          <span className="text-muted-foreground/40">|</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer"
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {isFallback && !isLoading && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>
            <strong>Sem metas configuradas para {MONTH_NAMES[month - 1]} {year}.</strong>{' '}
            Carregamos o último mês configurado como template. Ajuste os valores e clique em <em>Salvar</em>.
          </span>
        </div>
      )}

      {/* Monthly section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> Mensal
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GoalField icon={Target} label="Meta do Time" value={teamGoal} onChange={setTeamGoal} accent="primary" hint="Meta base mensal de receita do time." />
          <GoalField icon={Sparkles} label="Hipermeta" value={hyperGoal} onChange={setHyperGoal} accent="amber" hint="Objetivo extra após bater a meta base." />
        </div>
      </div>

      {/* Cash Collected section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" /> Cash Collected
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GoalField icon={Wallet} label="Meta Mensal de Cash Collected" value={cashCollectedTarget} onChange={setCashCollectedTarget} accent="emerald" hint="Valor efetivamente recebido em caixa no mês (exibido no TV Mode)." />
        </div>
      </div>

      {/* Weekly section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <CalendarRange className="h-3.5 w-3.5" /> Semanal
        </div>
        <div className="grid grid-cols-1 gap-3">
          <GoalField icon={TrendingUp} label="Meta Semanal" value={weeklyGoal} onChange={setWeeklyGoal} accent="emerald" hint="Meta base por semana." />
        </div>
      </div>

      {/* Daily section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" /> Diário
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <GoalField icon={Sun} label="Meta Diária (Comissão Dobrada)" value={dailyGoal} onChange={setDailyGoal} accent="rose" hint="Ao atingir este valor no dia, ativa a comissão dobrada." />
          <GoalField icon={Sparkles} label="Bônus Especial (50% da Comissão Dobrada)" value={dailySpecialBonus} onChange={setDailySpecialBonus} accent="amber" hint="Atingindo este valor (mas abaixo da meta diária), o vendedor recebe 50% da comissão dobrada. Deixe 0 para desativar." />
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={upsert.isPending}
        className="w-full btn-gradient text-primary-foreground h-11"
      >
        {upsert.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
        {upsert.isPending ? 'Salvando...' : `Salvar metas de ${MONTH_NAMES[month - 1]} ${year}`}
      </Button>
    </div>
  );
}
