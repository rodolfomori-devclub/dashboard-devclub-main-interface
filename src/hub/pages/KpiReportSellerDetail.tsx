import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProfiles, useDailyKpis } from '@/hooks/useSupabaseData';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricCard } from '@/components/MetricCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, Users, TrendingUp, Phone } from 'lucide-react';

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
function pct(num: number, den: number): string { if (den === 0) return '0,0%'; return (num / den * 100).toFixed(1).replace('.', ',') + '%'; }
function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }

export default function KpiReportSellerDetail() {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const { data: profiles = [] } = useProfiles();
  const { data: allKpis = [] } = useDailyKpis(sellerId);

  const seller = useMemo(() => profiles.find((u: any) => u.id === sellerId), [profiles, sellerId]);
  const isPreSales = seller?.role === 'pre-vendedor';
  const daysInPeriod = getDaysInMonth(year, month);

  const monthKpis = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    return allKpis.filter((k: any) => k.date.startsWith(prefix));
  }, [allKpis, year, month]);

  const kpiMap = useMemo(() => { const m = new Map<string, any>(); monthKpis.forEach((k: any) => m.set(k.date, k)); return m; }, [monthKpis]);

  const totals = useMemo(() => {
    const t = { leads: 0, leads_disqualified: 0, calls_scheduled: 0, calls_completed: 0, sales: 0, sales_scheduled: 0, follows: 0, rejections: 0 };
    monthKpis.forEach((k: any) => { t.leads += k.leads; t.leads_disqualified += k.leads_disqualified; t.calls_scheduled += k.calls_scheduled; t.calls_completed += k.calls_completed; t.sales += k.sales; t.sales_scheduled += k.sales_scheduled; t.follows += k.follows; t.rejections += k.rejections; });
    return t;
  }, [monthKpis]);

  const exportCsv = () => {
    const header = isPreSales
      ? 'data,ligacoes_atendidas,reunioes_marcadas,follows,forms_devclub,forms_global,vendas_diretas,vendas_assistidas\n'
      : 'data,leads,leads_desqualificados,calls_agendadas,calls_realizadas,vendas,vendas_agendadas,followups,rejeicoes\n';
    const rows = monthKpis.map((k: any) => isPreSales
      ? `${k.date},${k.calls_completed},${k.calls_scheduled},${k.follows},${k.leads},${k.leads_disqualified},${k.sales},${k.sales_scheduled}`
      : `${k.date},${k.leads},${k.leads_disqualified},${k.calls_scheduled},${k.calls_completed},${k.sales},${k.sales_scheduled},${k.follows},${k.rejections}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `kpis_${seller?.name || 'vendedor'}_${MONTHS[month]}_${year}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  if (!seller) return (<div className="p-6 text-center"><p className="text-muted-foreground">Vendedor não encontrado.</p><Button variant="outline" className="mt-4 border-border/50 hover:bg-accent/50" onClick={() => navigate('/kpi-report')}>Voltar</Button></div>);

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/kpi-report')} className="hover:bg-accent/50"><ArrowLeft className="h-4 w-4" /></Button>
        <div><h1 className="page-title">{seller.name}</h1><p className="text-sm text-muted-foreground">{seller.email}</p></div>
        <div className="ml-auto"><Button variant="outline" size="sm" onClick={exportCsv} className="border-border/50 hover:bg-accent/50"><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button></div>
      </div>
      <div className="flex gap-3">
        <Select value={String(year)} onValueChange={v => setYear(Number(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}</SelectContent></Select>
      </div>
      {isPreSales ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Ligações Atendidas" value={totals.calls_completed} icon={<Phone className="h-4 w-4" />} />
            <MetricCard label="Reuniões Marcadas" value={totals.calls_scheduled} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Vendas Diretas" value={totals.sales} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Vendas Assistidas" value={totals.sales_scheduled} />
          </div>
          <div className="p-4 rounded-lg glass-card">
            <h3 className="text-sm font-semibold mb-3">Indicadores</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground">Reuniões / Ligações</p><p className="text-lg font-semibold">{pct(totals.calls_scheduled, totals.calls_completed)}</p></div>
              <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-lg font-semibold">{pct(totals.sales, totals.calls_scheduled)}</p></div>
              <div><p className="text-xs text-muted-foreground">Total Forms</p><p className="text-lg font-semibold">{totals.leads + totals.leads_disqualified}</p></div>
              <div><p className="text-xs text-muted-foreground">Total Vendas</p><p className="text-lg font-semibold">{totals.sales + totals.sales_scheduled}</p></div>
            </div>
          </div>
          <Card className="glass-card border-border/50"><CardHeader><CardTitle className="text-base">Registros Diários - {MONTHS[month]} {year}</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-border/50"><TableHead>Data</TableHead><TableHead>Lig. Atendidas</TableHead><TableHead>Reuniões Marc.</TableHead><TableHead>Follows</TableHead><TableHead>Forms DevClub</TableHead><TableHead>Forms Global</TableHead><TableHead>Vendas Dir.</TableHead><TableHead>Vendas Assist.</TableHead></TableRow></TableHeader>
              <TableBody>{Array.from({ length: daysInPeriod }, (_, i) => {
                const d = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const kpi = kpiMap.get(dateStr);
                const hasRecord = !!kpi;
                const hasActivity = kpi && (kpi.calls_completed > 0 || kpi.calls_scheduled > 0 || kpi.follows > 0 || kpi.leads > 0 || kpi.sales > 0 || kpi.sales_scheduled > 0);
                const rowClass = !hasRecord ? 'bg-destructive/10' : !hasActivity ? 'bg-warning/10' : '';
                return (<TableRow key={d} className={`${rowClass} border-border/20`}><TableCell className="font-medium">{String(d).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}{!hasRecord && <span className="ml-2 text-xs text-error">Sem registro</span>}{hasRecord && !hasActivity && <span className="ml-2 text-xs text-warning">Zero atividade</span>}</TableCell><TableCell>{kpi?.calls_completed ?? '-'}</TableCell><TableCell>{kpi?.calls_scheduled ?? '-'}</TableCell><TableCell>{kpi?.follows ?? '-'}</TableCell><TableCell>{kpi?.leads ?? '-'}</TableCell><TableCell>{kpi?.leads_disqualified ?? '-'}</TableCell><TableCell className="font-semibold">{kpi?.sales ?? '-'}</TableCell><TableCell>{kpi?.sales_scheduled ?? '-'}</TableCell></TableRow>);
              })}</TableBody></Table></div>
          </CardContent></Card>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard label="Total Leads" value={totals.leads} icon={<Users className="h-4 w-4" />} />
            <MetricCard label="Total Calls" value={totals.calls_completed} icon={<Phone className="h-4 w-4" />} />
            <MetricCard label="Total Vendas" value={totals.sales} icon={<TrendingUp className="h-4 w-4" />} />
            <MetricCard label="Follow-ups" value={totals.follows} />
          </div>
          <div className="p-4 rounded-lg glass-card">
            <h3 className="text-sm font-semibold mb-3">Indicadores</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div><p className="text-xs text-muted-foreground">Taxa de Qualificação</p><p className="text-lg font-semibold">{pct(totals.leads - totals.leads_disqualified, totals.leads)}</p></div>
              <div><p className="text-xs text-muted-foreground">Taxa de Comparecimento</p><p className="text-lg font-semibold">{pct(totals.calls_completed, totals.calls_scheduled)}</p></div>
              <div><p className="text-xs text-muted-foreground">Taxa de Conversão</p><p className="text-lg font-semibold">{pct(totals.sales, totals.calls_completed)}</p></div>
              <div><p className="text-xs text-muted-foreground">Taxa de Follow-up</p><p className="text-lg font-semibold">{pct(totals.follows, totals.leads)}</p></div>
              <div><p className="text-xs text-muted-foreground">Taxa de Rejeição</p><p className="text-lg font-semibold">{pct(totals.rejections, totals.leads)}</p></div>
            </div>
          </div>
          <Card className="glass-card border-border/50"><CardHeader><CardTitle className="text-base">Registros Diários - {MONTHS[month]} {year}</CardTitle></CardHeader><CardContent>
            <div className="overflow-x-auto"><Table><TableHeader><TableRow className="border-border/50"><TableHead>Data</TableHead><TableHead>Leads</TableHead><TableHead>Desqualif.</TableHead><TableHead>Calls Ag.</TableHead><TableHead>Calls Real.</TableHead><TableHead>Vendas</TableHead><TableHead>Vendas Ag.</TableHead><TableHead>Follow-ups</TableHead><TableHead>Rejeições</TableHead></TableRow></TableHeader>
              <TableBody>{Array.from({ length: daysInPeriod }, (_, i) => {
                const d = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const kpi = kpiMap.get(dateStr);
                const hasRecord = !!kpi;
                const hasActivity = kpi && (kpi.leads > 0 || kpi.calls_scheduled > 0 || kpi.calls_completed > 0 || kpi.sales > 0 || kpi.follows > 0 || kpi.rejections > 0);
                const rowClass = !hasRecord ? 'bg-destructive/10' : !hasActivity ? 'bg-warning/10' : '';
                return (<TableRow key={d} className={`${rowClass} border-border/20`}><TableCell className="font-medium">{String(d).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}{!hasRecord && <span className="ml-2 text-xs text-error">Sem registro</span>}{hasRecord && !hasActivity && <span className="ml-2 text-xs text-warning">Zero atividade</span>}</TableCell><TableCell>{kpi?.leads ?? '-'}</TableCell><TableCell>{kpi?.leads_disqualified ?? '-'}</TableCell><TableCell>{kpi?.calls_scheduled ?? '-'}</TableCell><TableCell>{kpi?.calls_completed ?? '-'}</TableCell><TableCell className="font-semibold">{kpi?.sales ?? '-'}</TableCell><TableCell>{kpi?.sales_scheduled ?? '-'}</TableCell><TableCell>{kpi?.follows ?? '-'}</TableCell><TableCell>{kpi?.rejections ?? '-'}</TableCell></TableRow>);
              })}</TableBody></Table></div>
          </CardContent></Card>
        </>
      )}
    </div>
  );
}
