import { useEffect, useMemo, useState } from 'react';
import { Target, Save, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTeams } from '@/hooks/useTeams';
import { useTeamGoals, useUpsertTeamGoal } from '@/hooks/useTeamGoals';
import { TeamAvatar } from '@/components/TeamAvatar';

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmtBRL = (raw: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('pt-BR');
};
const parseBRL = (s: string) => parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;

export function TeamGoalsCard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: teams = [] } = useTeams(false);
  const { data: goals = [] } = useTeamGoals(month, year);
  const upsert = useUpsertTeamGoal();

  const [values, setValues] = useState<Record<string, { monthly: string; hyper: string; weekly: string; daily: string }>>({});

  useEffect(() => {
    const next: typeof values = {};
    teams.forEach((t) => {
      const g: any = goals.find((x: any) => x.team_id === t.id);
      next[t.id] = {
        monthly: fmtBRL(String(g?.monthly_goal ?? '')),
        hyper: fmtBRL(String(g?.monthly_hyper_goal ?? '')),
        weekly: fmtBRL(String(g?.weekly_goal ?? '')),
        daily: fmtBRL(String(g?.daily_goal ?? '')),
      };
    });
    setValues(next);
  }, [teams, goals]);

  const yearOptions = useMemo(() => [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1, now.getFullYear() + 2], [now]);

  const saveTeam = (teamId: string) => {
    const v = values[teamId];
    upsert.mutate({
      team_id: teamId, month, year,
      monthly_goal: parseBRL(v.monthly),
      monthly_hyper_goal: parseBRL(v.hyper),
      weekly_goal: parseBRL(v.weekly),
      daily_goal: parseBRL(v.daily),
    });
  };

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary"><Target className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Metas por Time</h3>
            <p className="text-xs text-muted-foreground">Configure metas mensais individuais para cada time.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-muted/30 border border-border/40 rounded-lg p-1">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer">
            {MONTH_NAMES.map((n, i) => <option key={i} value={i + 1}>{n}</option>)}
          </select>
          <span className="text-muted-foreground/40">|</span>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-transparent text-sm font-medium px-3 py-1.5 outline-none cursor-pointer">
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {teams.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">Crie um time primeiro acima.</p>
      )}

      <div className="space-y-3">
        {teams.map((t) => {
          const v = values[t.id] || { monthly: '', hyper: '', weekly: '', daily: '' };
          return (
            <div key={t.id} className="rounded-xl border border-border/40 bg-accent/10 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <TeamAvatar name={t.name} imageUrl={t.image_url} size="md" />
                <p className="font-bold text-foreground flex-1 truncate">{t.name}</p>
                <Button size="sm" onClick={() => saveTeam(t.id)} disabled={upsert.isPending} className="btn-gradient text-primary-foreground gap-1.5">
                  {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {([
                  ['monthly', 'Meta Mensal'],
                  ['hyper', 'Hipermeta'],
                  ['weekly', 'Meta Semanal'],
                  ['daily', 'Meta Diária'],
                ] as const).map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
                    <div className="flex items-baseline gap-1 bg-background/40 rounded-md border border-border/30 px-2.5 py-1.5">
                      <span className="text-xs text-muted-foreground">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={v[key]}
                        onChange={(e) => setValues(prev => ({ ...prev, [t.id]: { ...prev[t.id], [key]: fmtBRL(e.target.value) } }))}
                        placeholder="0"
                        className="flex-1 bg-transparent border-0 outline-none text-base font-bold text-foreground placeholder:text-muted-foreground/40 min-w-0 w-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
