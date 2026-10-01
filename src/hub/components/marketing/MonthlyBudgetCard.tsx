import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Target, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const fmtBRL = (v: number) =>
  (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function num(v: any): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeDate(v: string): string {
  if (!v) return '';
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const STORAGE_KEY = 'marketing_monthly_budgets_v1';

function loadBudgets(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveBudgets(b: Record<string, number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(b));
}

export default function MonthlyBudgetCard() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [monthTouched, setMonthTouched] = useState(false);
  const [budgets, setBudgets] = useState<Record<string, number>>(loadBudgets);
  const [includeMetaTax, setIncludeMetaTax] = useState(true);
  const key = `${year}-${String(month).padStart(2, '0')}`;
  const [budgetInput, setBudgetInput] = useState<string>(budgets[key] ? String(budgets[key]) : '');
  const qc = useQueryClient();

  useEffect(() => {
    setBudgetInput(budgets[key] ? String(budgets[key]) : '');
  }, [key, budgets]);

  const range = useMemo(() => {
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to };
  }, [month, year]);

  const { data: linkedinData, isFetching: fetchingLinkedin, error: linkedinError } = useQuery({
    queryKey: ['linkedin-ads-sheets'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('linkedin-ads-sheets');
      if (error) throw new Error(error.message);
      return data as { costBRL: string[][] };
    },
    staleTime: 60_000,
  });

  const { data: metaData, isFetching: fetchingMeta, error: metaError } = useQuery({
    queryKey: ['low-ticket-meta-hubla'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('low-ticket-meta-hubla');
      if (error) throw new Error(error.message);
      return data as { metaAds: string[][] };
    },
    staleTime: 60_000,
  });

  const { data: distDaily, isFetching: fetchingDist } = useQuery({
    queryKey: ['content_distribution_daily_all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('content_distribution_daily')
        .select('day, amount_spent');
      if (error) throw new Error(error.message);
      return (data || []) as { day: string; amount_spent: number }[];
    },
    staleTime: 60_000,
  });

  const { data: webinarMetrics, isFetching: fetchingWebinar } = useQuery({
    queryKey: ['webinar_global_metrics_all'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('webinar_global_metrics')
        .select('day, metric_value')
        .eq('metric_key', 'investment');
      if (error) throw new Error(error.message);
      return (data || []).map((row: { day: string; metric_value: number | string }) => ({
        day: row.day,
        investment: Number(row.metric_value),
      })) as { day: string; investment: number }[];
    },
    staleTime: 60_000,
  });

  const linkedinSpend = useMemo(() => {
    return (linkedinData?.costBRL || []).reduce((s, row) => {
      const d = normalizeDate(row[1]);
      if (!d || d < range.from || d > range.to) return s;
      return s + num(row[3]);
    }, 0);
  }, [linkedinData, range]);

  const metaSpend = useMemo(() => {
    const sheetTotal = (metaData?.metaAds || []).reduce((s, row) => {
      const d = normalizeDate(row[1]);
      if (!d || d < range.from || d > range.to) return s;
      return s + num(row[7]);
    }, 0);
    const dbTotal = (distDaily || []).reduce((s, row) => {
      const d = normalizeDate(row.day);
      if (!d || d < range.from || d > range.to) return s;
      return s + num(row.amount_spent);
    }, 0);
    const webinarTotal = (webinarMetrics || []).reduce((s, row) => {
      const d = normalizeDate(row.day);
      if (!d || d < range.from || d > range.to) return s;
      return s + num(row.investment);
    }, 0);
    const raw = sheetTotal + dbTotal + webinarTotal;
    return includeMetaTax ? raw * 1.1383 : raw;
  }, [metaData, distDaily, webinarMetrics, range, includeMetaTax]);

  // Auto-select latest month with any spend data (unless user changed manually)
  useEffect(() => {
    if (monthTouched) return;
    const dates: string[] = [];
    (metaData?.metaAds || []).forEach((r) => { const d = normalizeDate(r[1]); if (d) dates.push(d); });
    (linkedinData?.costBRL || []).forEach((r) => { const d = normalizeDate(r[1]); if (d) dates.push(d); });
    (distDaily || []).forEach((r) => { const d = normalizeDate(r.day); if (d) dates.push(d); });
    (webinarMetrics || []).forEach((r) => { const d = normalizeDate(r.day); if (d) dates.push(d); });
    if (!dates.length) return;
    const latest = dates.sort().at(-1)!;
    const [y, m] = latest.split('-');
    setYear(Number(y));
    setMonth(Number(m));
  }, [metaData, linkedinData, distDaily, webinarMetrics, monthTouched]);

  const total = linkedinSpend + metaSpend;
  const budget = num(budgetInput);
  const pctUsed = budget > 0 ? (total / budget) * 100 : 0;
  const remaining = budget - total;

  const handleBudgetBlur = () => {
    const n = num(budgetInput);
    const next = { ...budgets, [key]: n };
    setBudgets(next);
    saveBudgets(next);
  };

  const platforms = [
    { label: 'Meta Ads', value: metaSpend, color: 'var(--primary)' },
    { label: 'LinkedIn Ads', value: linkedinSpend, color: 'var(--dc-info-solid)' },
  ];

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['low-ticket-meta-hubla'] });
    qc.invalidateQueries({ queryKey: ['linkedin-ads-sheets'] });
    qc.invalidateQueries({ queryKey: ['content_distribution_daily_all'] });
    qc.invalidateQueries({ queryKey: ['webinar_global_metrics_all'] });
  };
  const loading = fetchingMeta || fetchingLinkedin || fetchingDist || fetchingWebinar;
  const sourceError = metaError || linkedinError;


  return (
    <Card className="glass-surface border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Orçamento mensal vs. investido
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-2">
              <Switch id="meta-tax-budget" checked={includeMetaTax} onCheckedChange={setIncludeMetaTax} />
              <Label htmlFor="meta-tax-budget" className="text-xs cursor-pointer">Imposto Meta (+13,83%)</Label>
            </div>
            <Button size="sm" variant="outline" onClick={refresh} disabled={loading} className="h-9">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setMonthTouched(true); }}>
              <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setMonthTouched(true); }}>
              <SelectTrigger className="h-9 w-[100px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {sourceError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-error">
            Não foi possível carregar os investimentos das plataformas. Atualize os dados ou entre novamente.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-[11px] uppercase text-muted-foreground">Orçamento disponível</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="Ex: 30000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetBlur}
              className="mt-1 text-lg font-semibold"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Salvo por mês no navegador.</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Total investido</p>
            <p className="text-2xl font-bold text-foreground mt-2">{fmtBRL(total)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-muted-foreground">Restante</p>
            <p className={`text-2xl font-bold mt-2 ${remaining < 0 ? 'text-error' : 'text-foreground'}`}>
              {budget > 0 ? fmtBRL(remaining) : '—'}
            </p>
          </div>
        </div>

        {budget > 0 && (() => {
          const barColor = pctUsed > 100 ? 'var(--destructive)' : pctUsed > 85 ? 'var(--warning)' : 'var(--success)';
          return (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Percentual utilizado</span>
                <span className="font-semibold" style={{ color: barColor }}>{pctUsed.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(pctUsed, 100)}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })()}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-64">
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={platforms}
                    dataKey="value"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    paddingAngle={3}
                    label={({ label, percent }) => `${label}: ${(percent * 100).toFixed(1)}%`}
                    labelLine={false}
                  >
                    {platforms.map((p) => (
                      <Cell key={p.label} fill={p.color} stroke="var(--card)" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [fmtBRL(value), name]}
                    contentStyle={{ background: 'var(--card)', borderColor: 'var(--border)', borderRadius: 8 }}
                    labelStyle={{ color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                {loading ? 'Carregando dados…' : 'Sem investimento registrado no período selecionado.'}
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Investimento por plataforma</p>
            {platforms.map((p) => {
              const pct = total > 0 ? (p.value / total) * 100 : 0;
              const budgetPct = budget > 0 ? (p.value / budget) * 100 : 0;
              return (
                <div key={p.label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-foreground">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: p.color }} />
                    {p.label}
                  </span>
                  <span className="font-semibold text-foreground">
                    {fmtBRL(p.value)}{' '}
                    <span className="text-xs text-muted-foreground">
                      ({pct.toFixed(1)}% do total{budget > 0 ? ` · ${budgetPct.toFixed(1)}% do orçamento` : ''})
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
