import { fetchAllRows, HISTORY_STALE_TIME } from '@/lib/fetchAllRows';
import { useMemo, useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseLocalDate, getCashCollected } from '@/lib/utils';
import { calculateCommissions, type Seniority } from '@/lib/commissionCalculator';
import {
  Target, TrendingUp, DollarSign, Percent, ShoppingBag, BarChart3,
  Users, Zap, AlertTriangle, Award, CalendarDays, PieChart as PieIcon,
  Activity, CheckCircle2, ArrowUpRight, ArrowDownRight, Download, Loader2,
} from 'lucide-react';
import {
  ChartContainer, ChartConfig, ChartTooltip, ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
  PieChart, Pie, Tooltip,
} from 'recharts';
import { chartColor, TOOLTIP_STYLE } from '@/lib/chartPalette';

interface Props {
  month: number;
  year: number;
  sales: any[];
  profiles: any[];
  canSeeFinancial?: boolean;
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Cor de serie vem da paleta compartilhada (`chartColor`). A lista local
// misturava `--accent` / `--secondary`, que no DevClub sao tokens de
// SUPERFICIE (navy-3 / navy-4): as fatias 2 e 3 davam ~1.2:1 contra o card e
// desapareciam. Os hsl() crus eram do tema roxo antigo.

export function MonthlyReport({ month, year, sales, profiles, canSeeFinancial = true }: Props) {
  // Fetch KPIs, checklist, team settings, bonuses, income, commission reports
  const { data: kpis } = useQuery({
    queryKey: ['results-kpis', month, year],
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = month === 11
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 2).padStart(2, '0')}-01`;
      return fetchAllRows(() => supabase.from('daily_kpis').select('*', { count: 'exact' })
        .gte('date', startDate).lt('date', endDate));
    },
  });

  const { data: checklists } = useQuery({
    queryKey: ['results-checklist', month, year],
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const endDate = month === 11
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 2).padStart(2, '0')}-01`;
      return fetchAllRows(() => supabase.from('daily_checklist').select('*', { count: 'exact' })
        .gte('date', startDate).lt('date', endDate));
    },
  });

  const { data: teamSettings } = useQuery({
    queryKey: ['results-team-settings'],
    queryFn: async () => {
      const { data } = await supabase.from('team_settings').select('*').limit(1).single();
      return data;
    },
  });

  const { data: monthlyGoalData } = useQuery({
    queryKey: ['monthly-goal', month, year],
    queryFn: async () => {
      const { data } = await supabase.from('monthly_goals' as any).select('team_goal')
        .eq('month', month + 1).eq('year', year).maybeSingle();
      return data as unknown as { team_goal: number } | null;
    },
  });

  const { data: bonuses } = useQuery({
    queryKey: ['results-bonuses', month, year],
    enabled: canSeeFinancial,
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      return fetchAllRows(() => supabase.from('seller_bonuses').select('*', { count: 'exact' })
        .eq('month', month + 1).eq('year', year));
    },
  });

  const { data: incomes } = useQuery({
    queryKey: ['results-income', month, year],
    enabled: canSeeFinancial,
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      return fetchAllRows(() => supabase.from('monthly_income').select('*', { count: 'exact' })
        .eq('month', month + 1).eq('year', year));
    },
  });

  const { data: prevMonthSalesData } = useQuery({
    queryKey: ['results-prev-sales', month, year],
    staleTime: HISTORY_STALE_TIME,
    queryFn: async () => {
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const startDate = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-01`;
      const endDate = prevMonth === 11
        ? `${prevYear + 1}-01-01`
        : `${prevYear}-${String(prevMonth + 2).padStart(2, '0')}-01`;
      return fetchAllRows(() => supabase.from('sales').select('id, amount, date', { count: 'exact' })
        .gte('date', startDate).lt('date', endDate));
    },
  });

  const metrics = useMemo(() => {
    const monthSales = (sales || []).filter((s: any) => {
      const d = parseLocalDate(s.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const sellers = (profiles || []).filter((p: any) => p.role === 'vendedor' && p.active);
    // Use historical monthly goal if available, fallback to current team_settings
    const teamGoal = monthlyGoalData?.team_goal ?? teamSettings?.team_goal ?? 0;
    const totalRevenue = monthSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const salesCount = monthSales.length;
    const achievement = teamGoal > 0 ? (totalRevenue / teamGoal) * 100 : 0;

    // Days in month
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Working days approximation (exclude weekends)
    let workingDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const day = new Date(year, month, d).getDay();
      if (day !== 0 && day !== 6) workingDays++;
    }
    const expectedDailyPace = workingDays > 0 ? teamGoal / workingDays : 0;
    const actualDailyPace = workingDays > 0 ? totalRevenue / workingDays : 0;

    // Seller performance
    const sellerPerformance = sellers.map((p: any) => {
      const sellerSales = monthSales.filter((s: any) => s.seller_id === p.id);
      const revenue = sellerSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      const goal = p.individual_goal || 0;
      const expectedPace = workingDays > 0 ? goal / workingDays : 0;
      const actualPace = workingDays > 0 ? revenue / workingDays : 0;
      const achievementPct = goal > 0 ? (revenue / goal) * 100 : 0;

      // KPIs
      const sellerKpis = (kpis || []).filter((k: any) => k.seller_id === p.id);
      const totalCalls = sellerKpis.reduce((s: number, k: any) => s + (k.calls_completed || 0), 0);
      const totalLeads = sellerKpis.reduce((s: number, k: any) => s + (k.leads || 0), 0);
      const salesKpi = sellerKpis.reduce((s: number, k: any) => s + (k.sales || 0), 0);
      const conversion = totalLeads > 0 ? (salesKpi / totalLeads) * 100 : 0;
      const avgTicket = sellerSales.length > 0 ? revenue / sellerSales.length : 0;

      // Checklist
      const sellerChecklists = (checklists || []).filter((c: any) => c.seller_id === p.id);
      const CHECKLIST_TOTAL = 10; // expected tasks per day
      const checklistRate = sellerChecklists.length > 0
        ? sellerChecklists.reduce((sum: number, c: any) => sum + ((c.completed_tasks?.length || 0) / CHECKLIST_TOTAL) * 100, 0) / sellerChecklists.length
        : 0;

      // Commissions
      const commResult = calculateCommissions(sellerSales, 'junior' as Seniority);

      // Income & bonuses
      const sellerIncome = (incomes || []).find((i: any) => i.seller_id === p.id);
      const sellerBonuses = (bonuses || []).filter((b: any) => b.seller_id === p.id);
      const fixedSalary = sellerIncome?.fixed_salary || 0;
      const totalBonusAmount = sellerBonuses.reduce((s: number, b: any) => s + Number(b.amount), 0);

      // Per-seller product breakdown
      const sellerProductMap = new Map<string, { count: number; revenue: number }>();
      sellerSales.forEach((s: any) => {
        const prod = s.product || 'Outro';
        const cur = sellerProductMap.get(prod) || { count: 0, revenue: 0 };
        cur.count++;
        cur.revenue += Number(s.amount);
        sellerProductMap.set(prod, cur);
      });
      const productMix = Array.from(sellerProductMap.entries()).map(([name, data]) => ({
        name, ...data, pct: revenue > 0 ? (data.revenue / revenue) * 100 : 0,
      })).sort((a, b) => b.revenue - a.revenue);

      return {
        id: p.id, name: p.name, revenue, goal, expectedPace, actualPace, achievementPct,
        salesCount: sellerSales.length, totalCalls, totalLeads, conversion, avgTicket,
        checklistRate, commission: commResult.totalCommission, fixedSalary, bonuses: totalBonusAmount,
        productMix,
      };
    });

    // Products breakdown
    const productMap = new Map<string, { count: number; revenue: number }>();
    monthSales.forEach((s: any) => {
      const p = s.product || 'Outro';
      const cur = productMap.get(p) || { count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += Number(s.amount);
      productMap.set(p, cur);
    });
    const productBreakdown = Array.from(productMap.entries()).map(([name, data]) => ({
      name, ...data, pct: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // Platform breakdown
    const hubla = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('hubla') && !(s.platform || '').toLowerCase().includes('tmb')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const tmb = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('tmb') && !(s.platform || '').toLowerCase().includes('hubla')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const both = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('hubla') && (s.platform || '').toLowerCase().includes('tmb')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);

    // Origin breakdown
    const originMap = new Map<string, { count: number; revenue: number }>();
    monthSales.forEach((s: any) => {
      const o = s.origin || 'Outro';
      const cur = originMap.get(o) || { count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += Number(s.amount);
      originMap.set(o, cur);
    });
    const originBreakdown = Array.from(originMap.entries()).map(([name, data]) => ({
      name, ...data,
    })).sort((a, b) => b.revenue - a.revenue);

    // Aggregated KPIs
    const totalCalls = sellerPerformance.reduce((s, p) => s + p.totalCalls, 0);
    const totalLeads = sellerPerformance.reduce((s, p) => s + p.totalLeads, 0);
    const teamConversion = totalLeads > 0 ? (salesCount / totalLeads) * 100 : 0;
    const avgTicket = salesCount > 0 ? totalRevenue / salesCount : 0;

    // Checklist team avg
    const checklistAvg = sellerPerformance.length > 0
      ? sellerPerformance.reduce((s, p) => s + p.checklistRate, 0) / sellerPerformance.length
      : 0;

    // Financial
    const totalFixed = sellerPerformance.reduce((s, p) => s + p.fixedSalary, 0);
    const totalCommissions = sellerPerformance.reduce((s, p) => s + p.commission, 0);
    const totalBonuses = sellerPerformance.reduce((s, p) => s + p.bonuses, 0);
    const totalCost = totalFixed + totalCommissions + totalBonuses;
    const costPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const margin = totalRevenue - totalCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;

    // Daily sales data for best/worst day
    const dailySalesMap = new Map<string, number>();
    monthSales.forEach((s: any) => {
      const cur = dailySalesMap.get(s.date) || 0;
      dailySalesMap.set(s.date, cur + Number(s.amount));
    });
    const dailyEntries = Array.from(dailySalesMap.entries());
    const bestDay = dailyEntries.length > 0 ? dailyEntries.reduce((a, b) => a[1] > b[1] ? a : b) : null;
    const worstDay = dailyEntries.length > 0 ? dailyEntries.reduce((a, b) => a[1] < b[1] ? a : b) : null;
    const salesPerDay = daysInMonth > 0 ? salesCount / daysInMonth : 0;

    // Daily history: for each day of the month, sales per seller + team total
    const dailyHistory = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayDate = new Date(year, month, day);
      const weekday = dayDate.getDay();
      const isWeekend = weekday === 0 || weekday === 6;
      const perSeller: Record<string, number> = {};
      let teamTotal = 0;
      sellers.forEach((p: any) => {
        const v = monthSales
          .filter((s: any) => s.seller_id === p.id && s.date === dateStr)
          .reduce((sum: number, s: any) => sum + Number(s.amount), 0);
        perSeller[p.id] = v;
        teamTotal += v;
      });
      return { day, dateStr, isWeekend, perSeller, teamTotal };
    });

    // Previous month comparison
    const prevRevenue = (prevMonthSalesData || []).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null;

    // Top performers
    const topSeller = sellerPerformance.length > 0 ? [...sellerPerformance].sort((a, b) => b.revenue - a.revenue)[0] : null;
    const bestConversion = sellerPerformance.length > 0 ? [...sellerPerformance].sort((a, b) => b.conversion - a.conversion)[0] : null;
    const mostConsistent = sellerPerformance.length > 0 ? [...sellerPerformance].sort((a, b) => b.checklistRate - a.checklistRate)[0] : null;

    // Insights
    const insights: { type: 'success' | 'warning' | 'info'; message: string }[] = [];
    if (achievement < 100) insights.push({ type: 'warning', message: `Time não atingiu a meta (${fmtPct(achievement)} de atingimento)` });
    if (achievement >= 100) insights.push({ type: 'success', message: `Meta atingida! ${fmtPct(achievement)} de atingimento` });
    if (actualDailyPace < expectedDailyPace) insights.push({ type: 'warning', message: 'Ritmo diário ficou abaixo do esperado' });
    if (teamConversion < 15) insights.push({ type: 'warning', message: `Taxa de conversão baixa: ${fmtPct(teamConversion)}` });
    if (topSeller && topSeller.achievementPct > 100) insights.push({ type: 'success', message: `${topSeller.name} superou a meta individual` });
    sellerPerformance.forEach(sp => {
      if (sp.achievementPct < 50) insights.push({ type: 'warning', message: `${sp.name} atingiu apenas ${fmtPct(sp.achievementPct)} da meta` });
    });
    if (checklistAvg < 50) insights.push({ type: 'warning', message: `Execução média do checklist baixa: ${fmtPct(checklistAvg)}` });

    // Cash Collected = dinheiro DE FATO recebido (qualquer plataforma),
    // descontando valores pendentes/futuros ainda não pagos.
    const cashCollected = monthSales.reduce((sum: number, s: any) => sum + getCashCollected(s), 0);
    const cashCollectedPct = totalRevenue > 0 ? (cashCollected / totalRevenue) * 100 : 0;
    const marginOnCash = cashCollected - totalCost;
    const roiOnCash = totalCost > 0 ? ((cashCollected - totalCost) / totalCost) * 100 : 0;

    return {
      teamGoal, totalRevenue, achievement, salesCount, daysInMonth, workingDays,
      expectedDailyPace, actualDailyPace, sellerPerformance, productBreakdown,
      hubla, tmb, both, originBreakdown, totalCalls, totalLeads, teamConversion,
      avgTicket, checklistAvg, totalFixed, totalCommissions, totalBonuses, totalCost,
      costPct, margin, roi, bestDay, worstDay, salesPerDay, prevRevenue, revenueGrowth,
      topSeller, bestConversion, mostConsistent, insights, cashCollected, cashCollectedPct,
      marginOnCash, roiOnCash, dailyHistory,
    };
  }, [sales, profiles, month, year, kpis, checklists, teamSettings, bonuses, incomes, prevMonthSalesData, monthlyGoalData]);

  const chartConfig: ChartConfig = { value: { label: 'Valor' } };
  const [exporting, setExporting] = useState(false);

  const handleExportPdf = useCallback(async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const { generateResultsPdf } = await import('@/lib/pdfReportGenerator');
      generateResultsPdf(metrics, month, year, { includeFinancial: canSeeFinancial });
    } catch (err) {
      console.error('PDF export error:', err);
    } finally {
      setExporting(false);
    }
  }, [month, year, exporting, metrics]);

  const DownloadButton = () => (
    <button
      onClick={handleExportPdf}
      disabled={exporting}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
    >
      {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {exporting ? 'Gerando PDF...' : 'Baixar PDF'}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-card p-5 md:p-6 border-l-4 border-l-primary flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            {monthNames[month]} {year}
          </h2>
          <p className="text-sm text-muted-foreground">Relatório completo de performance comercial</p>
        </div>
        <DownloadButton />
      </div>

      <div className="space-y-6">

      {/* 1. General Performance */}
      <Section icon={Target} title="Performance Geral">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Meta Mensal" value={fmt(metrics.teamGoal)} />
          <KpiCard label="Receita Total" value={fmt(metrics.totalRevenue)} accent />
          <KpiCard label="Atingimento" value={fmtPct(metrics.achievement)}
            accent={metrics.achievement >= 100} warning={metrics.achievement < 80} />
        </div>
      </Section>

      {/* 2. Pace Analysis */}
      <Section icon={TrendingUp} title="Análise de Ritmo (Pace)">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <KpiCard label="Pace Esperado / dia" value={fmt(metrics.expectedDailyPace)} />
          <KpiCard label="Pace Real / dia" value={fmt(metrics.actualDailyPace)}
            accent={metrics.actualDailyPace >= metrics.expectedDailyPace}
            warning={metrics.actualDailyPace < metrics.expectedDailyPace} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Vendedor</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Meta</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Receita</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Pace Esp.</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Pace Real</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {metrics.sellerPerformance.map(sp => (
                <tr key={sp.id} className="border-b border-border/50">
                  <td className="py-2 font-medium text-foreground">{sp.name}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmt(sp.goal)}</td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmt(sp.revenue)}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmt(sp.expectedPace)}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmt(sp.actualPace)}</td>
                  <td className={`py-2 text-right font-semibold ${sp.achievementPct >= 100 ? 'text-green-500' : sp.achievementPct >= 80 ? 'text-yellow-500' : 'text-error'}`}>
                    {fmtPct(sp.achievementPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 2.5. Daily Sales History */}
      <Section icon={CalendarDays} title="Histórico de Vendas Diárias">
        <p className="text-xs text-muted-foreground -mt-2">
          Receita por dia: time completo e por vendedor. Dias sem vendas aparecem em branco; finais de semana destacados.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs md:text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium sticky left-0 bg-background z-10">Dia</th>
                {metrics.sellerPerformance.map(sp => (
                  <th key={sp.id} className="text-right py-2 px-2 text-muted-foreground font-medium whitespace-nowrap">
                    {sp.name.split(' ')[0]}
                  </th>
                ))}
                <th className="text-right py-2 px-2 text-primary font-semibold whitespace-nowrap">Total Time</th>
              </tr>
            </thead>
            <tbody>
              {metrics.dailyHistory.map(d => (
                <tr key={d.day} className={`border-b border-border/30 ${d.isWeekend ? 'bg-muted/20' : ''}`}>
                  <td className={`py-1.5 px-2 font-medium sticky left-0 z-10 ${d.isWeekend ? 'bg-muted/20 text-muted-foreground' : 'bg-background text-foreground'}`}>
                    {String(d.day).padStart(2, '0')}/{String(month + 1).padStart(2, '0')}
                  </td>
                  {metrics.sellerPerformance.map(sp => {
                    const v = d.perSeller[sp.id] || 0;
                    return (
                      <td key={sp.id} className={`py-1.5 px-2 text-right ${v > 0 ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {v > 0 ? fmt(v) : '—'}
                      </td>
                    );
                  })}
                  <td className={`py-1.5 px-2 text-right font-semibold ${d.teamTotal > 0 ? 'text-primary' : 'text-muted-foreground/40'}`}>
                    {d.teamTotal > 0 ? fmt(d.teamTotal) : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-primary/40 bg-primary/5">
                <td className="py-2 px-2 font-bold text-foreground sticky left-0 bg-primary/5 z-10">Total</td>
                {metrics.sellerPerformance.map(sp => (
                  <td key={sp.id} className="py-2 px-2 text-right font-bold text-foreground whitespace-nowrap">
                    {fmt(sp.revenue)}
                  </td>
                ))}
                <td className="py-2 px-2 text-right font-bold text-primary whitespace-nowrap">
                  {fmt(metrics.totalRevenue)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* 3. Sales by Product */}
      <Section icon={ShoppingBag} title="Vendas por Produto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {metrics.productBreakdown.map((p, i) => (
              <div key={p.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColor(i) }} />
                  <span className="text-sm font-medium text-foreground">{p.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{fmt(p.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{p.count} vendas · {fmtPct(p.pct)}</p>
                </div>
              </div>
            ))}
          </div>
          {metrics.productBreakdown.length > 0 && (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <PieChart>
                <Pie data={metrics.productBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {metrics.productBreakdown.map((_, i) => (
                    <Cell key={i} fill={chartColor(i)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
              </PieChart>
            </ChartContainer>
          )}
        </div>
      </Section>

      {/* 3.5. Seller Product Mix */}
      <Section icon={Users} title="Mix de Produtos por Vendedor">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {metrics.sellerPerformance.filter(sp => sp.revenue > 0).map(sp => (
            <div key={sp.id} className="rounded-lg border border-border p-4 space-y-3">
              <div>
                <h4 className="text-sm font-bold text-foreground">{sp.name}</h4>
                <p className="text-xs text-muted-foreground">Total: {fmt(sp.revenue)} · {sp.salesCount} vendas</p>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="flex-1 space-y-1.5 w-full">
                  {sp.productMix.map((pm, i) => (
                    <div key={pm.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: chartColor(i) }} />
                        <span className="text-foreground truncate">{pm.name}</span>
                      </div>
                      <span className="text-muted-foreground font-medium ml-2 whitespace-nowrap">{fmt(pm.revenue)} ({fmtPct(pm.pct)})</span>
                    </div>
                  ))}
                </div>
                {sp.productMix.length > 0 && (
                  <ChartContainer config={chartConfig} className="h-[140px] w-[140px] flex-shrink-0">
                    <PieChart>
                      <Pie data={sp.productMix} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={55} paddingAngle={2}>
                        {sp.productMix.map((_, i) => (
                          <Cell key={i} fill={chartColor(i)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
                    </PieChart>
                  </ChartContainer>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={DollarSign} title="Receita por Plataforma">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard label="Receita Total" value={fmt(metrics.totalRevenue)} accent />
          <KpiCard label="Cash Collected" value={fmt(metrics.cashCollected)} subValue={fmtPct(metrics.cashCollectedPct)} accent />
          <KpiCard label="Hubla" value={fmt(metrics.hubla)} />
          <KpiCard label="TMB" value={fmt(metrics.tmb)} />
          <KpiCard label="Hubla + TMB" value={fmt(metrics.both)} />
        </div>
      </Section>

      {/* 5. Sales Origin */}
      <Section icon={PieIcon} title="Análise por Origem">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            {metrics.originBreakdown.map((o, i) => (
              <div key={o.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: chartColor(i) }} />
                  <span className="text-sm font-medium text-foreground">{o.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-foreground">{fmt(o.revenue)}</p>
                  <p className="text-xs text-muted-foreground">{o.count} vendas</p>
                </div>
              </div>
            ))}
          </div>
          {metrics.originBreakdown.length > 0 && (
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <PieChart>
                <Pie data={metrics.originBreakdown} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {metrics.originBreakdown.map((_, i) => (
                    <Cell key={i} fill={chartColor(i)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
              </PieChart>
            </ChartContainer>
          )}
        </div>
      </Section>

      {/* 6. KPI Performance */}
      <Section icon={BarChart3} title="Performance de KPIs">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <KpiCard label="Total de Calls" value={String(metrics.totalCalls)} />
          <KpiCard label="Total de Leads" value={String(metrics.totalLeads)} />
          <KpiCard label="Conversão" value={fmtPct(metrics.teamConversion)} />
          <KpiCard label="Ticket Médio" value={fmt(metrics.avgTicket)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Vendedor</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Calls</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Leads</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Conversão</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Vendas</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Receita</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {metrics.sellerPerformance.map(sp => (
                <tr key={sp.id} className="border-b border-border/50">
                  <td className="py-2 font-medium text-foreground">{sp.name}</td>
                  <td className="py-2 text-right text-muted-foreground">{sp.totalCalls}</td>
                  <td className="py-2 text-right text-muted-foreground">{sp.totalLeads}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmtPct(sp.conversion)}</td>
                  <td className="py-2 text-right text-muted-foreground">{sp.salesCount}</td>
                  <td className="py-2 text-right font-semibold text-foreground">{fmt(sp.revenue)}</td>
                  <td className="py-2 text-right text-muted-foreground">{fmt(sp.avgTicket)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* 7. Funnel */}
      <Section icon={Activity} title="Funil de Vendas">
        {/* A cor de cada etapa tambem pinta o rotulo de conversao (texto
            pequeno), entao ela precisa passar como TEXTO sobre o card — por
            isso a rampa categorica, nao a FUNNEL_RAMP (feita para preenchimento
            de faixa, so >= 3:1). O verde fica reservado ao desfecho. */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-4 py-4">
          <FunnelStep label="Leads" value={metrics.totalLeads} color={chartColor(1)} />
          <Arrow />
          <FunnelStep label="Calls" value={metrics.totalCalls}
            conversionLabel={metrics.totalLeads > 0 ? `${fmtPct((metrics.totalCalls / metrics.totalLeads) * 100)}` : '-'}
            color={chartColor(2)} />
          <Arrow />
          <FunnelStep label="Vendas" value={metrics.salesCount}
            conversionLabel={metrics.totalCalls > 0 ? `${fmtPct((metrics.salesCount / metrics.totalCalls) * 100)}` : '-'}
            color={chartColor(0)} />
        </div>
      </Section>

      {/* 8. Checklist Performance */}
      <Section icon={CheckCircle2} title="Performance de Checklist">
        <KpiCard label="Taxa Média de Execução" value={fmtPct(metrics.checklistAvg)}
          accent={metrics.checklistAvg >= 70} warning={metrics.checklistAvg < 50} />
        <div className="mt-4 space-y-2">
          {metrics.sellerPerformance.map(sp => (
            <div key={sp.id} className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground w-28 truncate">{sp.name}</span>
              <div className="flex-1 h-6 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(sp.checklistRate, 100)}%`,
                    // Semantica preservada (bom / atencao / ruim), agora nos
                    // tokens do DS em vez de hsl() cru do tema antigo.
                    backgroundColor: sp.checklistRate >= 70 ? 'var(--success)' : sp.checklistRate >= 50 ? 'var(--warning)' : 'var(--destructive)',
                  }}
                />
              </div>
              <span className="text-sm font-semibold text-foreground w-14 text-right">{fmtPct(sp.checklistRate)}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* 10. Top Performers */}
      <Section icon={Award} title="Destaques do Mês">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {metrics.topSeller && (
            <HighlightCard emoji="🏆" title="Top Vendedor" name={metrics.topSeller.name} detail={fmt(metrics.topSeller.revenue)} />
          )}
          {metrics.bestConversion && (
            <HighlightCard emoji="🎯" title="Melhor Conversão" name={metrics.bestConversion.name} detail={fmtPct(metrics.bestConversion.conversion)} />
          )}
          {metrics.mostConsistent && (
            <HighlightCard emoji="✅" title="Mais Consistente" name={metrics.mostConsistent.name} detail={fmtPct(metrics.mostConsistent.checklistRate)} />
          )}
        </div>
      </Section>

      {/* 11. Insights */}
      {metrics.insights.length > 0 && (
        <Section icon={Zap} title="Alertas & Insights">
          <div className="space-y-2">
            {metrics.insights.map((insight, i) => (
              <div key={i} className={`flex items-start gap-2 p-3 rounded-lg ${
                insight.type === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                insight.type === 'warning' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-primary/10 border border-primary/20'
              }`}>
                {insight.type === 'warning' ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                )}
                <span className="text-sm text-foreground">{insight.message}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 12. Advanced Metrics */}
      <Section icon={CalendarDays} title="Métricas Avançadas">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="Vendas / Dia" value={metrics.salesPerDay.toFixed(1)} />
          <KpiCard label="Melhor Dia" value={metrics.bestDay ? `${metrics.bestDay[0].split('-').reverse().join('/')}` : '-'}
            subValue={metrics.bestDay ? fmt(metrics.bestDay[1]) : undefined} accent />
          <KpiCard label="Pior Dia" value={metrics.worstDay ? `${metrics.worstDay[0].split('-').reverse().join('/')}` : '-'}
            subValue={metrics.worstDay ? fmt(metrics.worstDay[1]) : undefined} warning />
          <KpiCard label="Dias Úteis" value={String(metrics.workingDays)} />
        </div>
      </Section>

      {/* 13. Financial Summary — apenas gestores/financeiro */}
      {canSeeFinancial && (
      <Section icon={Percent} title="Resumo Financeiro">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard label="Salários Fixos" value={fmt(metrics.totalFixed)} />
          <KpiCard label="Comissões" value={fmt(metrics.totalCommissions)} />
          <KpiCard label="Bônus" value={fmt(metrics.totalBonuses)} />
          <KpiCard label="Custo Comercial Total" value={fmt(metrics.totalCost)} />
          <KpiCard label="Custo sobre Receita" value={fmtPct(metrics.costPct)} warning={metrics.costPct > 30} />
          <KpiCard label="Margem de Contribuição" value={fmt(metrics.margin)}
            accent={metrics.margin > 0} warning={metrics.margin <= 0} />
          <KpiCard label="ROI Comercial" value={fmtPct(metrics.roi)} accent={metrics.roi > 0} />
          <KpiCard label="Margem s/ Cash Collected" value={fmt(metrics.marginOnCash)}
            subValue={`Cash In: ${fmt(metrics.cashCollected)}`}
            accent={metrics.marginOnCash > 0} warning={metrics.marginOnCash <= 0} />
          <KpiCard label="ROI s/ Cash Collected" value={fmtPct(metrics.roiOnCash)}
            subValue={`Cash In: ${fmtPct(metrics.cashCollectedPct)}`}
            accent={metrics.roiOnCash > 0} warning={metrics.roiOnCash <= 0} />
        </div>
      </Section>
      )}

      {/* 14. Month Comparison */}
      {metrics.revenueGrowth !== null && (
        <Section icon={TrendingUp} title="Comparação com Mês Anterior">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <KpiCard label="Receita Mês Anterior" value={fmt(metrics.prevRevenue)} />
            <KpiCard label="Receita Este Mês" value={fmt(metrics.totalRevenue)} />
            <KpiCard label="Variação" value={`${metrics.revenueGrowth > 0 ? '+' : ''}${fmtPct(metrics.revenueGrowth)}`}
              accent={metrics.revenueGrowth > 0} warning={metrics.revenueGrowth < 0} />
          </div>
        </Section>
      )}
      </div>{/* close reportRef */}

      {/* Bottom download button */}
      <div className="flex justify-center pt-2 pb-4">
        <DownloadButton />
      </div>
    </div>
  );
}

// --- Sub-components ---

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-4 md:p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, value, subValue, accent, warning }: {
  label: string; value: string; subValue?: string; accent?: boolean; warning?: boolean;
}) {
  return (
    <div className={`rounded-lg p-3 md:p-4 border ${accent ? 'border-primary/30 bg-primary/5' : warning ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-muted/20'}`}>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
      <p className={`text-lg md:text-xl font-bold mt-1 ${accent ? 'text-primary' : warning ? 'text-error' : 'text-foreground'}`}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
    </div>
  );
}

function FunnelStep({ label, value, conversionLabel, color }: {
  label: string; value: number; conversionLabel?: string; color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* `${color}20` era sufixo de alpha em hex — invalido com token OKLCH
          (`var(--x)20` nao parseia, o fundo simplesmente sumia). No DevClub a
          opacidade se faz com color-mix. */}
      <div
        className="rounded-xl px-6 py-4 text-center min-w-[100px]"
        style={{
          backgroundColor: `color-mix(in oklch, ${color} 14%, transparent)`,
          borderColor: `color-mix(in oklch, ${color} 40%, transparent)`,
          borderWidth: 1,
        }}
      >
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      {conversionLabel && (
        <span className="text-xs font-semibold" style={{ color }}>{conversionLabel}</span>
      )}
    </div>
  );
}

function Arrow() {
  return <ArrowDownRight className="h-5 w-5 text-muted-foreground rotate-[-45deg] md:rotate-0 flex-shrink-0" />;
}

function HighlightCard({ emoji, title, name, detail }: {
  emoji: string; title: string; name: string; detail: string;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-center">
      <span className="text-2xl">{emoji}</span>
      <p className="text-xs text-muted-foreground font-medium uppercase mt-1">{title}</p>
      <p className="text-base font-bold text-foreground mt-1">{name}</p>
      <p className="text-sm text-primary font-semibold">{detail}</p>
    </div>
  );
}
