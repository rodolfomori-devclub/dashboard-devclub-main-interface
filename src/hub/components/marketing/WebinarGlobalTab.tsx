import { fetchAllRows, HISTORY_STALE_TIME } from '@/lib/fetchAllRows';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, RefreshCw, CalendarIcon, Trash2, Sparkles, Link2, CheckCircle2, AlertTriangle, Pencil } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import type { DateRange } from 'react-day-picker';
import * as XLSX from 'xlsx';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';
import { chartColor } from '@/lib/chartPalette';

// ---------- helpers ----------
const fmtBRL = (v: number) => (isFinite(v) ? v : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (v: number) => Math.round(isFinite(v) ? v : 0).toLocaleString('pt-BR');
const fmtPct = (v: number) => (isFinite(v) ? `${(v * 100).toFixed(1)}%` : '0%');
const parseLocalDate = (iso: string) => {
  if (!iso) return new Date();
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
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
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
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

interface Debriefing {
  id: string;
  week_label: string;
  webinar_date: string;
  capture_from: string | null;
  capture_to: string | null;
  investment: number;
  leads: number;
  whatsapp_leads: number;
  cpl: number;
  mqls: number;
  cost_per_mql: number;
  mql_rate: number;
  live_attendees: number;
  applications: number;
  is_replay?: boolean;
  replay_of_id?: string | null;
}

interface MetricRow {
  id?: string;
  source_sheet: string;
  day: string | null;
  metric_key: string;
  metric_value: number;
  raw?: any;
}

// ---------- LinkedIn Ads BRL helpers (mirrors LinkedInAdsTab BRL config) ----------
const LKD_BRL_CAMPAIGN_GROUP = 'BOOTCAMP_GRATUITO_GLOBAL';
const LKD_BRL_MQL_COL = 5; // column F on leads sheet
const LKD_BRL_MQL_VALUES = ['sim'];

const parseBrNumber = (v: string | undefined | null): number => {
  if (v == null || v === '') return 0;
  const s = String(v).trim().replace(/[^\d,.-]/g, '');
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = parseFloat(normalized);
  return isNaN(n) ? 0 : n;
};
const parseLkdIsoDate = (s: string): string | null => {
  if (!s) return null;
  const t = String(s).trim();
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return null;
};
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface LkdAutofill {
  investment: number;
  leads: number;
  cpl: number;
  mqls: number;
  costPerMql: number;
  mqlRate: number;
}

function computeLkdBrlAutofill(sheets: any, from: string, to: string): LkdAutofill {
  const costRows: string[][] = sheets?.costBRL || [];
  const leadRows: string[][] = sheets?.leadsBRL || [];
  const investment = costRows.reduce((sum, r) => {
    const date = parseLkdIsoDate(r[1]);
    const group = (r[2] || '').trim();
    if (!date) return sum;
    if (group !== LKD_BRL_CAMPAIGN_GROUP) return sum;
    if (date < from || date > to) return sum;
    return sum + parseBrNumber(r[3]);
  }, 0);
  const leadsFiltered = leadRows.filter((r) => {
    const date = parseLkdIsoDate(r[0]);
    return date && date >= from && date <= to;
  });
  const leads = leadsFiltered.length;
  const mqls = leadsFiltered.filter((r) => {
    const v = (r[LKD_BRL_MQL_COL] || '').trim().toLowerCase();
    return LKD_BRL_MQL_VALUES.includes(v);
  }).length;
  return {
    investment,
    leads,
    cpl: leads > 0 ? investment / leads : 0,
    mqls,
    costPerMql: mqls > 0 ? investment / mqls : 0,
    mqlRate: leads > 0 ? mqls / leads : 0,
  };
}

// ---------- Debriefing dialog ----------
function DebriefingDialog({
  open, onOpenChange, onSaved, editing, liveDebriefings,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
  editing?: Debriefing | null;
  liveDebriefings: Debriefing[];
}) {
  const [webinarDate, setWebinarDate] = useState<Date | undefined>(new Date());
  const [captureRange, setCaptureRange] = useState<DateRange | undefined>(undefined);
  const [whatsapp, setWhatsapp] = useState('');
  const [live, setLive] = useState('');
  const [applications, setApplications] = useState('');
  const [saving, setSaving] = useState(false);
  const [autofill, setAutofill] = useState<LkdAutofill | null>(null);
  const [loadingAutofill, setLoadingAutofill] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [modelo, setModelo] = useState<'live' | 'replay'>('live');
  const [replayOfId, setReplayOfId] = useState<string>('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setWebinarDate(parseLocalDate(editing.webinar_date));
      setCaptureRange(
        editing.capture_from && editing.capture_to
          ? { from: parseLocalDate(editing.capture_from), to: parseLocalDate(editing.capture_to) }
          : undefined,
      );
      setWhatsapp(String(editing.whatsapp_leads ?? ''));
      setLive(String(editing.live_attendees ?? ''));
      setApplications(String(editing.applications ?? ''));
      setModelo(editing.is_replay ? 'replay' : 'live');
      setReplayOfId(editing.replay_of_id || '');
      setAutofill(
        editing.is_replay
          ? null
          : {
              investment: editing.investment || 0,
              leads: editing.leads || 0,
              cpl: editing.cpl || 0,
              mqls: editing.mqls || 0,
              costPerMql: editing.cost_per_mql || 0,
              mqlRate: editing.mql_rate || 0,
            },
      );
      setAutofillError(null);
    } else {
      setWebinarDate(new Date()); setCaptureRange(undefined);
      setWhatsapp(''); setLive(''); setApplications('');
      setAutofill(null); setAutofillError(null);
      setModelo('live'); setReplayOfId('');
    }
  }, [open, editing]);

  // Fetch LinkedIn Ads BRL data whenever the capture range is complete (only for live model)
  useEffect(() => {
    if (modelo !== 'live') { setAutofill(null); return; }
    const from = captureRange?.from;
    const to = captureRange?.to;
    if (!from || !to) { setAutofill(null); return; }
    let cancelled = false;
    (async () => {
      setLoadingAutofill(true);
      setAutofillError(null);
      try {
        const { data, error } = await supabase.functions.invoke('linkedin-ads-sheets');
        if (error) throw new Error(error.message);
        if ((data as any)?.error) throw new Error((data as any).error);
        if (cancelled) return;
        const res = computeLkdBrlAutofill(data, toIso(from), toIso(to));
        setAutofill(res);
      } catch (e: any) {
        if (!cancelled) setAutofillError(e?.message || 'Erro ao carregar LinkedIn Ads');
      } finally {
        if (!cancelled) setLoadingAutofill(false);
      }
    })();
    return () => { cancelled = true; };
  }, [captureRange?.from, captureRange?.to, modelo]);

  const save = async () => {
    if (!webinarDate) { toast.error('Informe a data do webinar'); return; }
    if (modelo === 'live') {
      if (!captureRange?.from || !captureRange?.to) { toast.error('Selecione o período de captação'); return; }
      if (!autofill) { toast.error('Aguarde os dados do LinkedIn Ads carregarem'); return; }
    } else {
      if (!replayOfId) { toast.error('Selecione o webinar original do replay'); return; }
    }
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const autoLabel = modelo === 'replay'
      ? `Replay ${format(webinarDate, 'dd/MM', { locale: ptBR })}`
      : `Webinar ${format(webinarDate, 'dd/MM', { locale: ptBR })}`;
    const payload: Record<string, any> = {
      week_label: (editing?.week_label && editing.week_label.trim()) || autoLabel,
      webinar_date: toIso(webinarDate),
      whatsapp_leads: Math.round(num(whatsapp)),
      live_attendees: Math.round(num(live)),
      applications: Math.round(num(applications)),
      is_replay: modelo === 'replay',
      replay_of_id: modelo === 'replay' ? replayOfId : null,
    };
    if (modelo === 'live') {
      payload.capture_from = toIso(captureRange!.from!);
      payload.capture_to = toIso(captureRange!.to!);
      payload.investment = autofill!.investment;
      payload.leads = Math.round(autofill!.leads);
      payload.cpl = autofill!.cpl;
      payload.mqls = Math.round(autofill!.mqls);
      payload.cost_per_mql = autofill!.costPerMql;
      payload.mql_rate = autofill!.mqlRate;
    } else {
      payload.capture_from = null;
      payload.capture_to = null;
      payload.investment = 0;
      payload.leads = 0;
      payload.cpl = 0;
      payload.mqls = 0;
      payload.cost_per_mql = 0;
      payload.mql_rate = 0;
    }
    let error;
    if (editing?.id) {
      ({ error } = await (supabase as any).from('webinar_global_debriefings').update(payload).eq('id', editing.id));
    } else {
      payload.created_by = userRes?.user?.id ?? null;
      ({ error } = await (supabase as any).from('webinar_global_debriefings').insert(payload));
    }
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? 'Debriefing atualizado' : 'Debriefing salvo');
    onOpenChange(false);
    onSaved();
  };

  const rangeLabel = captureRange?.from && captureRange?.to
    ? `${format(captureRange.from, 'dd/MM/yyyy', { locale: ptBR })} → ${format(captureRange.to, 'dd/MM/yyyy', { locale: ptBR })}`
    : captureRange?.from
      ? `${format(captureRange.from, 'dd/MM/yyyy', { locale: ptBR })} → …`
      : 'Selecionar período';

  const replayOptions = liveDebriefings.filter(d => !d.is_replay && d.id !== editing?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Debriefing' : 'Novo Debriefing de Webinar'}</DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {modelo === 'live'
              ? 'Investimento, leads, CPL e MQL são puxados automaticamente do LinkedIn Ads (Workshop Global BRL) para o período de captação selecionado.'
              : 'No modelo Replay o investimento é atribuído ao webinar original — informe apenas presença ao vivo e aplicações.'}
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Data do Webinar</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('justify-start text-left font-normal w-full', !webinarDate && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {webinarDate ? format(webinarDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Selecionar'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={webinarDate} onSelect={setWebinarDate} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-1.5">
            <Label>Modelo do Webinar</Label>
            <Select value={modelo} onValueChange={(v) => setModelo(v as 'live' | 'replay')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="live">Ao Vivo</SelectItem>
                <SelectItem value="replay">Replay</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {modelo === 'replay' && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Replay de qual webinar</Label>
              <Select value={replayOfId} onValueChange={setReplayOfId}>
                <SelectTrigger><SelectValue placeholder="Selecionar webinar original" /></SelectTrigger>
                <SelectContent>
                  {replayOptions.length === 0 && (
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum webinar ao vivo cadastrado</div>
                  )}
                  {replayOptions.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.week_label || 'Webinar'} — {format(parseLocalDate(d.webinar_date), 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">O investimento do webinar original será compartilhado com este replay nos relatórios agregados.</p>
            </div>
          )}

          {modelo === 'live' && (
            <>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Período de Captação (LinkedIn Ads BRL)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('justify-start text-left font-normal w-full', !captureRange?.from && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {rangeLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="range" selected={captureRange} onSelect={setCaptureRange} numberOfMonths={2} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Auto-filled block */}
              <div className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Dados do LinkedIn Ads — Workshop Global BRL
                  {loadingAutofill && <span className="text-primary">carregando…</span>}
                </div>
                {autofillError && <p className="text-xs text-error">{autofillError}</p>}
                {!captureRange?.from || !captureRange?.to ? (
                  <p className="text-xs text-muted-foreground">Selecione o período de captação para carregar os dados.</p>
                ) : autofill ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                    <div><span className="text-muted-foreground text-xs block">Investimento</span><span className="font-semibold">{fmtBRL(autofill.investment)}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Leads</span><span className="font-semibold">{fmtInt(autofill.leads)}</span></div>
                    <div><span className="text-muted-foreground text-xs block">CPL</span><span className="font-semibold">{autofill.leads ? fmtBRL(autofill.cpl) : '—'}</span></div>
                    <div><span className="text-muted-foreground text-xs block">MQL</span><span className="font-semibold">{fmtInt(autofill.mqls)}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Custo por MQL</span><span className="font-semibold">{autofill.mqls ? fmtBRL(autofill.costPerMql) : '—'}</span></div>
                    <div><span className="text-muted-foreground text-xs block">Taxa de MQL</span><span className="font-semibold">{fmtPct(autofill.mqlRate)}</span></div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label>Leads do Grupo WhatsApp</Label>
                <Input inputMode="numeric" placeholder="320" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Pico ao Vivo</Label>
            <Input inputMode="numeric" placeholder="120" value={live} onChange={(e) => setLive(e.target.value)} />
          </div>
          <div className={cn('space-y-1.5', modelo === 'replay' ? 'sm:col-span-1' : 'sm:col-span-2')}>
            <Label>Aplicações</Label>
            <Input inputMode="numeric" placeholder="35" value={applications} onChange={(e) => setApplications(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || (modelo === 'live' && (loadingAutofill || !autofill))}>
            {saving ? 'Salvando…' : (editing ? 'Atualizar' : 'Salvar Debriefing')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="glass-surface border-primary/10">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ---------- Sheet parser (flexible) ----------
const METRIC_ALIASES: Record<string, string> = {
  'investment': 'investment', 'investimento': 'investment', 'valor gasto': 'investment', 'spend': 'investment', 'amount spent': 'investment',
  'leads': 'leads', 'nº leads': 'leads', 'n leads': 'leads',
  'cpl': 'cpl', 'custo por lead': 'cpl',
  'mqls': 'mqls', 'mql': 'mqls',
  'applications': 'applications', 'aplicações': 'applications', 'aplicacoes': 'applications', 'inscrições': 'applications',
  'webinar registrations': 'webinar_registrations', 'inscritos webinar': 'webinar_registrations', 'registrations': 'webinar_registrations',
  'whatsapp leads': 'whatsapp_leads', 'leads whatsapp': 'whatsapp_leads', 'grupo whatsapp': 'whatsapp_leads',
  'live attendees': 'live_attendees', 'presentes ao vivo': 'live_attendees', 'ao vivo': 'live_attendees',
};
const METRIC_LABEL: Record<string, string> = {
  investment: 'Investimento', leads: 'Leads', cpl: 'CPL', mqls: 'MQLs',
  applications: 'Aplicações', webinar_registrations: 'Inscritos Webinar',
  whatsapp_leads: 'Leads WhatsApp', live_attendees: 'Presentes ao Vivo',
};

function parseSheetToMetrics(rows: any[], sheetName: string): MetricRow[] {
  if (!rows.length) return [];
  const out: MetricRow[] = [];
  const headers = Object.keys(rows[0]);
  const dateHeader = headers.find(h => /^(data|date|dia|day)$/i.test(normalizeKey(h)));
  const metricCols: Array<{ header: string; key: string }> = [];
  for (const h of headers) {
    const nk = normalizeKey(h);
    const key = METRIC_ALIASES[nk];
    if (key) metricCols.push({ header: h, key });
  }
  if (!metricCols.length) return [];
  for (const r of rows) {
    const day = dateHeader ? parseDate(r[dateHeader]) : '';
    for (const c of metricCols) {
      const v = num(r[c.header]);
      if (!v && v !== 0) continue;
      out.push({
        source_sheet: sheetName,
        day: day || null,
        metric_key: c.key,
        metric_value: v,
        raw: { row: r },
      });
    }
  }
  return out;
}

// ---------- Main component ----------
export default function WebinarGlobalTab() {
  const qc = useQueryClient();
  const { isManager, isMarketing, canSwitchView } = useAuth();
  const canEdit = isManager || isMarketing || canSwitchView;
  const [openDialog, setOpenDialog] = useState(false);
  const [editingDebriefing, setEditingDebriefing] = useState<Debriefing | null>(null);
  const [sheetUrl, setSheetUrl] = useState('');
  const [urlLoaded, setUrlLoaded] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: debriefings = [], refetch: refetchDebriefings } = useQuery({
    queryKey: ['webinar_global_debriefings'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('webinar_global_debriefings').select('*').order('webinar_date', { ascending: false });
      if (error) throw error;
      return (data || []) as Debriefing[];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['webinar_global_settings'],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('webinar_global_settings').select('*')
        .order('updated_at', { ascending: false }).limit(1).maybeSingle();
      if (data && !urlLoaded) { setSheetUrl(data.sheet_url || ''); setUrlLoaded(true); }
      return data;
    },
    refetchInterval: 30_000,
  });

  const { data: metrics = [] } = useQuery({
    queryKey: ['webinar_global_metrics'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('webinar_global_metrics').select('*').order('day', { ascending: false }).limit(5000);
      if (error) throw error;
      return (data || []) as MetricRow[];
    },
  });

  // Workshop Global sales (origin = "Workshop Global")
  const { data: webinarSales = [] } = useQuery({
    queryKey: ['webinar_global_sales'],
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      return fetchAllRows<any>(() => (supabase as any)
        .from('sales')
        .select('id,amount,total_sale_value,date,product,origin,note,utm', { count: 'exact' })
        .ilike('origin', '%workshop global%'));
    },
  });

  // Webinar-sourced meetings (source or funnel entry mentions "webin")
  const { data: webinarMeetings = [] } = useQuery({
    queryKey: ['webinar_global_meetings'],
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      return fetchAllRows<any>(() => (supabase as any)
        .from('meetings')
        .select('id,scheduled_at,meeting_date,source,funnel_entry,status', { count: 'exact' })
        .or('source.ilike.%webin%,funnel_entry.ilike.%webin%'));
    },
  });

  const updateSettings = async (patch: Record<string, any>) => {
    if (!settings?.id) {
      await (supabase as any).from('webinar_global_settings').insert({ ...patch });
    } else {
      await (supabase as any).from('webinar_global_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', settings.id);
    }
    qc.invalidateQueries({ queryKey: ['webinar_global_settings'] });
  };

  const importMutation = useMutation({
    mutationFn: async (rows: MetricRow[]) => {
      const NIL = '00000000-0000-0000-0000-000000000000';
      await (supabase as any).from('webinar_global_metrics').delete().neq('id', NIL);
      if (rows.length) {
        const { error } = await (supabase as any).from('webinar_global_metrics').insert(rows);
        if (error) throw error;
      }
      return rows;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webinar_global_metrics'] }),
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

      const all: MetricRow[] = [];
      for (const name of wb.SheetNames) {
        const ws = wb.Sheets[name];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' }) as any[];
        if (!rows.length) continue;
        const parsed = parseSheetToMetrics(rows, name);
        all.push(...parsed);
      }
      if (!all.length) throw new Error('Nenhuma métrica reconhecida nas abas.');

      await importMutation.mutateAsync(all);
      const msg = `Sync OK — ${all.length} métricas`;
      if (!opts?.silent) toast.success(msg);
      await updateSettings({
        sheet_url: raw,
        last_synced_at: new Date().toISOString(),
        last_status: msg,
        last_row_count: all.length,
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
  }, [sheetUrl, importMutation, settings?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const url = (settings?.sheet_url || '').trim();
    if (!url) return;
    const id = setInterval(() => { syncSheet({ silent: true, urlOverride: url }); }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [settings?.sheet_url, syncSheet]);

  // ---------- Month filter ----------
  const activeRange = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const start = new Date(y, (m || 1) - 1, 1);
    const end = new Date(y, m || 1, 0); // last day of month
    return {
      from: format(start, 'yyyy-MM-dd'),
      to: format(end, 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  const filteredDebriefings = useMemo(
    () => debriefings.filter(d => d.webinar_date >= activeRange.from && d.webinar_date <= activeRange.to),
    [debriefings, activeRange],
  );

  // Build month options: every month from earliest debriefing (or 12 months back) to current month
  const monthOptions = useMemo(() => {
    const now = new Date();
    const earliest = debriefings.length
      ? debriefings.reduce((min, d) => d.webinar_date < min ? d.webinar_date : min, debriefings[0].webinar_date)
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const [ey, em] = earliest.split('-').map(Number);
    const start = new Date(Math.min(ey, now.getFullYear() - 1), (em || 1) - 1, 1);
    const opts: { value: string; label: string }[] = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    // include 6 future months as well so user can pre-create
    const last = new Date(now.getFullYear(), now.getMonth() + 6, 1);
    while (cursor <= last) {
      const v = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      opts.push({ value: v, label: format(cursor, "MMMM 'de' yyyy", { locale: ptBR }) });
      cursor.setMonth(cursor.getMonth() + 1);
    }
    return opts.reverse(); // most recent first
  }, [debriefings]);

  // ---------- KPI aggregates ----------
  const agg = useMemo(() => {
    const inv = filteredDebriefings.reduce((s, d) => s + (d.investment || 0), 0);
    const leads = filteredDebriefings.reduce((s, d) => s + (d.leads || 0), 0);
    const wa = filteredDebriefings.reduce((s, d) => s + (d.whatsapp_leads || 0), 0);
    const live = filteredDebriefings.reduce((s, d) => s + (d.live_attendees || 0), 0);
    const apps = filteredDebriefings.reduce((s, d) => s + (d.applications || 0), 0);
    const mqls = filteredDebriefings.reduce((s, d) => s + (d.mqls || 0), 0);

    // Commercial layer
    const salesInRange = (webinarSales || []).filter((s: any) => {
      const d = (s.date || '').slice(0, 10);
      return d >= activeRange.from && d <= activeRange.to;
    });
    const meetingsInRange = (webinarMeetings || []).filter((m: any) => {
      const d = (m.scheduled_at || m.meeting_date || '').slice(0, 10);
      return d >= activeRange.from && d <= activeRange.to;
    });
    const revenue = salesInRange.reduce((s: number, x: any) => s + (Number(x.total_sale_value) || Number(x.amount) || 0), 0);
    const meetingsBooked = meetingsInRange.length;
    const salesCount = salesInRange.length;
    const convMeeting = meetingsBooked > 0 ? salesCount / meetingsBooked : 0;
    const convList = leads > 0 ? salesCount / leads : 0;
    const roas = inv > 0 ? revenue / inv : 0;

    return {
      investment: inv,
      leads,
      mqls,
      costPerMql: mqls > 0 ? inv / mqls : 0,
      mqlRate: leads > 0 ? mqls / leads : 0,
      whatsapp: wa,
      live,
      applications: apps,
      avgCpl: leads > 0 ? inv / leads : 0,
      whatsappRate: leads > 0 ? wa / leads : 0,
      liveRate: leads > 0 ? live / leads : 0,
      appRate: leads > 0 ? apps / leads : 0,
      appLiveRate: live > 0 ? apps / live : 0,
      revenue,
      meetingsBooked,
      salesCount,
      convMeeting,
      convList,
      roas,
    };
  }, [filteredDebriefings, webinarSales, webinarMeetings, activeRange]);

  const sortedAsc = useMemo(
    () => [...filteredDebriefings].sort((a, b) => a.webinar_date.localeCompare(b.webinar_date)),
    [filteredDebriefings],
  );

  // ---------- Executive insights ----------
  const insights = useMemo(() => {
    if (!filteredDebriefings.length) return null;
    const withRates = filteredDebriefings.map(d => ({
      ...d,
      liveRate: d.leads > 0 ? d.live_attendees / d.leads : 0,
      appRate: d.leads > 0 ? d.applications / d.leads : 0,
    }));
    const bestWeek = [...withRates].sort((a, b) => b.applications - a.applications)[0];
    const bestLive = [...withRates].sort((a, b) => b.liveRate - a.liveRate)[0];
    const lowestCpl = [...withRates].filter(d => d.cpl > 0).sort((a, b) => a.cpl - b.cpl)[0];
    const bestApp = [...withRates].sort((a, b) => b.appRate - a.appRate)[0];
    return { bestWeek, bestLive, lowestCpl, bestApp };
  }, [filteredDebriefings]);

  // ---------- Sheet dashboard aggregates ----------
  const sheetAgg = useMemo(() => {
    const byKey: Record<string, number> = {};
    for (const m of metrics) byKey[m.metric_key] = (byKey[m.metric_key] || 0) + (m.metric_value || 0);
    const byDay = new Map<string, Record<string, number>>();
    for (const m of metrics) {
      if (!m.day) continue;
      if (!byDay.has(m.day)) byDay.set(m.day, {});
      const r = byDay.get(m.day)!;
      r[m.metric_key] = (r[m.metric_key] || 0) + (m.metric_value || 0);
    }
    const series = Array.from(byDay.entries())
      .map(([day, vals]) => ({ day, ...vals }))
      .sort((a, b) => a.day.localeCompare(b.day));
    return { totals: byKey, series };
  }, [metrics]);

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este debriefing?')) return;
    const { error } = await (supabase as any).from('webinar_global_debriefings').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Removido');
    refetchDebriefings();
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Weekly Debriefings */}
      <Card className="glass-surface border-primary/10">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Debriefings Semanais de Webinar</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Registre o desempenho de cada webinar e acompanhe a evolução semana a semana.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px] capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(o => (
                  <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button onClick={() => { setEditingDebriefing(null); setOpenDialog(true); }} className="gap-2">
                <Plus className="h-4 w-4" /> Adicionar Debriefing
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Investimento Total" value={fmtBRL(agg.investment)} />
            <KpiCard label="Leads Totais" value={fmtInt(agg.leads)} />
            <KpiCard label="CPL Médio" value={fmtBRL(agg.avgCpl)} />
            <KpiCard label="MQL" value={fmtInt(agg.mqls)} hint={fmtPct(agg.mqlRate) + ' dos leads'} />
            <KpiCard label="Custo por MQL" value={agg.mqls > 0 ? fmtBRL(agg.costPerMql) : '—'} hint="Investimento ÷ MQL" />
            <KpiCard label="Taxa de MQL" value={fmtPct(agg.mqlRate)} hint="MQL ÷ Leads" />
            <KpiCard label="WhatsApp Totais" value={fmtInt(agg.whatsapp)} hint={fmtPct(agg.whatsappRate) + ' dos leads'} />
            <KpiCard label="Presentes ao Vivo" value={fmtInt(agg.live)} hint={fmtPct(agg.liveRate) + ' show-rate'} />
            <KpiCard label="Aplicações" value={fmtInt(agg.applications)} hint={fmtPct(agg.appRate) + ' / leads'} />
          </div>

          {/* Conversion metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KpiCard label="Taxa Grupo WhatsApp" value={fmtPct(agg.whatsappRate)} hint="WhatsApp ÷ Leads" />
            <KpiCard label="Taxa Presença ao Vivo" value={fmtPct(agg.liveRate)} hint="Ao Vivo ÷ Leads" />
            <KpiCard label="Taxa de Aplicação" value={fmtPct(agg.appRate)} hint="Aplicações ÷ Leads" />
            <KpiCard label="Aplicação dos Live" value={fmtPct(agg.appLiveRate)} hint="Aplicações ÷ Presentes" />
          </div>

          {/* Commercial results row — derived from Global sales tagged as webinar + webinar-sourced meetings */}
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Resultados Comerciais</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Faturamento" value={fmtBRL(agg.revenue)} hint="Vendas com origem Workshop Global" />
              <KpiCard label="Reuniões Agendadas" value={fmtInt(agg.meetingsBooked)} hint="Origem webinar" />
              <KpiCard label="Vendas" value={fmtInt(agg.salesCount)} hint="Qtd. de vendas" />
              <KpiCard label="Conversão Webinar→Venda" value={fmtPct(agg.convMeeting)} hint="Vendas ÷ Reuniões" />
              <KpiCard label="Conversão Geral da Lista" value={fmtPct(agg.convList)} hint="Vendas ÷ Leads" />
              <KpiCard label="ROAS" value={agg.roas > 0 ? `${agg.roas.toFixed(2)}x` : '—'} hint="Faturamento ÷ Investimento" />
            </div>
          </div>


          {/* Trend chart */}
          {sortedAsc.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="glass-surface border-primary/10">
                <CardHeader><CardTitle className="text-sm">Evolução de Leads, Live & Aplicações</CardTitle></CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sortedAsc}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="webinar_date" tickFormatter={(v) => format(parseLocalDate(v), 'dd/MM')} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)' }} />
                      <Legend />
                      <Line type="monotone" dataKey="leads" name="Leads" stroke="var(--primary)" strokeWidth={2} />
                      <Line type="monotone" dataKey="live_attendees" name="Ao Vivo" stroke={chartColor(3)} strokeWidth={2} />
                      <Line type="monotone" dataKey="applications" name="Aplicações" stroke="#34d399" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card className="glass-surface border-primary/10">
                <CardHeader><CardTitle className="text-sm">Investimento vs CPL por Webinar</CardTitle></CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={sortedAsc}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="webinar_date" tickFormatter={(v) => format(parseLocalDate(v), 'dd/MM')} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)' }} />
                      <Legend />
                      <Bar yAxisId="l" dataKey="investment" name="Investimento" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                      <Bar yAxisId="r" dataKey="cpl" name="CPL" fill="#fbbf24" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Insights */}
          {insights && (
            <Card className="glass-surface border-primary/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Resumo Executivo</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <KpiCard label="Melhor webinar (Aplicações)" value={format(parseLocalDate(insights.bestWeek.webinar_date), 'dd/MM/yyyy')} hint={`${fmtInt(insights.bestWeek.applications)} aplicações`} />
                <KpiCard label="Maior taxa de presença" value={format(parseLocalDate(insights.bestLive.webinar_date), 'dd/MM/yyyy')} hint={fmtPct(insights.bestLive.liveRate)} />
                <KpiCard label="Menor CPL" value={insights.lowestCpl ? format(parseLocalDate(insights.lowestCpl.webinar_date), 'dd/MM/yyyy') : '—'} hint={insights.lowestCpl ? fmtBRL(insights.lowestCpl.cpl) : '—'} />
                <KpiCard label="Maior taxa de aplicação" value={format(parseLocalDate(insights.bestApp.webinar_date), 'dd/MM/yyyy')} hint={fmtPct(insights.bestApp.appRate)} />
              </CardContent>
            </Card>
          )}

          {/* History table */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {canEdit && <TableHead className="w-[110px]">Ações</TableHead>}
                  <TableHead>Data</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead className="text-right">Invest.</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Leads WhatsApp</TableHead>
                  <TableHead className="text-right">Custo/Lead WhatsApp</TableHead>
                  <TableHead className="text-right">Ao Vivo</TableHead>
                  <TableHead className="text-right">Taxa Presença</TableHead>
                  <TableHead className="text-right">Aplicações</TableHead>
                  <TableHead className="text-right">Taxa Aplicação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDebriefings.length === 0 && (
                  <TableRow><TableCell colSpan={canEdit ? 13 : 12} className="text-center text-muted-foreground py-8">Nenhum debriefing registrado ainda.</TableCell></TableRow>
                )}
                {filteredDebriefings.map(d => {
                  const costPerWa = d.whatsapp_leads > 0 ? d.investment / d.whatsapp_leads : 0;
                  const liveRate = d.leads > 0 ? d.live_attendees / d.leads : 0;
                  const appRate = d.live_attendees > 0 ? d.applications / d.live_attendees : 0;
                  const originalReplay = d.is_replay
                    ? debriefings.find(x => x.id === d.replay_of_id)
                    : null;
                  return (
                  <TableRow key={d.id}>
                    {canEdit && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setEditingDebriefing(d); setOpenDialog(true); }}
                            className="h-8 px-2 gap-1"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(d.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-error"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="font-medium whitespace-nowrap">{format(parseLocalDate(d.webinar_date), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      {d.is_replay ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Replay{originalReplay ? ` de ${format(parseLocalDate(originalReplay.webinar_date), 'dd/MM')}` : ''}
                        </Badge>
                      ) : (
                        <Badge className="text-[10px]">Ao Vivo</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{fmtBRL(d.investment)}</TableCell>
                    <TableCell className="text-right">{fmtBRL(d.cpl)}</TableCell>
                    <TableCell className="text-right">{fmtInt(d.leads)}</TableCell>
                    <TableCell className="text-right">{fmtInt(d.whatsapp_leads)}</TableCell>
                    <TableCell className="text-right">{d.whatsapp_leads > 0 ? fmtBRL(costPerWa) : '—'}</TableCell>
                    <TableCell className="text-right">{fmtInt(d.live_attendees)}</TableCell>
                    <TableCell className="text-right">{d.leads > 0 ? fmtPct(liveRate) : '—'}</TableCell>
                    <TableCell className="text-right">{fmtInt(d.applications)}</TableCell>
                    <TableCell className="text-right">{d.live_attendees > 0 ? fmtPct(appRate) : '—'}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* SECTION 2 — Marketing Dashboard from Sheet */}
      <Card className="glass-surface border-primary/10">
        <CardHeader>
          <CardTitle className="text-lg">Dashboard de Marketing — Webinar Global</CardTitle>
          <p className="text-xs text-muted-foreground">Dados sincronizados a partir do Google Sheets. Reconhece automaticamente colunas como Investimento, Leads, CPL, MQLs, Aplicações, Inscritos Webinar e Leads WhatsApp.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(sheetAgg.totals).length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Conecte uma planilha abaixo para visualizar o dashboard.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {Object.entries(sheetAgg.totals).map(([k, v]) => (
                  <KpiCard
                    key={k}
                    label={METRIC_LABEL[k] || k}
                    value={k === 'investment' || k === 'cpl' ? fmtBRL(v) : fmtInt(v)}
                  />
                ))}
              </div>
              {sheetAgg.series.length > 0 && (
                <Card className="glass-surface border-primary/10">
                  <CardHeader><CardTitle className="text-sm">Evolução diária</CardTitle></CardHeader>
                  <CardContent className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={sheetAgg.series}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)' }} />
                        <Legend />
                        {['leads', 'applications', 'webinar_registrations', 'live_attendees', 'whatsapp_leads'].map((k, i) => (
                          sheetAgg.totals[k] ? (
                            <Line key={k} type="monotone" dataKey={k} name={METRIC_LABEL[k] || k}
                                  stroke={chartColor(i)} strokeWidth={2} dot={false} />
                          ) : null
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {canEdit && (
      <Card className="glass-surface border-primary/10">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Link2 className="h-4 w-4" /> Fonte de Dados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col md:flex-row gap-2">
            <Input
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="flex-1"
            />
            <Button onClick={() => syncSheet()} className="gap-2">
              <RefreshCw className="h-4 w-4" /> Sincronizar
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {settings?.last_synced_at ? (
              <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Última sync: {format(new Date(settings.last_synced_at), "dd/MM/yyyy HH:mm")}</span>
            ) : (
              <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Nunca sincronizado</span>
            )}
            {settings?.last_status && <span>• {settings.last_status}</span>}
            <span>• Sync automático a cada 10 minutos</span>
          </div>
          {settings?.last_error && <p className="text-xs text-error">{settings.last_error}</p>}
        </CardContent>
      </Card>
      )}

      <DebriefingDialog
        open={openDialog}
        onOpenChange={(o) => { setOpenDialog(o); if (!o) setEditingDebriefing(null); }}
        onSaved={() => { refetchDebriefings(); }}
        editing={editingDebriefing}
        liveDebriefings={debriefings}
      />
    </div>
  );
}
