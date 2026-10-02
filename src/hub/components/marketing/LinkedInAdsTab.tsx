import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RefreshCw, DollarSign, Users, Target, TrendingUp, Percent } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Config: campaign → cost sheet + campaign group + leads sheet + MQL rule ───
type CampaignKey = 'brl' | 'usd' | 'consultoria';

interface CampaignConfig {
  label: string;
  currency: 'BRL' | 'USD';
  costSheet: 'costBRL' | 'costUSD';
  campaignGroup: string[]; // Chaves externas da planilha; exibir label na interface.
  leadsSheet: 'leadsBRL' | 'leadsUSD' | 'leadsCons';
  hasOrigem: boolean; // whether leads sheet has an Origem column (G)
  mqlColumnIndex: number; // 0-based column in the lead row that indicates MQL
  mqlValues: string[]; // values (lowercased) that count as MQL
}

const CAMPAIGNS: Record<CampaignKey, CampaignConfig> = {
  brl: {
    label: 'Workshop Global - BRL',
    currency: 'BRL',
    costSheet: 'costBRL',
    campaignGroup: ['BOOTCAMP_GRATUITO_GLOBAL'],
    leadsSheet: 'leadsBRL',
    hasOrigem: true,
    mqlColumnIndex: 5, // column F
    mqlValues: ['sim'],
  },
  usd: {
    label: 'Workshop Global - USD',
    currency: 'USD',
    costSheet: 'costUSD',
    campaignGroup: ['FSC1225_LKD_FRIO_28.11.25'],
    leadsSheet: 'leadsUSD',
    hasOrigem: false,
    mqlColumnIndex: 5,
    mqlValues: ['sim'],
  },
  consultoria: {
    label: 'Consultoria Global',
    currency: 'BRL',
    costSheet: 'costBRL',
    campaignGroup: ['CONSULTORIA_GLOBAL_13.04.26'],
    leadsSheet: 'leadsCons',
    hasOrigem: true,
    mqlColumnIndex: 5, // "Nível de Experiência"
    mqlValues: ['pleno', 'sênior', 'senior'],
  },
};

// ─── Helpers ───
const parseBrNumber = (v: string | undefined | null): number => {
  if (v == null || v === '') return 0;
  const s = String(v).trim().replace(/[^\d,.-]/g, '');
  // If both , and . present, assume '.' thousand sep, ',' decimal
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};

const parseIsoDate = (s: string): string | null => {
  if (!s) return null;
  const t = s.trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
};

const fmtMoney = (v: number, currency: 'BRL' | 'USD') =>
  v.toLocaleString(currency === 'USD' ? 'en-US' : 'pt-BR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  });
const fmtInt = (v: number) => Math.round(v).toLocaleString('pt-BR');
const fmtPct = (v: number) => (isFinite(v) ? `${(v * 100).toFixed(1)}%` : '0%');

// Date shortcut helpers (yyyy-MM-dd in local time)
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type Preset = 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'custom';

function presetRange(preset: Preset, custom?: { from: string; to: string }): { from: string; to: string } {
  const today = new Date();
  if (preset === 'today') return { from: toIso(today), to: toIso(today) };
  if (preset === 'yesterday') {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: toIso(y), to: toIso(y) };
  }
  if (preset === 'last7') {
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    return { from: toIso(from), to: toIso(today) };
  }
  if (preset === 'last30') {
    const from = new Date(today);
    from.setDate(from.getDate() - 29);
    return { from: toIso(from), to: toIso(today) };
  }
  if (preset === 'thisMonth') {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: toIso(from), to: toIso(today) };
  }
  return { from: custom?.from || toIso(today), to: custom?.to || toIso(today) };
}

interface SheetsData {
  costBRL: string[][];
  costUSD: string[][];
  leadsBRL: string[][];
  leadsUSD: string[][];
  leadsCons: string[][];
  fetched_at: string;
}

// ─── Metric card ───
function StatCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Card className="glass-surface border-border/40">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="text-primary/70">{icon}</span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// ─── Per-campaign dashboard ───
function CampaignDashboard({ campaignKey, data }: { campaignKey: CampaignKey; data: SheetsData }) {
  const cfg = CAMPAIGNS[campaignKey];
  const [preset, setPreset] = useState<Preset>('last7');
  const [customFrom, setCustomFrom] = useState(toIso(new Date()));
  const [customTo, setCustomTo] = useState(toIso(new Date()));
  const [subCampaign, setSubCampaign] = useState<string>('all');

  const range = useMemo(
    () => presetRange(preset, { from: customFrom, to: customTo }),
    [preset, customFrom, customTo]
  );

  // ─── Filter cost rows ───
  const costRows = data[cfg.costSheet] || [];
  const filteredCost = useMemo(() => {
    return costRows.filter((row) => {
      const date = parseIsoDate(row[1]);
      const group = (row[2] || '').trim();
      if (!date) return false;
      if (!cfg.campaignGroup.includes(group)) return false;
      return date >= range.from && date <= range.to;
    });
  }, [costRows, cfg.campaignGroup, range]);

  const totalSpend = useMemo(
    () => filteredCost.reduce((s, r) => s + parseBrNumber(r[3]), 0),
    [filteredCost]
  );

  // ─── Filter lead rows ───
  const leadRows = data[cfg.leadsSheet] || [];

  // Sub-campaign options
  const subOptions = useMemo(() => {
    if (cfg.hasOrigem) {
      const set = new Set<string>();
      leadRows.forEach((r) => {
        const o = (r[6] || '').trim();
        if (o) set.add(o);
      });
      return Array.from(set).sort();
    }
    // Fallback: use Campaign Group Name from cost sheet
    const set = new Set<string>();
    costRows.forEach((r) => {
      const g = (r[2] || '').trim();
      if (cfg.campaignGroup.includes(g)) set.add(g);
    });
    return Array.from(set).sort();
  }, [leadRows, costRows, cfg]);

  const filteredLeads = useMemo(() => {
    return leadRows.filter((row) => {
      const date = parseIsoDate(row[0]);
      if (!date) return false;
      if (date < range.from || date > range.to) return false;
      if (subCampaign !== 'all' && cfg.hasOrigem) {
        const o = (row[6] || '').trim();
        if (o !== subCampaign) return false;
      }
      return true;
    });
  }, [leadRows, range, subCampaign, cfg.hasOrigem]);

  const leadsCount = filteredLeads.length;
  const mqlCount = useMemo(
    () =>
      filteredLeads.filter((r) => {
        const v = (r[cfg.mqlColumnIndex] || '').trim().toLowerCase();
        return cfg.mqlValues.some((m) => v === m);
      }).length,
    [filteredLeads, cfg]
  );

  const cpl = leadsCount ? totalSpend / leadsCount : 0;
  const costPerMql = mqlCount ? totalSpend / mqlCount : 0;
  const mqlRate = leadsCount ? mqlCount / leadsCount : 0;

  const isSubFiltered = subCampaign !== 'all' && cfg.hasOrigem;

  // ─── Daily breakdown for chart ───
  const dailyStats = useMemo(() => {
    const map = new Map<string, { date: string; leads: number; mql: number; disqualified: number }>();
    filteredLeads.forEach((row) => {
      const date = parseIsoDate(row[0]);
      if (!date) return;
      const entry = map.get(date) || { date, leads: 0, mql: 0, disqualified: 0 };
      entry.leads += 1;
      const v = (row[cfg.mqlColumnIndex] || '').trim().toLowerCase();
      if (cfg.mqlValues.some((m) => v === m)) {
        entry.mql += 1;
      } else {
        entry.disqualified += 1;
      }
      map.set(date, entry);
    });
    const dates = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
    // Fill in missing dates with zero so the chart shows the full range
    const filled: typeof dates = [];
    const start = new Date(range.from + 'T00:00:00');
    const end = new Date(range.to + 'T00:00:00');
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = toIso(d);
      const existing = map.get(iso);
      filled.push(existing || { date: iso, leads: 0, mql: 0, disqualified: 0 });
    }
    return filled;
  }, [filteredLeads, cfg, range]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="glass-surface border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {(
                [
                  { k: 'today', l: 'Hoje' },
                  { k: 'yesterday', l: 'Ontem' },
                  { k: 'last7', l: 'Últimos 7 dias' },
                  { k: 'last30', l: 'Últimos 30 dias' },
                  { k: 'thisMonth', l: 'Esse mês' },
                  { k: 'custom', l: 'Personalizado' },
                ] as { k: Preset; l: string }[]
              ).map((p) => (
                <Button
                  key={p.k}
                  size="sm"
                  variant={preset === p.k ? 'default' : 'outline'}
                  onClick={() => setPreset(p.k)}
                >
                  {p.l}
                </Button>
              ))}
            </div>
            {preset === 'custom' && (
              <div className="flex items-center gap-2">
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">De</Label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase text-muted-foreground">Até</Label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="h-9 w-[150px]"
                  />
                </div>
              </div>
            )}
            <div className="ml-auto min-w-[260px]">
              <Label className="text-[10px] uppercase text-muted-foreground">Sub-campanha / Origem</Label>
              <Select value={subCampaign} onValueChange={setSubCampaign}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {subOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {cfg.campaignGroup.includes(o) ? cfg.label : o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Período: <span className="font-medium text-foreground">{range.from}</span> →{' '}
            <span className="font-medium text-foreground">{range.to}</span>
            {' · '}Campanha: <span className="font-medium text-foreground">{cfg.label}</span>
          </p>
        </CardContent>
      </Card>

      {/* Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Investimento Total"
          value={fmtMoney(totalSpend, cfg.currency)}
          icon={<DollarSign className="h-4 w-4" />}
          subtitle={isSubFiltered ? 'Custo total do grupo (sem quebra por origem)' : undefined}
        />
        <StatCard label="Leads" value={fmtInt(leadsCount)} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="CPL"
          value={leadsCount ? fmtMoney(cpl, cfg.currency) : '—'}
          icon={<Target className="h-4 w-4" />}
          subtitle="Investimento / Leads"
        />
        <StatCard label="MQL" value={fmtInt(mqlCount)} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard
          label="Custo por MQL"
          value={mqlCount ? fmtMoney(costPerMql, cfg.currency) : '—'}
          icon={<DollarSign className="h-4 w-4" />}
          subtitle="Investimento / MQL"
        />
        <StatCard
          label="Taxa de MQL"
          value={fmtPct(mqlRate)}
          icon={<Percent className="h-4 w-4" />}
          subtitle="MQL / Leads"
        />
      </div>

      {/* Daily chart */}
      <Card className="glass-surface border-border/40">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-4">Leads · MQL · Desqualificados por dia</h3>
          <div className="w-full" style={{ height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyStats} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(v: string) => {
                    const [y, m, d] = v.split('-');
                    return `${d}/${m}`;
                  }}
                />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: 6,
                    color: '#f8fafc',
                    fontSize: 13,
                  }}
                  labelFormatter={(label: string) => {
                    const [y, m, d] = label.split('-');
                    return `${d}/${m}/${y}`;
                  }}
                  formatter={(value: number, name: string) => [fmtInt(value), name]}
                />
                <Legend wrapperStyle={{ fontSize: 13, color: '#cbd5e1' }} />
                <Bar dataKey="leads" name="Leads" fill="#34d399" radius={[4, 4, 0, 0]} />
                <Bar dataKey="mql" name="MQL" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disqualified" name="Desqualificados" fill="#fb7185" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main tab ───
export default function LinkedInAdsTab() {
  const [inner, setInner] = useState<CampaignKey>('brl');

  const { data, isLoading, isFetching, refetch, error } = useQuery<SheetsData>({
    queryKey: ['linkedin-ads-sheets'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('linkedin-ads-sheets');
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as SheetsData;
    },
    refetchInterval: 5 * 60 * 1000, // 5min
    staleTime: 60_000,
  });

  useEffect(() => {
    if (error) toast.error(`Erro ao carregar dados: ${(error as Error).message}`);
  }, [error]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">LinkedIn Ads · Dashboard por Campanha</h2>
          <p className="text-[11px] text-muted-foreground">
            Fonte: Google Sheets (atualiza a cada 5 min).{' '}
            {data?.fetched_at && `Última leitura: ${new Date(data.fetched_at).toLocaleTimeString('pt-BR')}`}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {isLoading && (
        <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
          Carregando dados da planilha…
        </div>
      )}

      {!isLoading && data && (
        <Tabs value={inner} onValueChange={(v) => setInner(v as CampaignKey)}>
          <TabsList className="grid w-full grid-cols-3 h-auto">
            <TabsTrigger value="brl">Workshop Global - BRL</TabsTrigger>
            <TabsTrigger value="usd">Workshop Global - USD</TabsTrigger>
            <TabsTrigger value="consultoria">Consultoria Global</TabsTrigger>
          </TabsList>
          <TabsContent value="brl" className="mt-4">
            <CampaignDashboard campaignKey="brl" data={data} />
          </TabsContent>
          <TabsContent value="usd" className="mt-4">
            <CampaignDashboard campaignKey="usd" data={data} />
          </TabsContent>
          <TabsContent value="consultoria" className="mt-4">
            <CampaignDashboard campaignKey="consultoria" data={data} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
