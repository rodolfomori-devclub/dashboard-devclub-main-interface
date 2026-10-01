import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useDailyKpis, useUpsertDailyKpi } from '@/hooks/useSupabaseData';
import { useMeetings } from '@/hooks/useMeetings';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { SyncStatusChip, SyncState } from '@/components/SyncStatusBanner';
import { draftStore } from '@/lib/draftStore';
import { addPendingItem, removePendingItem } from '@/hooks/usePendingSync';
import { logActivity } from '@/lib/activityLogger';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CLOSER_KPI_FIELDS = [
  { key: 'leads', label: 'Leads recebidos pelo SDR' },
  { key: 'calls_completed', label: 'Calls Comparecidas' },
  { key: 'sales', label: 'Vendas' },
  { key: 'sales_scheduled', label: 'Vendas Agendadas' },
] as const;

const PRESALES_KPI_FIELDS = [
  { key: 'calls_scheduled', label: 'Reuniões Agendadas', auto: true },
  { key: 'calls_completed', label: 'Reuniões Comparecidas' },
  { key: 'sales_scheduled', label: 'Vendas Assistidas' },
] as const;

type KpiField = 'leads' | 'leads_disqualified' | 'calls_scheduled' | 'calls_completed' | 'sales' | 'sales_scheduled' | 'follows' | 'rejections';

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function pct(num: number, den: number) { if (den === 0) return '0,0%'; return (num / den * 100).toFixed(1).replace('.', ',') + '%'; }

export default function DailyKpis() {
  const { user } = useAuth();
  const isPreSales = user?.role === 'pre-vendedor';
  const KPI_FIELDS = isPreSales ? PRESALES_KPI_FIELDS : CLOSER_KPI_FIELDS;
  const [year, setYear] = useState(2026);
  const { data: allKpis = [] } = useDailyKpis(user?.id);
  const { data: meetings = [] } = useMeetings();
  const upsertKpi = useUpsertDailyKpi();
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [localEdits, setLocalEdits] = useState<Record<string, Record<string, number>>>({});
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({});

  // Load drafts from localStorage on mount
  useEffect(() => {
    if (!user) return;
    const draft = draftStore.load<Record<string, Record<string, number>>>(user.id, `kpis_${year}`);
    if (draft && !draft.synced && Object.keys(draft.data).length > 0) {
      setLocalEdits(prev => ({ ...draft.data, ...prev }));
      // Mark all loaded draft dates as draft state
      const states: Record<string, SyncState> = {};
      Object.keys(draft.data).forEach(dateStr => { states[dateStr] = 'draft'; });
      setSyncStates(prev => ({ ...states, ...prev }));
    }
  }, [user, year]);

  // Persist drafts to localStorage whenever localEdits change
  useEffect(() => {
    if (!user || Object.keys(localEdits).length === 0) return;
    draftStore.save(user.id, `kpis_${year}`, localEdits);
  }, [localEdits, user, year]);

  const getKpiMap = useMemo(() => {
    const map = new Map<string, any>();
    allKpis.forEach((k: any) => map.set(k.date, k));
    return map;
  }, [allKpis]);

  // Reuniões agendadas vêm automaticamente da aba de Agendamentos (data do agendamento)
  const scheduledByDate = useMemo(() => {
    const map = new Map<string, number>();
    if (!user || !isPreSales) return map;
    for (const m of meetings as any[]) {
      if (m.scheduled_by !== user.id || !m.scheduled_at) continue;
      const d = new Date(m.scheduled_at);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [meetings, user, isPreSales]);

  const getOrCreateKpi = useCallback((day: number, month: number) => {
    if (!user) throw new Error('No user');
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const auto = isPreSales ? { calls_scheduled: scheduledByDate.get(dateStr) || 0 } : {};
    const existing = getKpiMap.get(dateStr);
    if (existing) {
      const edits = localEdits[dateStr];
      return { ...(edits ? { ...existing, ...edits } : existing), ...auto };
    }
    const edits = localEdits[dateStr];
    return { seller_id: user.id, date: dateStr, leads: 0, leads_disqualified: 0, calls_scheduled: 0, calls_completed: 0, sales: 0, sales_scheduled: 0, follows: 0, rejections: 0, ...edits, ...auto };
  }, [user, year, getKpiMap, localEdits, isPreSales, scheduledByDate]);

  const performSave = useCallback((dateStr: string, sellerId: string, field: KpiField, num: number) => {
    const existing = getKpiMap.get(dateStr);
    const currentEdits = localEdits[dateStr] || {};
    const currentData = existing
      ? { ...existing, ...currentEdits }
      : { leads: 0, leads_disqualified: 0, calls_scheduled: 0, calls_completed: 0, sales: 0, sales_scheduled: 0, follows: 0, rejections: 0, ...currentEdits };
    const payload = { seller_id: sellerId, date: dateStr, ...currentData, [field]: num };

    setSyncStates(prev => ({ ...prev, [dateStr]: 'saving' }));

    upsertKpi.mutate(payload, {
      onSuccess: () => {
        const isNew = !existing;
        logActivity({ userId: sellerId, userName: user?.name || '', userRole: user?.role || '', action: isNew ? 'KPI_SUBMITTED' : 'KPI_UPDATED', details: `Data: ${dateStr}`, entityType: 'daily_kpi', entityId: dateStr });
        // Clear this date's local edits
        setLocalEdits(prev => {
          const updated = { ...prev };
          delete updated[dateStr];
          // Update localStorage
          if (user) {
            if (Object.keys(updated).length === 0) {
              draftStore.clear(user.id, `kpis_${year}`);
            } else {
              draftStore.save(user.id, `kpis_${year}`, updated);
            }
          }
          return updated;
        });
        setSyncStates(prev => ({ ...prev, [dateStr]: 'saved' }));
        removePendingItem(`kpi_${dateStr}`);
        // Auto-clear saved state after 3s
        setTimeout(() => setSyncStates(prev => {
          if (prev[dateStr] === 'saved') return { ...prev, [dateStr]: 'idle' };
          return prev;
        }), 3000);
      },
      onError: () => {
        setSyncStates(prev => ({ ...prev, [dateStr]: 'error' }));
        // Add to pending queue for retry
        addPendingItem({
          id: `kpi_${dateStr}`,
          label: `KPI ${dateStr}`,
          timestamp: Date.now(),
          retryFn: async () => {
            const { error } = await (await import('@/integrations/supabase/client')).supabase
              .from('daily_kpis').upsert(payload, { onConflict: 'seller_id,date' });
            if (error) throw error;
          },
        });
      },
    });
  }, [getKpiMap, localEdits, upsertKpi, user, year]);

  const handleChange = useCallback((dateStr: string, sellerId: string, field: KpiField, value: string) => {
    const num = Math.max(0, parseInt(value) || 0);
    setLocalEdits(prev => ({ ...prev, [dateStr]: { ...(prev[dateStr] || {}), [field]: num } }));
    const key = `${dateStr}-${field}`;
    if (debounceRef.current[key]) clearTimeout(debounceRef.current[key]);
    debounceRef.current[key] = setTimeout(() => performSave(dateStr, sellerId, field, num), 800);
  }, [performSave]);

  const getMonthTotals = useCallback((month: number) => {
    const days = getDaysInMonth(year, month);
    const totals: Record<KpiField, number> = { calls_completed: 0, calls_scheduled: 0, follows: 0, leads: 0, leads_disqualified: 0, sales: 0, sales_scheduled: 0, rejections: 0 };
    for (let d = 1; d <= days; d++) { const kpi = getOrCreateKpi(d, month); KPI_FIELDS.forEach(f => { totals[f.key] += kpi[f.key] || 0; }); }
    return totals;
  }, [year, getOrCreateKpi]);

  if (!user) return null;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">KPIs Diários</h1>
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
      </div>

      <Accordion type="single" collapsible className="space-y-2">
        {MONTHS.map((monthName, monthIdx) => {
          const days = getDaysInMonth(year, monthIdx);
          const totals = getMonthTotals(monthIdx);
          return (
            <AccordionItem key={monthIdx} value={String(monthIdx)} className="border border-border/50 rounded-xl glass-card px-4">
              <AccordionTrigger className="hover:no-underline"><span className="text-base font-medium">{monthName} {year}</span></AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead><tr className="border-b border-border/50"><th className="text-left py-2 px-2 font-medium text-muted-foreground w-16">Dia</th>{KPI_FIELDS.map(f => <th key={f.key} className="text-center py-2 px-1 font-medium text-muted-foreground min-w-[100px]">{f.label}</th>)}<th className="w-20"></th></tr></thead>
                    <tbody>
                      {Array.from({ length: days }, (_, i) => i + 1).map(day => {
                        const kpi = getOrCreateKpi(day, monthIdx);
                        const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const rowSync = syncStates[dateStr] || 'idle';
                        return (
                          <tr key={day} className={`border-b border-border/20 hover:bg-accent/15 ${rowSync === 'error' ? 'bg-destructive/5' : ''}`}>
                            <td className="py-1 px-2 text-muted-foreground font-medium">{day}</td>
                            {KPI_FIELDS.map(f => (
                              <td key={f.key} className="py-1 px-1">
                                {'auto' in f && (f as any).auto ? (
                                  <div className="h-8 flex items-center justify-center text-sm text-muted-foreground" title="Puxado automaticamente dos Agendamentos">{kpi[f.key] || 0}</div>
                                ) : (
                                  <Input type="number" min={0} value={kpi[f.key] || ''} placeholder="0" onChange={e => handleChange(dateStr, user.id, f.key, e.target.value)} className="h-8 text-center text-sm border-transparent bg-transparent hover:border-input focus:border-input [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                                )}
                              </td>
                            ))}
                            <td className="py-1 px-1"><SyncStatusChip state={rowSync} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot><tr className="border-t-2 border-border font-semibold bg-accent/20"><td className="py-2 px-2 text-foreground">Total</td>{KPI_FIELDS.map(f => <td key={f.key} className="py-2 px-1 text-center text-foreground">{totals[f.key]}</td>)}<td></td></tr></tfoot>
                  </table>
                </div>
                <div className="mt-4 p-4 rounded-lg bg-accent/15 border border-border/30">
                  <h3 className="text-sm font-semibold text-foreground mb-3">Indicadores de Performance</h3>
                  {isPreSales ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div><p className="text-xs text-muted-foreground">Total Reuniões Agendadas</p><p className="text-lg font-semibold text-foreground">{totals.calls_scheduled}</p></div>
                      <div><p className="text-xs text-muted-foreground">Taxa de Comparecimento</p><p className="text-lg font-semibold text-foreground">{pct(totals.calls_completed, totals.calls_scheduled)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-lg font-semibold text-foreground">{pct(totals.sales_scheduled, totals.calls_completed)}</p></div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div><p className="text-xs text-muted-foreground">Total de Leads</p><p className="text-lg font-semibold text-foreground">{totals.leads}</p></div>
                      <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-lg font-semibold text-foreground">{pct(totals.sales, totals.calls_completed)}</p></div>
                      <div><p className="text-xs text-muted-foreground">Taxa Lead → Venda</p><p className="text-lg font-semibold text-foreground">{pct(totals.sales, totals.leads)}</p></div>
                    </div>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
