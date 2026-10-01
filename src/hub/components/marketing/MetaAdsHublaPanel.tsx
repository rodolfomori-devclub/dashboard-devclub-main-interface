import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DateRangePresets from './DateRangePresets';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { CalendarIcon, X, TrendingUp, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const META_TAX_RATE = 0.1383;
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line,
} from 'recharts';
import { chartColor, TOOLTIP_STYLE, AXIS_COLOR, GRID_COLOR } from '@/lib/chartPalette';

const fmt = (v: number) => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v: number) => Math.round(isFinite(v) ? v : 0).toLocaleString('pt-BR');
const fmtPct = (v: number) => isFinite(v) ? `${(v * 100).toFixed(1)}%` : '0%';
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

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

interface Props {
  from: string;
  to: string;
}

// Maps Meta Ads product code (column C of "Meta Ads") to the exact Hubla
// product name (column B of "Vendas aprovadas Hubla") used to identify the
// main buyer for orderbump aggregation.
const HUBLA_PRODUCT_MAP: Record<string, string> = {
  BT_BARB: 'Bootcamp: SAAS de agendamentos para barbearias',
  SOLID: 'Workshop SOLID',
  POSGRADUACAO: 'Pós-Graduação',
};

export default function MetaAdsHublaPanel({ from, to }: Props) {
  const [product, setProduct] = useState<string>('BT_BARB');
  const [localRange, setLocalRange] = useState<DateRange | undefined>(undefined);
  const [includeMetaTax, setIncludeMetaTax] = useState<boolean>(false);
  const hublaFilter = HUBLA_PRODUCT_MAP[product] ?? product;

  const { data, isLoading, error } = useQuery({
    queryKey: ['low-ticket-meta-hubla'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('low-ticket-meta-hubla');
      if (error) throw new Error(error.message);
      return data as { metaAds: string[][]; hublaSales: string[][]; fetched_at: string };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  const effectiveFrom = localRange?.from ? format(localRange.from, 'yyyy-MM-dd') : from;
  const effectiveTo = localRange?.from
    ? format(localRange.to ?? localRange.from, 'yyyy-MM-dd')
    : to;

  // Available products from Meta Ads sheet (column index 2)
  // "Impulsionamento" is excluded — it belongs exclusively to the "Distribuição de Conteúdo" tab.
  const products = useMemo(() => {
    const set = new Set<string>();
    (data?.metaAds || []).forEach(row => {
      const p = (row[2] || '').trim();
      if (p && p.toLowerCase() !== 'impulsionamento') set.add(p);
    });
    return Array.from(set).sort();
  }, [data]);

  // Available Hubla product names from column B (index 1), deduped by normalized form.
  // Keeps the shortest label per group so variants like
  // "Bootcamp: SAAS de agendamentos para barbearias" and "Bootcamp SAAS Barbearias" collapse to one entry.
  const hublaProducts = useMemo(() => {
    const norm = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    const byKey = new Map<string, string>();
    (data?.hublaSales || []).forEach(row => {
      const p = (row[1] || '').trim();
      if (!p) return;
      const key = norm(p).split(' ').slice(0, 3).join(' '); // group by first 3 significant words
      const cur = byKey.get(key);
      if (!cur || p.length < cur.length) byKey.set(key, p);
    });
    return Array.from(byKey.values()).sort();
  }, [data]);

  // Aggregations for the chosen product
  const agg = useMemo(() => {
    const empty = {
      spend: 0, leads: 0, clicks: 0, impressions: 0, pageviews: 0,
      salesCount: 0, revenue: 0,
      dailySpend: new Map<string, number>(),
      dailyRevenue: new Map<string, number>(),
      dailySalesCount: new Map<string, number>(),
      salesRows: [] as { date: string; email: string; name: string; revenue: number; items: number }[],
    };
    if (!data || !product) return empty;

    // --- Meta Ads spend for the product ---
    const taxMult = includeMetaTax ? 1 + META_TAX_RATE : 1;
    (data.metaAds || []).forEach(row => {
      const rowProd = (row[2] || '').trim();
      if (rowProd !== product) return;
      const d = normalizeDate(row[1]);
      if (!d || d < effectiveFrom || d > effectiveTo) return;
      const invest = num(row[7]) * taxMult;
      empty.spend += invest;
      empty.leads += num(row[14]);
      empty.clicks += num(row[8]);
      empty.impressions += num(row[9]);
      empty.pageviews += num(row[10]);
      empty.dailySpend.set(d, (empty.dailySpend.get(d) || 0) + invest);
    });

    // --- Hubla sales matching ---
    // Two passes:
    //  1. Find (email + date) pairs that bought the MAIN product (tokens match).
    //  2. Include ALL other Hubla rows for the same email+date as orderbumps
    //     (revenue summed into the same sale, still counted as 1 unique sale).
    const productLower = product.toLowerCase();
    const normalize = (s: string) => s.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ').trim();
    const filterTokens = normalize(hublaFilter).split(' ').filter(t => t.length >= 3);
    const bucket = new Map<string, { date: string; email: string; name: string; revenue: number; items: number }>();
    const mainBuyers = new Set<string>(); // key = email|date

    // Pass 1: identify main-product buyers.
    // Match if EITHER the Hubla product name (col B) matches the main product tokens
    // OR the utm_campaign (col I) contains the Meta Ads product code (e.g. "BT_BARB").
    // The UTM check covers cases where Hubla only lists an orderbump for a real
    // Bootcamp buyer (no explicit front-product row).
    const productCodeLower = product.toLowerCase();
    (data.hublaSales || []).forEach(row => {
      const d = normalizeDate(row[0]);
      if (!d || d < effectiveFrom || d > effectiveTo) return;
      const produtoNorm = normalize(row[1] || '');
      const utmCampaign = (row[8] || '').toLowerCase();
      const isMain =
        (filterTokens.length && filterTokens.every(t => produtoNorm.includes(t))) ||
        utmCampaign.includes(productCodeLower);
      if (!isMain) return;
      const email = (row[6] || '').trim().toLowerCase();
      if (!email) return;
      mainBuyers.add(`${email}|${d}`);
    });


    // Pass 2: bucket main product + all orderbumps (same email+date)
    (data.hublaSales || []).forEach(row => {
      const d = normalizeDate(row[0]);
      if (!d || d < effectiveFrom || d > effectiveTo) return;
      const email = (row[6] || '').trim().toLowerCase();
      if (!email) return;
      const key = `${email}|${d}`;
      if (!mainBuyers.has(key)) return; // ignore rows from unrelated buyers
      const value = num(row[2]);
      const name = (row[5] || '').trim();
      const cur = bucket.get(key);
      if (cur) {
        cur.revenue += value;
        cur.items += 1;
      } else {
        bucket.set(key, { date: d, email, name, revenue: value, items: 1 });
      }
    });

    bucket.forEach(sale => {
      empty.salesCount += 1;
      empty.revenue += sale.revenue;
      empty.dailyRevenue.set(sale.date, (empty.dailyRevenue.get(sale.date) || 0) + sale.revenue);
      empty.dailySalesCount.set(sale.date, (empty.dailySalesCount.get(sale.date) || 0) + 1);
      empty.salesRows.push(sale);
    });
    empty.salesRows.sort((a, b) => b.date.localeCompare(a.date));

    return empty;
  }, [data, product, effectiveFrom, effectiveTo, hublaFilter, includeMetaTax]);

  const roas = agg.spend > 0 ? agg.revenue / agg.spend : 0;
  const cpa = agg.salesCount > 0 ? agg.spend / agg.salesCount : 0;
  const cpl = agg.leads > 0 ? agg.spend / agg.leads : 0;
  const ticket = agg.salesCount > 0 ? agg.revenue / agg.salesCount : 0;
  const ctr = agg.impressions > 0 ? agg.clicks / agg.impressions : 0;

  // Daily merged series
  const dailySeries = useMemo(() => {
    const days = new Set<string>([...agg.dailySpend.keys(), ...agg.dailyRevenue.keys()]);
    return Array.from(days).sort().map(day => ({
      day,
      label: fmtDate(day),
      spend: agg.dailySpend.get(day) || 0,
      revenue: agg.dailyRevenue.get(day) || 0,
      sales: agg.dailySalesCount.get(day) || 0,
      roas: (agg.dailySpend.get(day) || 0) > 0
        ? (agg.dailyRevenue.get(day) || 0) / (agg.dailySpend.get(day) || 1)
        : 0,
    }));
  }, [agg]);

  return (
    <Card className="glass-surface border-primary/20">
      <CardHeader className="pb-3 flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Meta Ads × Vendas Hubla (por produto)
        </CardTitle>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Produto" /></SelectTrigger>
            <SelectContent>
              {products.length === 0 && <SelectItem value="BT_BARB">BT_BARB</SelectItem>}
              {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('justify-start text-left font-normal min-w-[220px]', !localRange?.from && 'text-muted-foreground')}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {localRange?.from ? (
                  localRange.to
                    ? <>{format(localRange.from, 'dd/MM/yy', { locale: ptBR })} — {format(localRange.to, 'dd/MM/yy', { locale: ptBR })}</>
                    : format(localRange.from, 'dd/MM/yyyy', { locale: ptBR })
                ) : <span>Período (herda filtro)</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <DateRangePresets onSelect={setLocalRange} />
              <Calendar mode="range" selected={localRange} onSelect={setLocalRange} numberOfMonths={2} locale={ptBR} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {localRange?.from && (
            <Button variant="ghost" size="sm" onClick={() => setLocalRange(undefined)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <div className="text-sm text-muted-foreground py-4 text-center">Carregando…</div>}
        {error && <div className="text-sm text-error py-2">Erro: {(error as Error).message}</div>}

        <div className="flex flex-wrap gap-3 items-center justify-end p-3 rounded-lg border border-primary/10 bg-muted/20">
          <div className="text-xs text-muted-foreground flex items-center gap-1 mr-auto">
            <Info className="h-3 w-3" /> Vendas contadas na Hubla: <span className="font-medium text-foreground">{hublaFilter}</span>
          </div>
          <label className={cn(
            'flex items-center gap-3 cursor-pointer select-none h-10 px-4 rounded-md border-2 transition-colors',
            includeMetaTax
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-primary/30 bg-background/50 hover:border-primary/60'
          )}>
            <Switch
              checked={includeMetaTax}
              onCheckedChange={(v) => setIncludeMetaTax(v === true)}
            />
            <span className="text-xs font-semibold whitespace-nowrap">
              Incluir imposto Meta (+{(META_TAX_RATE * 100).toFixed(2).replace('.', ',')}%)
            </span>
          </label>
        </div>



        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Investimento', value: fmt(agg.spend) },
            { label: 'Receita Total', value: fmt(agg.revenue), highlight: true },
            { label: 'Vendas (únicas)', value: fmtInt(agg.salesCount) },
            { label: 'Ticket Médio', value: fmt(ticket) },
            { label: 'ROAS', value: `${roas.toFixed(2)}x`, highlight: true },
            { label: 'CPA', value: fmt(cpa) },
            { label: 'Leads', value: fmtInt(agg.leads) },
            { label: 'CPL', value: fmt(cpl) },
          ].map(k => (
            <Card key={k.label} className={cn('glass-surface border-primary/10', k.highlight && 'border-primary/40')}>
              <CardContent className="p-3">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className={cn('text-lg font-bold mt-1', k.highlight && 'text-primary')}>{k.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="glass-surface border-primary/10">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento vs Receita (diário)</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS_COLOR }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} />
                  <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
                  <Legend wrapperStyle={{ fontSize: 11, color: AXIS_COLOR }} />
                  {/* `--accent` e superficie (navy-3) no DevClub: a barra sumia
                      contra o card. Investimento vai para o azul categorico e
                      Receita fica com o verde da marca (slot 0). */}
                  <Bar dataKey="spend" fill={chartColor(1)} name="Investimento" radius={[4,4,0,0]} />
                  <Bar dataKey="revenue" fill={chartColor(0)} name="Receita" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="glass-surface border-primary/10">
            <CardHeader className="pb-2"><CardTitle className="text-sm">ROAS por Dia</CardTitle></CardHeader>
            <CardContent className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailySeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: AXIS_COLOR }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: AXIS_COLOR }} />
                  <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}x`} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
                  <Line type="monotone" dataKey="roas" stroke={chartColor(0)} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>


        {data?.fetched_at && (
          <p className="text-[10px] text-muted-foreground text-right">
            Sincronizado às {new Date(data.fetched_at).toLocaleTimeString('pt-BR')} (cache 5 min)
          </p>
        )}
      </CardContent>
    </Card>
  );
}
