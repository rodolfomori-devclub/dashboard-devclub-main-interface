import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DateRangePresets from './DateRangePresets';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { RefreshCw, Link2, CheckCircle2, AlertTriangle, Sparkles, CalendarIcon, X, Search, ArrowUpDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { CHART_PALETTE, chartColor } from '@/lib/chartPalette';
import MetaAdsHublaPanel from './MetaAdsHublaPanel';
import MetaFunnelCard from './MetaFunnelCard';

const fmt = (v: number) => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v: number) => Math.round(isFinite(v) ? v : 0).toLocaleString('pt-BR');
const fmtPct = (v: number) => isFinite(v) ? `${(v * 100).toFixed(1)}%` : '0%';
const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
};

/* Paleta categorica compartilhada — verde so no slot 1, sem token de
 * superficie (var(--accent) = navy-4) nem roxo legado como cor de serie. */
const COLORS = CHART_PALETTE;

interface Purchase {
  id?: string;
  source_sheet: string;
  purchase_date: string;
  product: string;
  platform: string;
  customer: string;
  purchase_amount: number;
  installments: number;
  revenue: number;
  status: string;
  origin: string;
}

interface AdRow {
  id?: string;
  source_sheet: string;
  day: string;
  amount_spent: number;
  impressions: number;
  frequency: number;
  link_clicks: number;
  landing_page_views: number;
  checkouts_initiated: number;
  purchases: number;
  ad_set_name: string;
  ad_name: string;
  creative_permalink: string;
}

interface KpiRow {
  id?: string;
  source_sheet: string;
  day: string;
  mes: string;
  valor_gasto: number;
  lucro_bruto: number;
  cpm: number;
  impressoes: number;
  cliques: number;
  cpc: number;
  pageview: number;
  custo_pageview: number;
  conversao_pagina_geral: number;
  conversao_pagina_trafego: number;
  checkout_sobre_pageview: number;
  conversao_checkout: number;
  custo_por_checkout: number;
  num_checkout: number;
  cpa: number;
  vendas_qtd: number;
  ctr: number;
  connect_rate: number;
  ticket_medio: number;
  total_em_vendas: number;
  roas: number;
  cpa_real: number;
  lucro: number;
}

const ALIASES: Record<string, keyof Purchase> = {
  // date
  'purchase date': 'purchase_date', 'data da compra': 'purchase_date', 'data': 'purchase_date', 'date': 'purchase_date', 'dia': 'purchase_date',
  // product
  'product': 'product', 'produto': 'product', 'oferta': 'product', 'item': 'product',
  // platform
  'platform': 'platform', 'plataforma': 'platform', 'gateway': 'platform',
  // customer
  'customer': 'customer', 'cliente': 'customer', 'nome': 'customer', 'name': 'customer', 'email': 'customer',
  // amount
  'purchase amount': 'purchase_amount', 'valor da compra': 'purchase_amount', 'valor': 'purchase_amount', 'amount': 'purchase_amount', 'preço': 'purchase_amount', 'preco': 'purchase_amount',
  // installments
  'installments': 'installments', 'parcelas': 'installments', 'qtd parcelas': 'installments',
  // revenue
  'revenue': 'revenue', 'receita': 'revenue', 'faturamento': 'revenue', 'líquido': 'revenue', 'liquido': 'revenue', 'valor líquido': 'revenue', 'valor liquido': 'revenue', 'net': 'revenue',
  // status
  'status': 'status', 'situação': 'status', 'situacao': 'status',
  // origin
  'origin': 'origin', 'origem': 'origin', 'source': 'origin', 'utm': 'origin', 'fonte': 'origin', 'utm source': 'origin',
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

function parseDate(v: any): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return '';
}

function normalizePlatform(p: string): string {
  const v = (p || '').trim().toLowerCase();
  if (v.includes('hubla')) return 'Hubla';
  if (v.includes('tmb')) return 'TMB';
  return p || 'Outros';
}

function isApproved(s: string): boolean {
  const v = (s || '').toLowerCase().trim();
  if (!v) return true;
  return /aprov|approved|pago|paid|confirm|success/.test(v);
}

// Detect sheet type by header signature
type SheetKind = 'sales' | 'ads' | 'kpis' | 'skip';
function detectSheetKind(name: string, headers: string[]): SheetKind {
  const lname = name.toLowerCase();
  if (/planilha\s*\d|guru/i.test(lname)) return 'skip';
  const hset = new Set(headers.map(h => normalizeKey(h)));
  if (hset.has('amount spent') || hset.has('impressions')) return 'ads';
  if (hset.has('valor gasto') || hset.has('roas') || hset.has('cpa real')) return 'kpis';
  if ((hset.has('valor') || hset.has('valor ajustado')) && (hset.has('data') || hset.has('data ajustada')) && hset.has('email')) return 'sales';
  return 'skip';
}

function parseSalesRows(rows: any[], sheetName: string): Purchase[] {
  if (!rows.length) return [];
  const cols = Object.keys(rows[0]);
  const map: Record<string, keyof Purchase> = {};
  cols.forEach(c => {
    const k = ALIASES[normalizeKey(c)];
    if (k && !Object.values(map).includes(k)) map[c] = k;
  });
  const out: Purchase[] = [];
  rows.forEach(r => {
    const o: Purchase = {
      source_sheet: sheetName,
      purchase_date: '', product: '', platform: '', customer: '',
      purchase_amount: 0, installments: 1, revenue: 0, status: '', origin: '',
    };
    Object.entries(map).forEach(([orig, key]) => {
      const v = r[orig];
      if (key === 'purchase_date') o.purchase_date = parseDate(v);
      else if (key === 'purchase_amount' || key === 'revenue') (o as any)[key] = num(v);
      else if (key === 'installments') o.installments = Math.max(1, Math.round(num(v)) || 1);
      else if (key === 'platform') o.platform = normalizePlatform(String(v ?? ''));
      else (o as any)[key] = String(v ?? '').trim();
    });
    if (!o.product) o.product = sheetName;
    if (!o.platform) o.platform = 'Hubla';
    if (!o.purchase_date) return;
    if (!o.revenue) o.revenue = o.purchase_amount;
    if (o.purchase_amount === 0 && o.revenue === 0) return;
    out.push(o);
  });
  return out;
}

function parseAdsRows(rows: any[], sheetName: string): AdRow[] {
  const out: AdRow[] = [];
  rows.forEach(r => {
    const get = (k: string) => {
      for (const key of Object.keys(r)) if (normalizeKey(key) === k) return r[key];
      return undefined;
    };
    const day = parseDate(get('day') ?? get('dia') ?? get('data'));
    if (!day) return;
    const amount = num(get('amount spent'));
    if (!amount && !num(get('impressions'))) return;
    out.push({
      source_sheet: sheetName,
      day,
      amount_spent: amount,
      impressions: num(get('impressions')),
      frequency: num(get('frequency')),
      link_clicks: num(get('link clicks')),
      landing_page_views: num(get('landing page views')),
      checkouts_initiated: num(get('checkouts initiated')),
      purchases: num(get('purchases')),
      ad_set_name: String(get('ad set name') ?? '').trim(),
      ad_name: String(get('ad name') ?? '').trim(),
      creative_permalink: String(get('creative instagram permalink') ?? get('permalink') ?? '').trim(),
    });
  });
  return out;
}

function parseKpisRows(rows: any[], sheetName: string): KpiRow[] {
  const out: KpiRow[] = [];
  rows.forEach(r => {
    const get = (k: string) => {
      for (const key of Object.keys(r)) if (normalizeKey(key) === k) return r[key];
      return undefined;
    };
    const day = parseDate(get('') ?? get('data') ?? get('dia'));
    // Header in this sheet has empty first col holding the date
    const firstColKey = Object.keys(r)[0];
    const dayFromFirst = day || parseDate(r[firstColKey]);
    if (!dayFromFirst) return;
    if (!num(get('valor gasto')) && !num(get('total em vendas'))) return;
    out.push({
      source_sheet: sheetName,
      day: dayFromFirst,
      mes: String(get('mês') ?? get('mes') ?? '').trim(),
      valor_gasto: num(get('valor gasto')),
      lucro_bruto: num(get('lucro bruto')),
      cpm: num(get('cpm')),
      impressoes: num(get('nº impressões') ?? get('impressões')),
      cliques: num(get('nº cliques') ?? get('cliques')),
      cpc: num(get('cpc')),
      pageview: num(get('nº pageview') ?? get('pageview')),
      custo_pageview: num(get('custo pageview')),
      conversao_pagina_geral: num(get('conversão da página geral')),
      conversao_pagina_trafego: num(get('conversão página tráfego')),
      checkout_sobre_pageview: num(get('checkout sobre pageview')),
      conversao_checkout: num(get('conversão do checkout')),
      custo_por_checkout: num(get('custo por checkout')),
      num_checkout: num(get('nº checkout')),
      cpa: num(get('cpa')),
      vendas_qtd: num(get('saas  barbearias') ?? get('saas barbearias') ?? get('vendas')),
      ctr: num(get('ctr')),
      connect_rate: num(get('connect rate')),
      ticket_medio: num(get('tm')),
      total_em_vendas: num(get('total em vendas')),
      roas: num(get('roas')),
      cpa_real: num(get('cpa real')),
      lucro: num(get('lucro')),
    });
  });
  return out;
}

export default function LowTicketDevClubTab() {
  const qc = useQueryClient();
  const { isManager, isMarketing } = useAuth();
  const canEdit = isManager || isMarketing;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [productFilter, setProductFilter] = useState<string>('all');
  const [funnelFilter, setFunnelFilter] = useState<string>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [originFilter, setOriginFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Purchase>('purchase_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sheetUrl, setSheetUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [nextSyncAt, setNextSyncAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['low-ticket-meta-hubla'] }),
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_purchases'] }),
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_ads'] }),
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_kpis'] }),
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_settings'] }),
    ]);
    setRefreshing(false);
  };

  const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

  const { data: purchases = [] } = useQuery({
    queryKey: ['low_ticket_devclub_purchases'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('low_ticket_devclub_purchases').select('*').order('purchase_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Purchase[];
    },
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['low_ticket_devclub_ads'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('low_ticket_devclub_ads').select('*').order('day', { ascending: false });
      if (error) throw error;
      return (data || []) as AdRow[];
    },
  });

  const { data: kpisRows = [] } = useQuery({
    queryKey: ['low_ticket_devclub_kpis'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('low_ticket_devclub_kpis').select('*').order('day', { ascending: false });
      if (error) throw error;
      return (data || []) as KpiRow[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['low_ticket_devclub_settings'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('low_ticket_devclub_settings').select('*')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data && !urlLoaded) { setSheetUrl(data.sheet_url || ''); setUrlLoaded(true); }
      return data;
    },
    refetchInterval: 30_000,
  });

  const updateSettings = async (patch: Record<string, any>) => {
    if (!settings?.id) return;
    await (supabase as any).from('low_ticket_devclub_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', settings.id);
    qc.invalidateQueries({ queryKey: ['low_ticket_devclub_settings'] });
  };

  const importMutation = useMutation({
    mutationFn: async (payload: { purchases: Purchase[]; ads: AdRow[]; kpis: KpiRow[] }) => {
      const NIL = '00000000-0000-0000-0000-000000000000';
      // Replace all (full sync)
      await (supabase as any).from('low_ticket_devclub_purchases').delete().neq('id', NIL);
      await (supabase as any).from('low_ticket_devclub_ads').delete().neq('id', NIL);
      await (supabase as any).from('low_ticket_devclub_kpis').delete().neq('id', NIL);
      if (payload.purchases.length) {
        const { error } = await (supabase as any).from('low_ticket_devclub_purchases').insert(payload.purchases);
        if (error) throw error;
      }
      if (payload.ads.length) {
        const { error } = await (supabase as any).from('low_ticket_devclub_ads').insert(payload.ads);
        if (error) throw error;
      }
      if (payload.kpis.length) {
        const { error } = await (supabase as any).from('low_ticket_devclub_kpis').insert(payload.kpis);
        if (error) throw error;
      }
      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_purchases'] });
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_ads'] });
      qc.invalidateQueries({ queryKey: ['low_ticket_devclub_kpis'] });
    },
  });

  const syncSheet = useCallback(async (opts?: { silent?: boolean; urlOverride?: string }) => {
    const raw = (opts?.urlOverride ?? sheetUrl).trim();
    if (!raw) { if (!opts?.silent) toast.error('Cole a URL da planilha'); return; }
    try {
      const m = raw.match(/spreadsheets\/d\/([^/]+)/);
      if (!m) throw new Error('URL inválida. Use uma URL do Google Sheets.');
      const url = `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=xlsx`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Não foi possível baixar a planilha. Verifique se está pública.');
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });

      const allPurchases: Purchase[] = [];
      const allAds: AdRow[] = [];
      const allKpis: KpiRow[] = [];
      const summary: string[] = [];

      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (!rows.length) continue;
        const headers = Object.keys(rows[0]);
        const kind = detectSheetKind(name, headers);
        if (kind === 'sales') {
          const parsed = parseSalesRows(rows, name);
          if (parsed.length) { allPurchases.push(...parsed); summary.push(`${name}: ${parsed.length} vendas`); }
        } else if (kind === 'ads') {
          const parsed = parseAdsRows(rows, name);
          if (parsed.length) { allAds.push(...parsed); summary.push(`${name}: ${parsed.length} ads`); }
        } else if (kind === 'kpis') {
          const parsed = parseKpisRows(rows, name);
          if (parsed.length) { allKpis.push(...parsed); summary.push(`${name}: ${parsed.length} KPIs`); }
        }
      }

      if (!allPurchases.length && !allAds.length && !allKpis.length) {
        throw new Error('Nenhum dado válido encontrado nas abas.');
      }

      await importMutation.mutateAsync({ purchases: allPurchases, ads: allAds, kpis: allKpis });
      const msg = `Sync OK — ${allPurchases.length} vendas / ${allAds.length} ads / ${allKpis.length} KPIs`;
      if (!opts?.silent) toast.success(msg);
      await updateSettings({
        sheet_url: raw,
        last_synced_at: new Date().toISOString(),
        last_status: msg,
        last_row_count: allPurchases.length + allAds.length + allKpis.length,
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

  // Auto-sync every 10 minutes
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

  // Filtering
  const filtered = useMemo(() => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    let from = monthStart, to = monthEnd;
    if (dateRange?.from) {
      from = format(dateRange.from, 'yyyy-MM-dd');
      to = format(dateRange.to ?? dateRange.from, 'yyyy-MM-dd');
    }
    const q = search.toLowerCase().trim();
    return purchases.filter(p => {
      if (p.purchase_date < from || p.purchase_date > to) return false;
      if (funnelFilter !== 'all' && p.source_sheet !== funnelFilter) return false;
      if (productFilter !== 'all' && p.product !== productFilter) return false;
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (originFilter !== 'all' && p.origin !== originFilter) return false;
      if (q && !`${p.customer} ${p.product} ${p.origin}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [purchases, year, month, dateRange, funnelFilter, productFilter, platformFilter, statusFilter, originFilter, search]);

  // Filter ads/kpis by date range + funnel
  const dateBoundaries = useMemo(() => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    let from = monthStart, to = monthEnd;
    if (dateRange?.from) {
      from = format(dateRange.from, 'yyyy-MM-dd');
      to = format(dateRange.to ?? dateRange.from, 'yyyy-MM-dd');
    }
    return { from, to };
  }, [year, month, dateRange]);

  const filteredAds = useMemo(() => ads.filter(a =>
    a.day >= dateBoundaries.from && a.day <= dateBoundaries.to &&
    (funnelFilter === 'all' || a.source_sheet === funnelFilter)
  ), [ads, dateBoundaries, funnelFilter]);

  const filteredKpis = useMemo(() => kpisRows.filter(k =>
    k.day >= dateBoundaries.from && k.day <= dateBoundaries.to &&
    (funnelFilter === 'all' || k.source_sheet === funnelFilter)
  ), [kpisRows, dateBoundaries, funnelFilter]);

  const approvedRows = useMemo(() => filtered.filter(p => isApproved(p.status)), [filtered]);

  const funnelOptions = useMemo(() => {
    const set = new Set<string>();
    purchases.forEach(p => p.source_sheet && set.add(p.source_sheet));
    ads.forEach(a => a.source_sheet && set.add(a.source_sheet));
    kpisRows.forEach(k => k.source_sheet && set.add(k.source_sheet));
    return Array.from(set).sort();
  }, [purchases, ads, kpisRows]);
  const productOptions = useMemo(() => Array.from(new Set(purchases.map(p => p.product).filter(Boolean))).sort(), [purchases]);
  const platformOptions = useMemo(() => Array.from(new Set(purchases.map(p => p.platform).filter(Boolean))).sort(), [purchases]);
  const statusOptions = useMemo(() => Array.from(new Set(purchases.map(p => p.status).filter(Boolean))).sort(), [purchases]);
  const originOptions = useMemo(() => Array.from(new Set(purchases.map(p => p.origin).filter(Boolean))).sort(), [purchases]);

  // KPIs
  const kpis = useMemo(() => {
    const totalRevenue = approvedRows.reduce((s, p) => s + p.revenue, 0);
    const approvedCount = approvedRows.length;
    const totalCount = filtered.length;
    const totalVolume = filtered.reduce((s, p) => s + p.purchase_amount, 0);
    const avgTicket = approvedCount ? totalRevenue / approvedCount : 0;
    const approvalRate = totalCount ? approvedCount / totalCount : 0;
    const installmentVolume = approvedRows.reduce((s, p) => s + (p.installments || 1), 0);
    return { totalRevenue, approvedCount, totalCount, totalVolume, avgTicket, approvalRate, installmentVolume };
  }, [filtered, approvedRows]);

  // By platform
  const byPlatform = useMemo(() => {
    const map = new Map<string, { platform: string; revenue: number; count: number }>();
    approvedRows.forEach(p => {
      const k = p.platform || 'Outros';
      const cur = map.get(k) || { platform: k, revenue: 0, count: 0 };
      cur.revenue += p.revenue; cur.count += 1;
      map.set(k, cur);
    });
    const out = Array.from(map.values()).map(r => ({
      ...r,
      avgTicket: r.count ? r.revenue / r.count : 0,
      pct: kpis.totalRevenue ? r.revenue / kpis.totalRevenue : 0,
    })).sort((a, b) => b.revenue - a.revenue);
    // Add Hubla + TMB combo
    const hubla = out.find(o => o.platform === 'Hubla');
    const tmb = out.find(o => o.platform === 'TMB');
    if (hubla && tmb) {
      const combined = {
        platform: 'Hubla + TMB',
        revenue: hubla.revenue + tmb.revenue,
        count: hubla.count + tmb.count,
        avgTicket: (hubla.count + tmb.count) ? (hubla.revenue + tmb.revenue) / (hubla.count + tmb.count) : 0,
        pct: kpis.totalRevenue ? (hubla.revenue + tmb.revenue) / kpis.totalRevenue : 0,
      };
      out.push(combined);
    }
    return out;
  }, [approvedRows, kpis.totalRevenue]);

  // By product
  const byProduct = useMemo(() => {
    const map = new Map<string, { product: string; revenue: number; count: number }>();
    approvedRows.forEach(p => {
      const k = p.product || '—';
      const cur = map.get(k) || { product: k, revenue: 0, count: 0 };
      cur.revenue += p.revenue; cur.count += 1;
      map.set(k, cur);
    });
    return Array.from(map.values()).map(r => ({
      ...r,
      avgTicket: r.count ? r.revenue / r.count : 0,
      pct: kpis.totalRevenue ? r.revenue / kpis.totalRevenue : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  }, [approvedRows, kpis.totalRevenue]);

  // Daily series
  const dailySeries = useMemo(() => {
    const map = new Map<string, { day: string; revenue: number; purchases: number }>();
    approvedRows.forEach(p => {
      const cur = map.get(p.purchase_date) || { day: p.purchase_date, revenue: 0, purchases: 0 };
      cur.revenue += p.revenue; cur.purchases += 1;
      map.set(p.purchase_date, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day))
      .map(d => ({ ...d, label: fmtDate(d.day), avgTicket: d.purchases ? d.revenue / d.purchases : 0 }));
  }, [approvedRows]);

  // Installments distribution
  const installmentDist = useMemo(() => {
    const map = new Map<number, number>();
    approvedRows.forEach(p => map.set(p.installments, (map.get(p.installments) || 0) + 1));
    return Array.from(map.entries()).map(([inst, count]) => ({ inst: `${inst}x`, count })).sort((a, b) => parseInt(a.inst) - parseInt(b.inst));
  }, [approvedRows]);

  // === Ads aggregates ===
  const adsTotals = useMemo(() => {
    const t = filteredAds.reduce((acc, a) => ({
      spent: acc.spent + a.amount_spent,
      impressions: acc.impressions + a.impressions,
      clicks: acc.clicks + a.link_clicks,
      lpv: acc.lpv + a.landing_page_views,
      checkouts: acc.checkouts + a.checkouts_initiated,
      purchases: acc.purchases + a.purchases,
    }), { spent: 0, impressions: 0, clicks: 0, lpv: 0, checkouts: 0, purchases: 0 });
    return {
      ...t,
      cpm: t.impressions ? (t.spent / t.impressions) * 1000 : 0,
      cpc: t.clicks ? t.spent / t.clicks : 0,
      ctr: t.impressions ? t.clicks / t.impressions : 0,
      cpa: t.purchases ? t.spent / t.purchases : 0,
      checkoutConv: t.lpv ? t.checkouts / t.lpv : 0,
      purchaseConv: t.checkouts ? t.purchases / t.checkouts : 0,
    };
  }, [filteredAds]);

  const adsDaily = useMemo(() => {
    const map = new Map<string, { day: string; spent: number; purchases: number }>();
    filteredAds.forEach(a => {
      const cur = map.get(a.day) || { day: a.day, spent: 0, purchases: 0 };
      cur.spent += a.amount_spent; cur.purchases += a.purchases;
      map.set(a.day, cur);
    });
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day))
      .map(d => ({ ...d, label: fmtDate(d.day) }));
  }, [filteredAds]);

  const topCreatives = useMemo(() => {
    const map = new Map<string, { name: string; spent: number; purchases: number; impressions: number; clicks: number }>();
    filteredAds.forEach(a => {
      const k = a.ad_name || a.ad_set_name || '—';
      const cur = map.get(k) || { name: k, spent: 0, purchases: 0, impressions: 0, clicks: 0 };
      cur.spent += a.amount_spent; cur.purchases += a.purchases;
      cur.impressions += a.impressions; cur.clicks += a.link_clicks;
      map.set(k, cur);
    });
    return Array.from(map.values()).map(c => ({
      ...c,
      cpa: c.purchases ? c.spent / c.purchases : 0,
      ctr: c.impressions ? c.clicks / c.impressions : 0,
    })).sort((a, b) => b.spent - a.spent).slice(0, 10);
  }, [filteredAds]);

  // === KPIs aggregates ===
  const kpisDaily = useMemo(() => {
    return [...filteredKpis].sort((a, b) => a.day.localeCompare(b.day)).map(k => ({
      ...k, label: fmtDate(k.day),
    }));
  }, [filteredKpis]);

  const kpisTotals = useMemo(() => {
    const t = filteredKpis.reduce((acc, k) => ({
      gasto: acc.gasto + k.valor_gasto,
      vendas: acc.vendas + k.total_em_vendas,
      lucro: acc.lucro + k.lucro,
      qtd: acc.qtd + k.vendas_qtd,
      checkouts: acc.checkouts + k.num_checkout,
    }), { gasto: 0, vendas: 0, lucro: 0, qtd: 0, checkouts: 0 });
    return {
      ...t,
      roas: t.gasto ? t.vendas / t.gasto : 0,
      cpaReal: t.qtd ? t.gasto / t.qtd : 0,
      ticketMedio: t.qtd ? t.vendas / t.qtd : 0,
    };
  }, [filteredKpis]);

  // Insights
  const insights = useMemo(() => {
    const list: string[] = [];
    if (!filtered.length) return list;
    if (byProduct[0]) list.push(`Produto destaque: ${byProduct[0].product} (${fmt(byProduct[0].revenue)}).`);
    if (byPlatform[0]) list.push(`Plataforma com maior receita: ${byPlatform[0].platform} (${fmtPct(byPlatform[0].pct)} do total).`);
    list.push(`Ticket médio: ${fmt(kpis.avgTicket)} em ${fmtInt(kpis.approvedCount)} compras aprovadas.`);
    if (kpis.totalCount > kpis.approvedCount) list.push(`Taxa de aprovação: ${fmtPct(kpis.approvalRate)}.`);
    const originAgg = new Map<string, number>();
    approvedRows.forEach(p => originAgg.set(p.origin || '—', (originAgg.get(p.origin || '—') || 0) + 1));
    const topOrigin = Array.from(originAgg.entries()).sort((a, b) => b[1] - a[1])[0];
    if (topOrigin && topOrigin[0] !== '—') list.push(`Maior origem de compras: ${topOrigin[0]} (${topOrigin[1]} compras).`);
    return list;
  }, [filtered, approvedRows, byProduct, byPlatform, kpis]);

  // Sorted table
  const sortedTable = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av: any = a[sortKey]; const bv: any = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') return sortDir === 'asc' ? av - bv : bv - av;
      const as = String(av ?? ''); const bs = String(bv ?? '');
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (k: keyof Purchase) => {
    if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };

  const lastSync = settings?.last_synced_at ? new Date(settings.last_synced_at) : null;

  return (
    <div className="space-y-4">
      {/* Date filters */}
      <div className="flex flex-wrap gap-2 items-center justify-end">
        <Select value={funnelFilter} onValueChange={setFunnelFilter}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Funil" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os funis</SelectItem>
            {funnelOptions.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setDateRange(undefined); }}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => { setYear(Number(v)); setDateRange(undefined); }}>
          <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
          <SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn('justify-start text-left font-normal min-w-[240px]', !dateRange?.from && 'text-muted-foreground')}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange.to ? <>{format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })} — {format(dateRange.to, 'dd/MM/yyyy', { locale: ptBR })}</>
                : format(dateRange.from, 'dd/MM/yyyy', { locale: ptBR })
              ) : <span>Filtrar por período</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <DateRangePresets onSelect={setDateRange} />
            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} numberOfMonths={2} locale={ptBR}
              defaultMonth={dateRange?.from ?? new Date(year, month - 1, 1)} initialFocus className={cn('p-3 pointer-events-auto')} />
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
          title="Atualizar dados de Low Ticket DevClub"
          className="h-9 px-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Meta Ads × Hubla panel (product-filterable) */}
      <MetaAdsHublaPanel from={dateBoundaries.from} to={dateBoundaries.to} />




      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="glass-surface border-primary/10 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Receita por Dia</CardTitle></CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Bar dataKey="revenue" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Compras por Dia</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmtInt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="purchases" stroke={chartColor(1)} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-surface border-primary/10">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Ticket Médio ao Longo do Tempo</CardTitle></CardHeader>
          <CardContent className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailySeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                <Line type="monotone" dataKey="avgTicket" stroke="var(--primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

      </div>

      {/* === Tráfego & Criativos === */}
      {filteredAds.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Tráfego & Criativos</h3>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: 'Investido (Ads)', value: fmt(adsTotals.spent) },
              { label: 'Impressões', value: fmtInt(adsTotals.impressions) },
              { label: 'Cliques', value: fmtInt(adsTotals.clicks) },
              { label: 'CTR', value: fmtPct(adsTotals.ctr) },
              { label: 'CPC', value: fmt(adsTotals.cpc) },
              { label: 'CPA', value: fmt(adsTotals.cpa) },
              { label: 'Compras (Ads)', value: fmtInt(adsTotals.purchases) },
            ].map(k => (
              <Card key={k.label} className="glass-surface border-primary/10">
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="text-lg font-bold mt-1">{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-surface border-primary/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Gasto vs Compras (diário)</CardTitle></CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={adsDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis yAxisId="l" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="l" dataKey="spent" fill="var(--primary)" name="Gasto" radius={[4,4,0,0]} />
                    <Bar yAxisId="r" dataKey="purchases" fill={chartColor(1)} name="Compras" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-surface border-primary/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Top Criativos por Gasto</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Criativo</TableHead>
                      <TableHead className="text-right">Gasto</TableHead>
                      <TableHead className="text-right">Compras</TableHead>
                      <TableHead className="text-right">CPA</TableHead>
                      <TableHead className="text-right">CTR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topCreatives.map(c => (
                      <TableRow key={c.name}>
                        <TableCell className="font-medium truncate max-w-[200px]">{c.name}</TableCell>
                        <TableCell className="text-right">{fmt(c.spent)}</TableCell>
                        <TableCell className="text-right">{fmtInt(c.purchases)}</TableCell>
                        <TableCell className="text-right">{c.purchases ? fmt(c.cpa) : '—'}</TableCell>
                        <TableCell className="text-right">{fmtPct(c.ctr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* === KPIs Diários consolidados === */}
      {filteredKpis.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">KPIs Diários (consolidados)</h3>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Gasto', value: fmt(kpisTotals.gasto) },
              { label: 'Total em Vendas', value: fmt(kpisTotals.vendas) },
              { label: 'Lucro', value: fmt(kpisTotals.lucro) },
              { label: 'ROAS', value: `${kpisTotals.roas.toFixed(2)}x` },
              { label: 'CPA Real', value: fmt(kpisTotals.cpaReal) },
              { label: 'Ticket Médio', value: fmt(kpisTotals.ticketMedio) },
            ].map(k => (
              <Card key={k.label} className="glass-surface border-primary/10">
                <CardContent className="p-3">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className="text-lg font-bold mt-1">{k.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="glass-surface border-primary/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">ROAS por Dia</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={kpisDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)}x`} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                    <Line type="monotone" dataKey="roas" stroke="var(--primary)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-surface border-primary/10">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Lucro vs Gasto (diário)</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpisDaily}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="valor_gasto" fill={chartColor(1)} name="Gasto" radius={[4,4,0,0]} />
                    <Bar dataKey="lucro" fill="var(--primary)" name="Lucro" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <Card className="glass-surface border-primary/10">
            <CardHeader className="pb-2"><CardTitle className="text-sm">KPIs por Dia</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Gasto</TableHead>
                    <TableHead className="text-right">Vendas</TableHead>
                    <TableHead className="text-right">Qtd</TableHead>
                    <TableHead className="text-right">CPA Real</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
                    <TableHead className="text-right">CTR</TableHead>
                    <TableHead className="text-right">Lucro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kpisDaily.slice().reverse().slice(0, 60).map((k, i) => (
                    <TableRow key={k.id || i}>
                      <TableCell>{fmtDate(k.day)}</TableCell>
                      <TableCell className="text-right">{fmt(k.valor_gasto)}</TableCell>
                      <TableCell className="text-right">{fmt(k.total_em_vendas)}</TableCell>
                      <TableCell className="text-right">{fmtInt(k.vendas_qtd)}</TableCell>
                      <TableCell className="text-right">{fmt(k.cpa_real)}</TableCell>
                      <TableCell className="text-right">{k.roas.toFixed(2)}x</TableCell>
                      <TableCell className="text-right">{fmtPct(k.ctr)}</TableCell>
                      <TableCell className="text-right">{fmt(k.lucro)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}


      <MetaFunnelCard from={dateBoundaries.from} to={dateBoundaries.to} salesCount={approvedRows.length} />


    </div>
  );
}
