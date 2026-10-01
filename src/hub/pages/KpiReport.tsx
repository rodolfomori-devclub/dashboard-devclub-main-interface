import { filterVisibleProfiles } from '@/lib/hiddenUsers';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProfiles, useAllDailyKpis, useDailyTargets, useUpdateDailyTargets } from '@/hooks/useSupabaseData';
import { DailyTargets } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/MetricCard';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users, TrendingUp, Phone, Target, Download, Eye, ArrowUpDown } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function pct(num: number, den: number): string { if (den === 0) return '0,0%'; return (num / den * 100).toFixed(1).replace('.', ',') + '%'; }
function pctNum(num: number, den: number): number { if (den === 0) return 0; return Math.round(num / den * 1000) / 10; }
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

type SortKey = 'name' | 'leads' | 'qualified' | 'calls_scheduled' | 'calls_completed' | 'sales' | 'follows' | 'rejections' | 'qual_rate' | 'att_rate' | 'conv_rate' | 'follow_rate' | 'rej_rate' | 'active_days' | 'no_entry' | 'zero_days' | 'completion';

interface SellerRow {
  id: string; name: string; leads: number; qualified: number; calls_scheduled: number; calls_completed: number;
  sales: number; sales_scheduled: number; follows: number; rejections: number; qual_rate: number; att_rate: number;
  conv_rate: number; follow_rate: number; rej_rate: number; active_days: number; no_entry: number; zero_days: number;
  days_reported: number; completion: number;
}

export default function KpiReport() {
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sellerFilter, setSellerFilter] = useState('all');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('sales');
  const [sortAsc, setSortAsc] = useState(false);
  const [chartMetric, setChartMetric] = useState<'sales' | 'leads' | 'calls_completed' | 'conv_rate'>('sales');

  const { data: allProfiles = [] } = useProfiles();
  const { data: allKpis = [] } = useAllDailyKpis();
  const { data: targetsData } = useDailyTargets();
  const updateTargets = useUpdateDailyTargets();

  const targets: DailyTargets = targetsData || { id: '', target_leads_per_day: 0, target_calls_scheduled: 0, target_calls_completed: 0, target_sales_per_day: 0 };

  const users = useMemo(() => filterVisibleProfiles(allProfiles).filter((u: any) => (u.role === 'vendedor' || u.role === 'pre-vendedor') && (includeInactive || u.active)), [allProfiles, includeInactive]);
  const daysInPeriod = getDaysInMonth(year, month);

  const filteredKpis = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    let kpis = allKpis.filter((k: any) => k.date.startsWith(prefix));
    if (sellerFilter !== 'all') kpis = kpis.filter((k: any) => k.seller_id === sellerFilter);
    const sellerIds = new Set(users.map((u: any) => u.id));
    return kpis.filter((k: any) => sellerIds.has(k.seller_id));
  }, [allKpis, year, month, sellerFilter, users]);

  const teamTotals = useMemo(() => {
    const t = { leads: 0, leads_disqualified: 0, calls_scheduled: 0, calls_completed: 0, sales: 0, sales_scheduled: 0, follows: 0, rejections: 0 };
    filteredKpis.forEach((k: any) => { t.leads += k.leads; t.leads_disqualified += k.leads_disqualified; t.calls_scheduled += k.calls_scheduled; t.calls_completed += k.calls_completed; t.sales += k.sales; t.sales_scheduled += k.sales_scheduled; t.follows += k.follows; t.rejections += k.rejections; });
    return t;
  }, [filteredKpis]);

  const sellerRows: SellerRow[] = useMemo(() => {
    const displayUsers = sellerFilter === 'all' ? users : users.filter((u: any) => u.id === sellerFilter);
    return displayUsers.map((u: any) => {
      const kpis = filteredKpis.filter((k: any) => k.seller_id === u.id);
      const t = { leads: 0, leads_disqualified: 0, calls_scheduled: 0, calls_completed: 0, sales: 0, sales_scheduled: 0, follows: 0, rejections: 0 };
      const datesWithRecords = new Set<string>();
      let zeroDays = 0;
      kpis.forEach((k: any) => { t.leads += k.leads; t.leads_disqualified += k.leads_disqualified; t.calls_scheduled += k.calls_scheduled; t.calls_completed += k.calls_completed; t.sales += k.sales; t.sales_scheduled += k.sales_scheduled; t.follows += k.follows; t.rejections += k.rejections; datesWithRecords.add(k.date); const hasActivity = k.leads > 0 || k.leads_disqualified > 0 || k.calls_scheduled > 0 || k.calls_completed > 0 || k.sales > 0 || k.follows > 0 || k.rejections > 0; if (!hasActivity) zeroDays++; });
      const activeDays = kpis.filter((k: any) => k.leads > 0 || k.calls_scheduled > 0 || k.calls_completed > 0 || k.sales > 0 || k.follows > 0 || k.rejections > 0).length;
      const qualified = t.leads - t.leads_disqualified;
      return { id: u.id, name: u.name, leads: t.leads, qualified, calls_scheduled: t.calls_scheduled, calls_completed: t.calls_completed, sales: t.sales, sales_scheduled: t.sales_scheduled, follows: t.follows, rejections: t.rejections, qual_rate: pctNum(qualified, t.leads), att_rate: pctNum(t.calls_completed, t.calls_scheduled), conv_rate: pctNum(t.sales, t.calls_completed), follow_rate: pctNum(t.follows, t.leads), rej_rate: pctNum(t.rejections, t.leads), active_days: activeDays, no_entry: daysInPeriod - datesWithRecords.size, zero_days: zeroDays, days_reported: datesWithRecords.size, completion: pctNum(datesWithRecords.size, daysInPeriod) };
    });
  }, [users, filteredKpis, sellerFilter, daysInPeriod]);

  const sortedRows = useMemo(() => {
    const rows = [...sellerRows];
    rows.sort((a, b) => { const av = a[sortKey], bv = b[sortKey]; if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string); return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number); });
    return rows;
  }, [sellerRows, sortKey, sortAsc]);

  const dailyTrend = useMemo(() => {
    const data: { day: number; leads: number; calls_completed: number; sales: number }[] = [];
    for (let d = 1; d <= daysInPeriod; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayKpis = filteredKpis.filter((k: any) => k.date === dateStr);
      data.push({ day: d, leads: dayKpis.reduce((s: number, k: any) => s + k.leads, 0), calls_completed: dayKpis.reduce((s: number, k: any) => s + k.calls_completed, 0), sales: dayKpis.reduce((s: number, k: any) => s + k.sales, 0) });
    }
    return data;
  }, [filteredKpis, daysInPeriod, year, month]);

  const sellerComparison = useMemo(() => sellerRows.map(r => ({ name: r.name.split(' ')[0], value: chartMetric === 'conv_rate' ? r.conv_rate : r[chartMetric] })), [sellerRows, chartMetric]);

  const funnel = useMemo(() => {
    const qualified = teamTotals.leads - teamTotals.leads_disqualified;
    return [
      { stage: 'Leads', value: teamTotals.leads, pct: '100%' },
      { stage: 'Qualificados', value: qualified, pct: pct(qualified, teamTotals.leads) },
      { stage: 'Calls Realizadas', value: teamTotals.calls_completed, pct: pct(teamTotals.calls_completed, qualified || 1) },
      { stage: 'Vendas', value: teamTotals.sales, pct: pct(teamTotals.sales, teamTotals.calls_completed || 1) },
    ];
  }, [teamTotals]);

  const goalPerformance = useMemo(() => {
    const activeSellers = sellerRows.filter(r => r.active_days > 0);
    const totalActiveDays = activeSellers.reduce((s, r) => s + r.active_days, 0) || 1;
    return { avgLeads: (teamTotals.leads / totalActiveDays).toFixed(1), avgCalls: (teamTotals.calls_completed / totalActiveDays).toFixed(1), avgSales: (teamTotals.sales / totalActiveDays).toFixed(1) };
  }, [teamTotals, sellerRows]);

  function goalStatus(avg: string, target: number): { label: string; color: string } {
    if (target === 0) return { label: 'Sem meta', color: 'text-muted-foreground' };
    const v = parseFloat(avg);
    if (v >= target) return { label: 'Acima da Meta', color: 'text-green-600' };
    if (v >= target * 0.8) return { label: 'Na Meta', color: 'text-yellow-600' };
    return { label: 'Abaixo da Meta', color: 'text-error' };
  }

  const handleSort = (key: SortKey) => { if (sortKey === key) setSortAsc(!sortAsc); else { setSortKey(key); setSortAsc(false); } };

  const handleTargetChange = (field: keyof DailyTargets, value: string) => {
    if (field === 'id') return;
    const num = Math.max(0, parseInt(value) || 0);
    const updated = { ...targets, [field]: num };
    updateTargets.mutate(updated);
  };

  const exportCsv = (sellerId?: string) => {
    const kpis = sellerId ? filteredKpis.filter((k: any) => k.seller_id === sellerId) : filteredKpis;
    const userMap = new Map(allProfiles.map((u: any) => [u.id, u.name]));
    const header = 'data,vendedor,leads,leads_desqualificados,calls_agendadas,calls_realizadas,vendas,vendas_agendadas,followups,rejeicoes\n';
    const rows = kpis.map((k: any) => `${k.date},${userMap.get(k.seller_id) || ''},${k.leads},${k.leads_disqualified},${k.calls_scheduled},${k.calls_completed},${k.sales},${k.sales_scheduled},${k.follows},${k.rejections}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = sellerId ? `kpis_vendedor_${MONTHS[month]}_${year}.csv` : `kpis_equipe_${MONTHS[month]}_${year}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <TableHead className="cursor-pointer hover:text-foreground whitespace-nowrap" onClick={() => handleSort(k)}><span className="flex items-center gap-1">{label} <ArrowUpDown className="h-3 w-3" /></span></TableHead>
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div><h1 className="page-title">Relatório de KPIs</h1><p className="page-subtitle">Consolidação de desempenho da equipe</p></div>
        <Button variant="outline" size="sm" onClick={() => exportCsv()} className="border-border/50 hover:bg-accent/50"><Download className="h-4 w-4 mr-1" /> Exportar Equipe CSV</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 rounded-lg glass-card">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
        <Select value={sellerFilter} onValueChange={setSellerFilter}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os Vendedores</SelectItem>{users.map((u: any) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent></Select>
        <div className="flex items-center gap-2 ml-auto"><Switch checked={includeInactive} onCheckedChange={setIncludeInactive} id="inactive" /><Label htmlFor="inactive" className="text-sm">Incluir inativos</Label></div>
      </div>

      <div><h2 className="section-title mb-4">Resumo Executivo da Equipe</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Leads" value={teamTotals.leads} icon={<Users className="h-4 w-4" />} /><MetricCard label="Leads Desqualificados" value={teamTotals.leads_disqualified} />
          <MetricCard label="Calls Agendadas" value={teamTotals.calls_scheduled} icon={<Phone className="h-4 w-4" />} /><MetricCard label="Calls Realizadas" value={teamTotals.calls_completed} />
          <MetricCard label="Vendas" value={teamTotals.sales} icon={<TrendingUp className="h-4 w-4" />} /><MetricCard label="Vendas Agendadas" value={teamTotals.sales_scheduled} />
          <MetricCard label="Follow-ups" value={teamTotals.follows} /><MetricCard label="Rejeições" value={teamTotals.rejections} />
        </div>
      </div>

      <div className="p-4 rounded-lg glass-card">
        <h3 className="text-sm font-semibold text-foreground mb-3">Indicadores de Performance da Equipe</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div><p className="text-xs text-muted-foreground">Taxa de Qualificação</p><p className="text-lg font-semibold">{pct(teamTotals.leads - teamTotals.leads_disqualified, teamTotals.leads)}</p></div>
          <div><p className="text-xs text-muted-foreground">Taxa de Comparecimento</p><p className="text-lg font-semibold">{pct(teamTotals.calls_completed, teamTotals.calls_scheduled)}</p></div>
          <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-lg font-semibold">{pct(teamTotals.sales, teamTotals.calls_completed)}</p></div>
          <div><p className="text-xs text-muted-foreground">Taxa de Follow-up</p><p className="text-lg font-semibold">{pct(teamTotals.follows, teamTotals.leads)}</p></div>
          <div><p className="text-xs text-muted-foreground">Taxa de Rejeição</p><p className="text-lg font-semibold">{pct(teamTotals.rejections, teamTotals.leads)}</p></div>
        </div>
      </div>

      <div>
        <h2 className="section-title mb-4">Performance por Vendedor</h2>
        {sortedRows.length === 0 ? <div className="p-8 text-center glass-card"><p className="text-muted-foreground">Nenhum dado de KPI encontrado para este período.</p></div> : (
          <div className="glass-card overflow-x-auto">
            <Table><TableHeader><TableRow>
              <SortHeader label="Vendedor" k="name" /><SortHeader label="Leads" k="leads" /><SortHeader label="Qualificados" k="qualified" /><SortHeader label="Calls Ag." k="calls_scheduled" /><SortHeader label="Calls Real." k="calls_completed" /><SortHeader label="Vendas" k="sales" /><SortHeader label="Follow-ups" k="follows" /><SortHeader label="Rejeições" k="rejections" /><SortHeader label="% Qualif." k="qual_rate" /><SortHeader label="% Compar." k="att_rate" /><SortHeader label="% Convers." k="conv_rate" /><SortHeader label="Dias Ativos" k="active_days" /><SortHeader label="S/ Registro" k="no_entry" /><SortHeader label="Zero Ativ." k="zero_days" /><SortHeader label="Completude" k="completion" /><TableHead>Ações</TableHead>
            </TableRow></TableHeader>
            <TableBody>{sortedRows.map(r => (
              <TableRow key={r.id}><TableCell className="font-medium">{r.name}</TableCell><TableCell>{r.leads}</TableCell><TableCell>{r.qualified}</TableCell><TableCell>{r.calls_scheduled}</TableCell><TableCell>{r.calls_completed}</TableCell><TableCell className="font-semibold">{r.sales}</TableCell><TableCell>{r.follows}</TableCell><TableCell>{r.rejections}</TableCell><TableCell>{r.qual_rate.toFixed(1)}%</TableCell><TableCell>{r.att_rate.toFixed(1)}%</TableCell><TableCell>{r.conv_rate.toFixed(1)}%</TableCell><TableCell>{r.active_days}</TableCell><TableCell>{r.no_entry}</TableCell><TableCell>{r.zero_days}</TableCell><TableCell><span className={r.completion < 70 ? 'text-error font-semibold' : 'text-foreground'}>{r.completion.toFixed(0)}%</span></TableCell><TableCell><Button variant="ghost" size="sm" onClick={() => navigate(`/kpi-report/seller/${r.id}`)}><Eye className="h-4 w-4 mr-1" /> Detalhes</Button></TableCell></TableRow>
            ))}</TableBody></Table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card border-border/50"><CardHeader><CardTitle className="text-base">Tendência Diária de Atividade</CardTitle></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={280}><LineChart data={dailyTrend}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="day" className="text-xs" stroke="var(--muted-foreground)" /><YAxis className="text-xs" stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }} /><Legend /><Line type="monotone" dataKey="leads" name="Leads" stroke="var(--primary)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="calls_completed" name="Calls" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="sales" name="Vendas" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
        </CardContent></Card>
        <Card className="glass-card border-border/50"><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Comparação de Vendedores</CardTitle><Select value={chartMetric} onValueChange={v => setChartMetric(v as typeof chartMetric)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sales">Vendas</SelectItem><SelectItem value="leads">Leads</SelectItem><SelectItem value="calls_completed">Calls</SelectItem><SelectItem value="conv_rate">Taxa Conversão</SelectItem></SelectContent></Select></div></CardHeader><CardContent>
          <ResponsiveContainer width="100%" height={280}><BarChart data={sellerComparison}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" className="text-xs" stroke="var(--muted-foreground)" /><YAxis className="text-xs" stroke="var(--muted-foreground)" /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px', color: '#fff' }} /><Bar dataKey="value" name={chartMetric === 'sales' ? 'Vendas' : chartMetric === 'leads' ? 'Leads' : chartMetric === 'calls_completed' ? 'Calls' : 'Taxa %'} fill="var(--primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </CardContent></Card>
      </div>

      <Card className="glass-card border-border/50"><CardHeader><CardTitle className="text-base">Funil de Vendas</CardTitle></CardHeader><CardContent>
        <div className="flex items-center justify-center gap-2 py-4">{funnel.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-2"><div className="text-center"><p className="text-2xl font-bold text-foreground">{stage.value}</p><p className="text-xs text-muted-foreground">{stage.stage}</p></div>{i < funnel.length - 1 && <div className="text-center px-3"><span className="text-xs text-muted-foreground">→</span><p className="text-xs font-medium text-primary">{funnel[i + 1].pct}</p></div>}</div>
        ))}</div>
      </CardContent></Card>

      <Card className="glass-card border-border/50"><CardHeader><CardTitle className="text-base">Metas de Atividade Diária</CardTitle></CardHeader><CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div><Label className="text-xs">Meta Leads/Dia</Label><Input type="number" min={0} defaultValue={targets.target_leads_per_day || ''} placeholder="0" onBlur={e => handleTargetChange('target_leads_per_day', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Meta Calls Agendadas/Dia</Label><Input type="number" min={0} defaultValue={targets.target_calls_scheduled || ''} placeholder="0" onBlur={e => handleTargetChange('target_calls_scheduled', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Meta Calls Realizadas/Dia</Label><Input type="number" min={0} defaultValue={targets.target_calls_completed || ''} placeholder="0" onBlur={e => handleTargetChange('target_calls_completed', e.target.value)} className="mt-1" /></div>
          <div><Label className="text-xs">Meta Vendas/Dia</Label><Input type="number" min={0} defaultValue={targets.target_sales_per_day || ''} placeholder="0" onBlur={e => handleTargetChange('target_sales_per_day', e.target.value)} className="mt-1" /></div>
        </div>
        <h4 className="text-sm font-medium mb-3">Desempenho vs Metas</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[{ label: 'Média Leads/Dia', avg: goalPerformance.avgLeads, target: targets.target_leads_per_day }, { label: 'Média Calls/Dia', avg: goalPerformance.avgCalls, target: targets.target_calls_completed }, { label: 'Média Vendas/Dia', avg: goalPerformance.avgSales, target: targets.target_sales_per_day }].map(g => {
            const status = goalStatus(g.avg, g.target);
            return (<div key={g.label} className="p-3 rounded-lg border border-border/30 bg-accent/15"><p className="text-xs text-muted-foreground">{g.label}</p><p className="text-xl font-semibold">{g.avg} <span className="text-sm text-muted-foreground">/ {g.target}</span></p><p className={`text-xs font-medium ${status.color}`}>{status.label}</p></div>);
          })}
        </div>
      </CardContent></Card>
    </div>
  );
}
