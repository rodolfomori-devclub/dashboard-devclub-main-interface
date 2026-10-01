import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DateRangePresets from './DateRangePresets';
import { toast } from 'sonner';
import { RefreshCw, Link2, CheckCircle2, AlertTriangle, Sparkles, CalendarIcon, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { chartColor } from '@/lib/chartPalette';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v: number) => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v: number) => Math.round(isFinite(v) ? v : 0).toLocaleString('pt-BR');
const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

interface DailyRow {
  day: string;
  amount_spent: number;
  impressions: number;
}

const DAILY_ALIASES: Record<string, keyof DailyRow> = {
  'day': 'day', 'dia': 'day', 'date': 'day', 'data': 'day',
  'amount spent': 'amount_spent', 'valor usado': 'amount_spent', 'spend': 'amount_spent', 'gasto': 'amount_spent',
  'impressions': 'impressions', 'impressões': 'impressions', 'impressoes': 'impressions',
};

function num(v: any): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function normalizeKey(k: string): string {
  return (k || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function parseDailySheet(rows: any[]): DailyRow[] {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const mapping: Record<string, keyof DailyRow> = {};
  cols.forEach(c => {
    const k = DAILY_ALIASES[normalizeKey(c)];
    if (k) mapping[c] = k;
  });
  if (!Object.values(mapping).includes('day')) return [];
  const out: DailyRow[] = [];
  rows.forEach(r => {
    let day: any = null, amount_spent = 0, impressions = 0;
    Object.entries(mapping).forEach(([orig, key]) => {
      const v = r[orig];
      if (key === 'day') day = v;
      else if (key === 'amount_spent') amount_spent = num(v);
      else if (key === 'impressions') impressions = num(v);
    });
    if (day == null || day === '') return;
    let iso: string;
    if (day instanceof Date) {
      iso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    } else if (typeof day === 'number') {
      const d = XLSX.SSF.parse_date_code(day);
      iso = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
    } else {
      const s = String(day).trim();
      const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      if (br) iso = `${br[3]}-${br[2]}-${br[1]}`;
      else if (/^\d{4}-\d{2}-\d{2}/.test(s)) iso = s.slice(0, 10);
      else return;
    }
    if (!amount_spent && !impressions) return;
    out.push({ day: iso, amount_spent, impressions });
  });
  return out;
}

function pickSheet(names: string[], needles: string[]): string | null {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const n of needles) {
    const k = norm(n);
    const found = names.find(x => norm(x).includes(k));
    if (found) return found;
  }
  return null;
}

export default function ContentDistributionTab() {
  const qc = useQueryClient();
  const { isManager, isMarketing } = useAuth();
  const canEdit = isManager || isMarketing;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [monthTouched, setMonthTouched] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [sheetUrl, setSheetUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [nextSyncAt, setNextSyncAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['low-ticket-meta-hubla'] }),
      qc.invalidateQueries({ queryKey: ['content_distribution_daily'] }),
      qc.invalidateQueries({ queryKey: ['content_distribution_daily_all'] }),
      qc.invalidateQueries({ queryKey: ['content_distribution_settings'] }),
    ]);
    setRefreshing(false);
  };

  // Primary source: automatic pull from Meta Ads sheet (product = "Impulsionamento")
  const { data: metaData } = useQuery({
    queryKey: ['low-ticket-meta-hubla'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('low-ticket-meta-hubla');
      if (error) throw new Error(error.message);
      return data as { metaAds: string[][] };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  const normalizeDate = (v: string): string => {
    if (!v) return '';
    const s = String(v).trim();
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (br) return `${br[3]}-${br[2]}-${br[1]}`;
    return '';
  };

  const daily = useMemo<DailyRow[]>(() => {
    const rows = metaData?.metaAds || [];
    const bucket = new Map<string, DailyRow>();
    // Meta Ads columns: [plataforma, data, produto, temperatura, campanha, publico, anuncio, investimento, cliques, impressoes, ...]
    rows.forEach(r => {
      const prod = (r[2] || '').trim().toLowerCase();
      if (prod !== 'impulsionamento') return;
      const d = normalizeDate(r[1]);
      if (!d) return;
      const spend = num(r[7]);
      const imp = num(r[9]);
      const cur = bucket.get(d) || { day: d, amount_spent: 0, impressions: 0 };
      cur.amount_spent += spend;
      cur.impressions += imp;
      bucket.set(d, cur);
    });
    return Array.from(bucket.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [metaData]);

  // Auto-select latest month with data (only if user hasn't manually changed month/year)
  useEffect(() => {
    if (monthTouched || !daily.length) return;
    const latest = daily[daily.length - 1].day;
    const [y, m] = latest.split('-');
    setYear(Number(y));
    setMonth(Number(m));
  }, [daily, monthTouched]);



  const { data: settings } = useQuery({
    queryKey: ['content_distribution_settings'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('content_distribution_settings').select('*')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data && !urlLoaded) { setSheetUrl(data.sheet_url || ''); setUrlLoaded(true); }
      return data;
    },
    refetchInterval: 30_000,
  });

  const updateSettings = async (patch: Record<string, any>) => {
    if (!settings?.id) return;
    await (supabase as any).from('content_distribution_settings').update(patch).eq('id', settings.id);
    qc.invalidateQueries({ queryKey: ['content_distribution_settings'] });
  };

  const importMutation = useMutation({
    mutationFn: async (parsedDaily: DailyRow[]) => {
      if (!parsedDaily.length) return { daily: 0 };
      await (supabase as any).from('content_distribution_daily').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      const { error } = await (supabase as any).from('content_distribution_daily').insert(parsedDaily);
      if (error) throw error;
      return { daily: parsedDaily.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['content_distribution_daily'] });
    },
  });

  const syncSheet = useCallback(async (opts?: { silent?: boolean; urlOverride?: string }) => {
    const raw = (opts?.urlOverride ?? sheetUrl).trim();
    if (!raw) { if (!opts?.silent) toast.error('Cole a URL da planilha'); return; }
    try {
      const m = raw.match(/spreadsheets\/d\/([^/]+)/);
      if (!m) throw new Error('URL inválida. Use uma URL do Google Sheets.');
      const id = m[1];
      const url = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Não foi possível baixar a planilha. Verifique se está pública.');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });

      const dailySheet = pickSheet(wb.SheetNames, ['setupgastosditribuicao', 'setupgastosdistribuicao', 'gastosditribuicao', 'gastosdistribuicao', 'setupgastos', 'gastos']);
      if (!dailySheet) {
        throw new Error(`Aba "Setup - Gastos Ditribuição" não encontrada. Abas: ${wb.SheetNames.join(', ')}`);
      }

      const dailyRows = XLSX.utils.sheet_to_json(wb.Sheets[dailySheet], { defval: '' }) as any[];
      const parsedDaily = parseDailySheet(dailyRows);

      if (!parsedDaily.length) throw new Error('Nenhum dia válido encontrado na aba.');

      const r = await importMutation.mutateAsync(parsedDaily);
      if (!opts?.silent) toast.success(`${r.daily} dias importados`);
      await updateSettings({
        sheet_url: raw,
        last_synced_at: new Date().toISOString(),
        last_status: `Synced (${r.daily} dias)`,
        last_row_count: r.daily,
        last_error: '',
      });
    } catch (e: any) {
      const msg = e?.message || 'Erro ao sincronizar';
      if (!opts?.silent) toast.error(msg);
      await updateSettings({
        last_status: 'Auto sync failed. Last valid data is still being used.',
        last_error: msg,
      });
    }
  }, [sheetUrl, importMutation, settings?.id]);

  useEffect(() => {
    const url = (settings?.sheet_url || '').trim();
    if (!url) { setNextSyncAt(null); return; }
    const INTERVAL = 10 * 60 * 1000;
    setNextSyncAt(new Date(Date.now() + INTERVAL));
    const id = setInterval(() => {
      syncSheet({ silent: true, urlOverride: url });
      setNextSyncAt(new Date(Date.now() + INTERVAL));
    }, INTERVAL);
    return () => clearInterval(id);
  }, [settings?.sheet_url, syncSheet]);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const dailySorted = useMemo(() => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    let from = monthStart, to = monthEnd;
    if (dateRange?.from) {
      from = format(dateRange.from, 'yyyy-MM-dd');
      to = format(dateRange.to ?? dateRange.from, 'yyyy-MM-dd');
    }
    return [...daily]
      .filter(r => r.day >= from && r.day <= to)
      .sort((a, b) => a.day.localeCompare(b.day));
  }, [daily, month, year, dateRange]);

  const kpis = useMemo(() => {
    const totalSpend = dailySorted.reduce((s, r) => s + r.amount_spent, 0);
    const totalImpressions = dailySorted.reduce((s, r) => s + r.impressions, 0);
    const days = dailySorted.length;
    const avgDailySpend = days ? totalSpend / days : 0;
    const avgDailyImpressions = days ? totalImpressions / days : 0;
    const cpm = totalImpressions ? (totalSpend / totalImpressions) * 1000 : 0;
    const costPerImpression = totalImpressions ? totalSpend / totalImpressions : 0;
    const bestDay = dailySorted.reduce<DailyRow | null>((best, r) => (!best || r.impressions > best.impressions ? r : best), null);
    const worstDay = dailySorted.reduce<DailyRow | null>((w, r) => (!w || r.impressions < w.impressions ? r : w), null);
    return { totalSpend, totalImpressions, days, avgDailySpend, avgDailyImpressions, cpm, costPerImpression, bestDay, worstDay };
  }, [dailySorted]);

  const dailyChart = useMemo(() => dailySorted.map(d => ({
    day: fmtDate(d.day),
    spend: d.amount_spent,
    impressions: d.impressions,
    cpm: d.impressions ? (d.amount_spent / d.impressions) * 1000 : 0,
  })), [dailySorted]);

  const weeklyChart = useMemo(() => {
    const buckets = new Map<string, { week: string; spend: number; impressions: number }>();
    dailySorted.forEach(d => {
      const date = new Date(d.day + 'T00:00:00');
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      const cur = buckets.get(key) || { week: fmtDate(key), spend: 0, impressions: 0 };
      cur.spend += d.amount_spent;
      cur.impressions += d.impressions;
      buckets.set(key, cur);
    });
    return Array.from(buckets.values());
  }, [dailySorted]);

  const insights = useMemo(() => {
    const list: string[] = [];
    if (!dailySorted.length) return list;
    list.push(`Período analisado: ${kpis.days} dias.`);
    list.push(`Investimento médio diário de ${fmt(kpis.avgDailySpend)} gerando ${fmtInt(kpis.avgDailyImpressions)} impressões/dia.`);
    list.push(`CPM médio do período: ${fmt(kpis.cpm)} (custo por mil impressões).`);
    if (kpis.bestDay) list.push(`Melhor dia em alcance: ${fmtDate(kpis.bestDay.day)} com ${fmtInt(kpis.bestDay.impressions)} impressões (${fmt(kpis.bestDay.amount_spent)} investidos).`);
    if (kpis.worstDay) list.push(`Pior dia em alcance: ${fmtDate(kpis.worstDay.day)} com ${fmtInt(kpis.worstDay.impressions)} impressões.`);
    return list;
  }, [dailySorted, kpis]);

  const lastSync = settings?.last_synced_at ? new Date(settings.last_synced_at) : null;

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap gap-2 items-center justify-end">
        <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setMonthTouched(true); setDateRange(undefined); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setMonthTouched(true); setDateRange(undefined); }}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn('justify-start text-left font-normal min-w-[240px]', !dateRange?.from && 'text-muted-foreground')}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>{format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} — {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}</>
                ) : (
                  format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
                )
              ) : (
                <span>Filtrar por período</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <DateRangePresets onSelect={setDateRange} />
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ptBR}
              defaultMonth={dateRange?.from ?? new Date(year, month - 1, 1)}
              initialFocus
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
        {dateRange?.from && (
          <Button variant="ghost" size="sm" onClick={() => setDateRange(undefined)}>
            <X className="h-4 w-4 mr-1" /> Limpar
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Atualizar dados de distribuição de conteúdo"
          className="h-9 px-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Investido', value: fmt(kpis.totalSpend) },
          { label: 'Total Impressões', value: fmtInt(kpis.totalImpressions) },
          { label: 'Dias Monitorados', value: fmtInt(kpis.days) },
          { label: 'CPM Médio', value: fmt(kpis.cpm) },
          { label: 'Investimento Médio/Dia', value: fmt(kpis.avgDailySpend) },
          { label: 'Impressões Médias/Dia', value: fmtInt(kpis.avgDailyImpressions) },
          { label: 'Melhor Dia (impressões)', value: kpis.bestDay ? fmtInt(kpis.bestDay.impressions) : '—' },
          { label: 'Custo por Impressão', value: fmt(kpis.costPerImpression) },
        ].map((k) => (
          <Card key={k.label} className="glass-surface border-primary/10">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.label}</div>
              <div className="text-xl font-bold mt-1">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="glass-surface border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Insights
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            {insights.map((i, idx) => <div key={idx} className="text-muted-foreground">• {i}</div>)}
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-surface border-primary/10 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento vs Impressões (Diário)</CardTitle></CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="spend" name="Investimento (R$)" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="impressions" name="Impressões" stroke={chartColor(1)} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento Diário</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="spend" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Impressões Diárias</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmtInt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="impressions" stroke={chartColor(1)} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">CPM Diário (R$/mil impressões)</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Bar dataKey="cpm" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Performance Semanal</CardTitle></CardHeader>
          <CardContent className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={weeklyChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="spend" name="Investimento" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="impressions" name="Impressões" stroke={chartColor(1)} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="glass-surface border-primary/10">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento Diário</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead className="text-right">Investimento</TableHead>
                <TableHead className="text-right">Impressões</TableHead>
                <TableHead className="text-right">CPM</TableHead>
                <TableHead className="text-right">Custo/Impressão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...dailySorted].reverse().map((r, i) => {
                const cpm = r.impressions ? (r.amount_spent / r.impressions) * 1000 : 0;
                const cpi = r.impressions ? r.amount_spent / r.impressions : 0;
                return (
                  <TableRow key={i}>
                    <TableCell>{fmtDate(r.day)}</TableCell>
                    <TableCell className="text-right">{fmt(r.amount_spent)}</TableCell>
                    <TableCell className="text-right">{fmtInt(r.impressions)}</TableCell>
                    <TableCell className="text-right">{fmt(cpm)}</TableCell>
                    <TableCell className="text-right">{fmt(cpi)}</TableCell>
                  </TableRow>
                );
              })}
              {!dailySorted.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum dia importado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canEdit && (
      <Card className="glass-surface border-primary/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4" /> Fonte de Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>
            Dados sincronizados automaticamente da planilha Meta Ads, filtrando por produto <strong>Impulsionamento</strong>.
            Atualiza a cada 5 minutos.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            <div>
              <div>Dias com dados</div>
              <div className="font-medium text-foreground">{kpis.days}</div>
            </div>
            <div>
              <div>Total investido</div>
              <div className="font-medium text-foreground">{fmt(kpis.totalSpend)}</div>
            </div>
            <div>
              <div>Status</div>
              <div className="font-medium flex items-center gap-1 text-foreground">
                <CheckCircle2 className="h-3 w-3 text-success" /> Sincronização automática
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );

}
