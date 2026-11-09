import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth as useVaultAuth } from '../../contexts/AuthContext';
import { useAuth } from '../contexts/AuthContext';
import { requestApi } from '../../lib/api';
import { brazilDate } from '../../utils/goalPace.js';
import { formatValue } from '../../components/charts/chartFormatters.js';
import { ReferenceChart } from '../../components/charts/ReferenceChart';

const METRICS = { gross: 'Valor das vendas', cash: 'Cash collected', count: 'Quantidade de vendas' };
type MetricId = keyof typeof METRICS;
interface GoalPace {
  target: number | null; actual: number | null; attainment: number | null; expected: number | null; pacePercent: number | null;
  validTarget: boolean; definitive: boolean; scopeExcluded: boolean; available: boolean; sourceIncomplete: boolean;
  future: boolean; ended: boolean; basis: 'calendar' | 'business';
  rows: { date: string; label: string; actual: number | null; planned: number | null; observed: boolean }[];
}
interface IndividualMetric { metric: MetricId; configured: boolean; pace: GoalPace }
interface IndividualGoals { year: number; month: number; today: string; loading: boolean; attributionAvailable: boolean; metrics: IndividualMetric[] }
const formatted = (value: number | null | undefined, unit: 'currency' | 'count' | 'percent') => value == null || !Number.isFinite(value) ? '—' : formatValue(value, unit);
const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, index, 15))));

export default function IndividualGoalPace({ year }: { year: number }) {
  const { currentUser } = useVaultAuth();
  const { user } = useAuth();
  const [month, setMonth] = useState(() => Number(brazilDate().slice(5, 7)));
  const [choice, setChoice] = useState<{ key: string; metric: MetricId } | null>(null);
  const [showChart, setShowChart] = useState(false);
  const key = `${currentUser?.uid}:${user?.id}:${year}:${month}`;
  const query = useQuery<IndividualGoals>({
    queryKey: ['individual-goal-pace', currentUser?.uid, user?.id, year, month],
    enabled: Boolean(currentUser?.uid && user?.id),
    queryFn: async ({ signal }) => {
      const result: IndividualGoals = await requestApi(`/goal-plans/me/${year}/${month}`, { signal });
      if (result.year !== year || result.month !== month || !Array.isArray(result.metrics) || !result.metrics.length
        || result.metrics.some(item => !Object.hasOwn(METRICS, item.metric) || typeof item.configured !== 'boolean' || !Array.isArray(item.pace?.rows))) {
        throw new Error('A consulta não retornou sua meta do período.');
      }
      return result;
    },
    retry: false,
  });
  if (!currentUser?.uid || !user?.id) return null;
  const data = query.data;
  const selected = data && ((choice?.key === key && data.metrics.find(item => item.metric === choice.metric))
    || data.metrics.find(item => item.configured && item.pace.validTarget) || data.metrics.find(item => item.configured) || data.metrics[0]);
  const pace = selected?.pace;
  const unit = selected?.metric === 'count' ? 'count' : 'currency';
  const partial = pace && !pace.future && !pace.scopeExcluded && (!pace.definitive || !data?.attributionAvailable);
  return <section className="surface-panel p-5 space-y-4" aria-label="Minha meta do mês" aria-busy={query.isFetching}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><h2 className="text-lg font-semibold">Minha meta do mês</h2><p className="text-sm text-muted-foreground capitalize">{months[month - 1]} de {year}</p></div>
      <button type="button" className="button" disabled={query.isFetching} onClick={() => query.refetch()}>Atualizar minha meta</button>
    </header>
    <div className="flex flex-wrap gap-4">
      <label className="text-sm space-y-1"><span className="block text-muted-foreground">Mês da meta</span><select className="ds-input" aria-label="Mês da minha meta" value={month} onChange={event => setMonth(Number(event.target.value))}>{months.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></label>
      {selected && <label className="text-sm space-y-1"><span className="block text-muted-foreground">Indicador</span><select className="ds-input" aria-label="Indicador da minha meta" value={selected.metric} onChange={event => setChoice({ key, metric: event.target.value as MetricId })}>{data.metrics.map(item => <option key={item.metric} value={item.metric}>{METRICS[item.metric]}{item.configured ? '' : ' · sem meta'}</option>)}</select></label>}
    </div>
    {query.isPending ? <p className="text-sm text-muted-foreground" role="status">Carregando sua meta…</p>
      : query.isError ? <div className="notice notice-error" role="alert">Não foi possível carregar sua meta. <button type="button" className="underline" onClick={() => query.refetch()}>Tentar novamente</button></div>
        : selected && pace && <>
          {pace.scopeExcluded && <p className="notice" role="status">Você está fora dos cálculos de desempenho. Sua meta histórica permanece preservada.</p>}
          {!selected.configured && <p className="notice">Meta não definida para este mês e indicador.</p>}
          {selected.configured && !pace.validTarget && <p className="notice">Sua meta está zerada ou sem valor válido. Os percentuais dependem de uma meta maior que zero.</p>}
          {pace.future && <p className="notice" role="status">Mês não iniciado. O acompanhamento começa no primeiro dia do mês.</p>}
          {partial && <p className="notice" role="status">{data.loading ? 'Histórico em coleta. Os valores disponíveis são parciais.' : !pace.available ? 'Seu realizado está indisponível. Atualize os dados para consultar novamente.' : 'Leitura parcial: a cobertura das suas vendas está incompleta; os percentuais disponíveis são parciais.'}</p>}
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div><dt className="text-sm text-muted-foreground">Meta do mês</dt><dd className="mt-1 text-2xl font-semibold tabular-nums break-words" data-testid="individual-goal-target">{selected.configured ? formatted(pace.target, unit) : 'Não definida'}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Realizado no mês</dt><dd className="mt-1 text-2xl font-semibold tabular-nums break-words" data-testid="individual-goal-actual">{pace.future ? 'Não iniciado' : formatted(pace.actual, unit)}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Atingimento da meta</dt><dd className="mt-1 text-2xl font-semibold tabular-nums" data-testid="individual-goal-attainment">{formatted(pace.attainment, 'percent')}</dd></div>
          </dl>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border pt-4">
            <div><dt className="text-sm text-muted-foreground">{pace.ended ? 'Esperado no fechamento' : 'Esperado até hoje'}</dt><dd className="mt-1 text-xl font-semibold tabular-nums" data-testid="individual-goal-expected">{formatted(pace.expected, unit)}</dd><p className="text-xs text-muted-foreground">{pace.basis === 'business' ? 'Dias úteis · segunda a sexta' : 'Dias corridos'}</p></div>
            <div><dt className="text-sm text-muted-foreground">Ritmo da meta</dt><dd className="mt-1 text-xl font-semibold tabular-nums" data-testid="individual-goal-pace">{formatted(pace.pacePercent, 'percent')}</dd><p className="text-xs text-muted-foreground">100% significa acompanhar o planejado até a data.</p></div>
          </dl>
          <p className="text-xs text-muted-foreground">{selected.metric === 'gross' ? 'Guru, Hotmart e Hubla: líquido após taxas; demais plataformas: valor contratado.' : selected.metric === 'cash' ? 'Cash collected de novas vendas: líquido integral em Guru, Hotmart e Hubla; TMB 40%; Asaas entrada do novo contrato.' : 'Quantidade de vendas atribuídas a você.'}</p>
          <button type="button" className="button" aria-expanded={showChart} onClick={() => setShowChart(value => !value)}>{showChart ? 'Ocultar evolução da meta' : 'Ver evolução da meta'}</button>
          {showChart && <ReferenceChart title="Evolução da minha meta" rows={pace.rows} height={240} mode="line" referenceDate={!pace.future && !pace.ended ? data.today : undefined}
            series={[{ key: 'actual', label: partial ? 'Realizado parcial' : 'Realizado', unit, color: 'var(--chart-1)' }, { key: 'planned', label: 'Meta acumulada', unit, color: 'var(--chart-2)', dash: '6 5' }]} />}
        </>}
  </section>;
}
