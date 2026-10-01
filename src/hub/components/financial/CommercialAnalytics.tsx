import { useMemo } from 'react';
import { parseLocalDate } from '@/lib/utils';
import {
  DollarSign, TrendingUp, TrendingDown, Percent, Target, BarChart3, PieChart as PieIcon,
} from 'lucide-react';
import {
  ChartContainer,
  ChartConfig,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, Tooltip,
} from 'recharts';
import { chartColor, TOOLTIP_STYLE, AXIS_COLOR, GRID_COLOR } from '@/lib/chartPalette';

interface Props {
  allSales: any[];
  sellerData: { fixedSalary: number; totalCommission: number; totalBonuses: number; totalPayment: number }[];
  month: number;
  year: number;
}

const fmt = (v: number) =>
  `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (v: number) =>
  `${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

export function CommercialAnalytics({ allSales, sellerData, month, year }: Props) {
  const metrics = useMemo(() => {
    const monthSales = allSales.filter((s: any) => {
      const d = parseLocalDate(s.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });

    const totalRevenue = monthSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const salesCount = monthSales.length;

    const totalFixed = sellerData.reduce((s, d) => s + d.fixedSalary, 0);
    const totalCommissions = sellerData.reduce((s, d) => s + d.totalCommission, 0);
    const totalBonuses = sellerData.reduce((s, d) => s + d.totalBonuses, 0);
    const totalCost = totalFixed + totalCommissions + totalBonuses;

    const costPct = totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0;
    const margin = totalRevenue - totalCost;
    const roi = totalCost > 0 ? ((totalRevenue - totalCost) / totalCost) * 100 : 0;
    const cac = salesCount > 0 ? totalCost / salesCount : 0;

    // Platform breakdown
    const hubla = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('hubla') && !(s.platform || '').toLowerCase().includes('tmb')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const tmb = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('tmb') && !(s.platform || '').toLowerCase().includes('hubla')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    const both = monthSales.filter((s: any) => (s.platform || '').toLowerCase().includes('hubla') && (s.platform || '').toLowerCase().includes('tmb')).reduce((sum: number, s: any) => sum + Number(s.amount), 0);

    return {
      totalRevenue, totalCost, costPct, margin, roi, cac, salesCount,
      totalFixed, totalCommissions, totalBonuses,
      hubla, tmb, both,
    };
  }, [allSales, sellerData, month, year]);

  const revenueVsCostData = [
    { name: 'Receita', value: metrics.totalRevenue },
    { name: 'Custo Comercial', value: metrics.totalCost },
  ];

  // Series de dado vem da paleta compartilhada. `--accent` / `--secondary` sao
  // tokens de SUPERFICIE no DevClub (navy-3 / navy-4) e davam ~1.2:1 contra o
  // card — as fatias sumiam. chartColor() garante degraus >= 4.5:1.
  const costBreakdownData = [
    { name: 'Fixos', value: metrics.totalFixed, fill: chartColor(0) },
    { name: 'Comissões', value: metrics.totalCommissions, fill: chartColor(1) },
    { name: 'Bônus', value: metrics.totalBonuses, fill: chartColor(2) },
  ].filter(d => d.value > 0);

  const platformData = [
    { name: 'Hubla', value: metrics.hubla, fill: chartColor(0) },
    { name: 'TMB', value: metrics.tmb, fill: chartColor(1) },
    { name: 'Hubla + TMB', value: metrics.both, fill: chartColor(2) },
  ].filter(d => d.value > 0);

  const barChartConfig: ChartConfig = {
    value: { label: 'Valor' },
  };
  const pieConfig: ChartConfig = {
    value: { label: 'Valor' },
  };

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">Análise Financeira Comercial</h3>
      </div>

      {/* KPI Cards - Row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={DollarSign} label="Receita Total" value={fmt(metrics.totalRevenue)} accent />
        <KpiCard icon={TrendingDown} label="Custo Comercial Total" value={fmt(metrics.totalCost)} />
        <KpiCard icon={Percent} label="Custo sobre Receita" value={fmtPct(metrics.costPct)} subtle={metrics.costPct <= 30} warning={metrics.costPct > 30} />
      </div>

      {/* KPI Cards - Row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard icon={TrendingUp} label="Margem de Contribuição" value={fmt(metrics.margin)} accent={metrics.margin > 0} warning={metrics.margin <= 0} />
        <KpiCard icon={Target} label="ROI Comercial" value={fmtPct(metrics.roi)} accent={metrics.roi > 0} />
        <KpiCard icon={DollarSign} label="CAC Comercial" value={`${fmt(metrics.cac)} / venda`} subValue={`${metrics.salesCount} vendas no período`} />
      </div>

      {/* Payment Breakdown Table */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Detalhamento de Custos</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Salários Fixos</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.totalFixed)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Comissões</p>
            <p className="text-lg font-bold text-primary">{fmt(metrics.totalCommissions)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Bônus</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.totalBonuses)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Total Pago</p>
            <p className="text-lg font-bold text-primary">{fmt(metrics.totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Revenue by Platform */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-semibold text-foreground mb-3">Receita por Plataforma</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Receita Total</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.totalRevenue)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hubla</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.hubla)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">TMB</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.tmb)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hubla + TMB</p>
            <p className="text-lg font-bold text-foreground">{fmt(metrics.both)}</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue vs Cost Bar Chart */}
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" /> Receita vs Custo
          </h4>
          <ChartContainer config={barChartConfig} className="h-[220px] w-full">
            <BarChart data={revenueVsCostData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: AXIS_COLOR }} />
              <YAxis tick={{ fontSize: 11, fill: AXIS_COLOR }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                <Cell fill="var(--primary)" />
                <Cell fill="var(--destructive)" />
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>

        {/* Cost Breakdown Donut */}
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" /> Composição dos Custos
          </h4>
          <ChartContainer config={pieConfig} className="h-[220px] w-full">
            <PieChart>
              <Pie data={costBreakdownData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {costBreakdownData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => fmt(value)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Platform Revenue Donut */}
        <div className="glass-card p-5">
          <h4 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieIcon className="h-4 w-4 text-primary" /> Receita por Plataforma
          </h4>
          <ChartContainer config={pieConfig} className="h-[220px] w-full">
            <PieChart>
              <Pie data={platformData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {platformData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => fmt(value)} contentStyle={TOOLTIP_STYLE} itemStyle={{ color: 'var(--foreground)' }} />
            </PieChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, subValue, accent, warning, subtle }: {
  icon: any; label: string; value: string; subValue?: string;
  accent?: boolean; warning?: boolean; subtle?: boolean;
}) {
  return (
    <div className={`glass-card p-5 ${accent ? 'border-2 border-primary/30' : ''} ${warning ? 'border-2 border-destructive/30' : ''}`}>
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${accent ? 'text-primary' : warning ? 'text-error' : 'text-foreground'}`}>{value}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-1">{subValue}</p>}
    </div>
  );
}
