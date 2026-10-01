import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS_COLOR, GRID_COLOR, TOOLTIP_STYLE } from '@/lib/chartPalette';
import { commissionDateKey } from './commissionDate';

const money = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function CommissionTrend({ month, rows, partial }: {
  month: string;
  rows: { date: string; commissionValue: number | null }[];
  partial: boolean;
}) {
  const gradientId = `commission-trend-${useId().replace(/:/g, '')}`;
  const series = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const currentMonth = `${todayParts.find((entry) => entry.type === 'year')?.value}-${todayParts.find((entry) => entry.type === 'month')?.value}`;
    const today = Number(todayParts.find((entry) => entry.type === 'day')?.value);
    const lastActualDay = month < currentMonth ? days : month === currentMonth ? today : 0;
    const amounts = new Map<number, number>();
    for (const row of rows) {
      if (row.commissionValue === null || !Number.isFinite(row.commissionValue)) continue;
      const match = commissionDateKey(row.date)?.match(/^(\d{4}-\d{2})-(\d{2})$/);
      if (!match || match[1] !== month) continue;
      const day = Number(match[2]);
      amounts.set(day, (amounts.get(day) || 0) + row.commissionValue);
    }
    let accumulated = 0;
    return Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      accumulated += amounts.get(day) || 0;
      return { day: String(day).padStart(2, '0'), value: day <= lastActualDay ? Math.round(accumulated * 100) / 100 : null };
    });
  }, [month, rows]);
  const hasCalculatedRows = rows.some((row) => row.commissionValue !== null);

  return <section className="surface-panel" aria-label="Evolução das comissões no mês">
    <div className="commission-panel-head">
      <div><h3>Comissões ao longo do mês</h3><p>Valor acumulado a cada dia{partial ? ' das vendas já calculadas.' : '.'}</p></div>
      {partial && <span className="commission-badge is-pending">Cálculo parcial</span>}
    </div>
    {hasCalculatedRows ? <div className="commission-chart" role="img" aria-label={`Comissões calculadas acumuladas em ${month}: ${money(series.filter((entry) => entry.value !== null).at(-1)?.value || 0)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 16, bottom: 8, left: 6 }}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} /><stop offset="96%" stopColor="var(--chart-1)" stopOpacity={0.015} /></linearGradient></defs>
          <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 5" vertical={false} />
          <XAxis dataKey="day" tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={20} dy={8} />
          <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={false} tickLine={false} width={58} tickFormatter={(value: number) => value >= 1000 ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value / 1000)} mil` : String(value)} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value: number) => [money(value), 'Comissão acumulada']} labelFormatter={(label) => `Dia ${label}`} />
          <Area type="monotone" dataKey="value" stroke="var(--chart-1)" strokeWidth={3} fill={`url(#${gradientId})`} dot={{ r: 2, fill: 'var(--chart-1)', strokeWidth: 0 }} activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 3 }} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div> : <div className="commission-empty"><strong>A evolução aparece com as primeiras comissões calculadas</strong><p>As vendas atribuídas já ficam disponíveis no extrato. O gráfico acompanha os valores assim que houver uma regra de comissão definida.</p></div>}
  </section>;
}
