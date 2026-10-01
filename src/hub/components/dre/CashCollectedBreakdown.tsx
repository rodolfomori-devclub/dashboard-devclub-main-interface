import { useMemo } from 'react';
import { Wallet, Target, Trophy, Layers, Sparkles, TrendingUp } from 'lucide-react';
import { useSales } from '@/hooks/useSupabaseData';
import { useGoals } from '@/hooks/useGoals';
import { parseLocalDate } from '@/lib/utils';

const fmtBRL = (n: number) => `R$ ${Math.round(n).toLocaleString('pt-BR')}`;

type Funnel = 'workshop' | 'application';
type Product = 'global' | 'postgraduate' | 'other';

function classifyProduct(productName: string): Product {
  const p = (productName || '').toLowerCase();
  if (p.includes('pós') || p.includes('pos ') || p.startsWith('pos ') || p.includes('postgrad')) return 'postgraduate';
  if (p.includes('global')) return 'global';
  return 'other';
}

function classifyFunnel(origin: string, productName: string): Funnel {
  const o = (origin || '').toLowerCase().trim();
  const p = (productName || '').toLowerCase();
  if (
    o.includes('workshop') ||
    o.includes('live') ||
    o.includes('lançamento') ||
    o.includes('lancamento') ||
    p.includes('workshop')
  ) {
    return 'workshop';
  }
  return 'application';
}

interface Props {
  month: number; // 1-12
  year: number;
  ccHubla: number;
  ccTmb: number;
}

export function CashCollectedBreakdown({ month, year, ccHubla, ccTmb }: Props) {
  const { data: allSales = [] } = useSales();
  const { data: goals } = useGoals(month, year);
  const target = Number(goals?.cash_collected_target) || 0;
  const cashCollected = (Number(ccHubla) || 0) + (Number(ccTmb) || 0);

  const data = useMemo(() => {
    const monthSales = allSales.filter((s: any) => {
      const d = parseLocalDate(s.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

    const buckets = {
      total: 0,
      global: { total: 0, workshop: 0, application: 0 },
      postgraduate: { total: 0, workshop: 0, application: 0 },
      other: { total: 0, workshop: 0, application: 0 },
      funnel: { workshop: 0, application: 0 },
    };

    monthSales.forEach((s: any) => {
      const amount = Number(s.amount) || 0;
      if (amount <= 0) return;
      const product = classifyProduct(s.product);
      const funnel = classifyFunnel(s.origin, s.product);
      buckets.total += amount;
      buckets[product].total += amount;
      buckets[product][funnel] += amount;
      buckets.funnel[funnel] += amount;
    });

    const pct = (n: number) => (buckets.total > 0 ? Math.round((n / buckets.total) * 100) : 0);
    const topProductEntry = (['global', 'postgraduate'] as const)
      .map(k => ({ key: k, value: buckets[k].total }))
      .sort((a, b) => b.value - a.value)[0];
    const topFunnelEntry = (['workshop', 'application'] as const)
      .map(k => ({ key: k, value: buckets.funnel[k] }))
      .sort((a, b) => b.value - a.value)[0];
    const progress = target > 0 ? Math.min(100, Math.round((cashCollected / target) * 100)) : 0;

    return {
      ...buckets,
      pctGlobal: pct(buckets.global.total),
      pctPostgrad: pct(buckets.postgraduate.total),
      pctWorkshop: pct(buckets.funnel.workshop),
      pctApplication: pct(buckets.funnel.application),
      topProductEntry,
      topFunnelEntry,
      progress,
    };
  }, [allSales, month, year, target]);

  return (
    <div className="border border-border rounded-lg bg-card overflow-hidden">
      {/* Trio canonico do DevClub para faixa de sucesso: -bg / -line / -text.
          text-emerald-600 (#059669) sobre superficie escura da 3.87:1 e reprova
          AA em texto de 12px; success-text (green-11) da 7.07:1. */}
      <div className="bg-success-bg px-3 py-2 border-b border-success-line flex items-center gap-2">
        <Wallet className="h-4 w-4 text-success-text" />
        <span className="text-xs font-black text-success-text uppercase tracking-widest">Faturamento &amp; Cash Collected · Detalhamento</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Master KPIs: Faturamento + Cash Collected.
            SO UM dos dois pode ser verde. Faturamento e o total bruto (contexto)
            e fica neutro em bg-card; Cash Collected e a metrica que o time
            persegue, entao guarda o verde. Os dois verdes lado a lado anulavam
            a hierarquia e ainda faziam duas chapas verdes grandes. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="rounded-xl p-4 flex items-center gap-4 border border-border bg-card">
            <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <TrendingUp className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-semibold">Faturamento do mês</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight mt-0.5">{fmtBRL(data.total)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Soma de todas as vendas registradas</p>
            </div>
          </div>

          <div
            className="rounded-xl p-4 flex items-center gap-4 border border-success-line"
            style={{ background: 'linear-gradient(135deg, var(--success-bg), color-mix(in oklch, var(--success-bg) 45%, transparent))' }}
          >
            <div className="w-14 h-14 rounded-xl bg-success-bg flex items-center justify-center text-success-text shrink-0">
              <Wallet className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-[0.2em] text-success-text/80 font-semibold">Cash Collected</p>
              <p className="text-3xl font-extrabold text-foreground tracking-tight mt-0.5">{fmtBRL(cashCollected)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Hubla {fmtBRL(Number(ccHubla) || 0)} · TMB {fmtBRL(Number(ccTmb) || 0)}
              </p>
            </div>
          </div>
        </div>

        {/* Product cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ProductCard
            name="GLOBAL"
            total={data.global.total}
            pct={data.pctGlobal}
            workshop={data.global.workshop}
            application={data.global.application}
            accent="primary"
            isTop={data.topProductEntry?.key === 'global' && data.global.total > 0}
          />
          <ProductCard
            name="POSTGRADUATE"
            total={data.postgraduate.total}
            pct={data.pctPostgrad}
            workshop={data.postgraduate.workshop}
            application={data.postgraduate.application}
            accent="info"
            isTop={data.topProductEntry?.key === 'postgraduate' && data.postgraduate.total > 0}
          />
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Monthly target */}
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-success-text" />
              <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Meta Cash Collected</h3>
            </div>
            {target > 0 ? (
              <>
                <p className="text-xl font-extrabold text-foreground">{fmtBRL(cashCollected)}</p>
                <p className="text-xs text-muted-foreground">de <span className="font-semibold text-foreground">{fmtBRL(target)}</span></p>
                <div className="h-2 rounded-full overflow-hidden bg-muted mt-3">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${data.progress}%`,
                      background: data.progress >= 100
                        ? 'linear-gradient(90deg, var(--primary), var(--brand-grad-end))'
                        : 'linear-gradient(90deg, var(--primary), var(--dc-info-solid))',
                    }}
                  />
                </div>
                <p className="text-xs text-right text-success-text font-bold mt-1">{data.progress}%</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Configure em Configurações → Metas Comerciais</p>
            )}
          </div>

          {/* Funnel */}
          <div className="rounded-xl border border-border bg-card/60 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-primary" />
              <h3 className="text-[11px] font-semibold text-foreground uppercase tracking-wider">Cash por Funil</h3>
            </div>
            <div className="space-y-3">
              <FunnelRow label="Workshop / Live" value={data.funnel.workshop} pct={data.pctWorkshop} color="var(--primary)" />
              <FunnelRow label="Application" value={data.funnel.application} pct={data.pctApplication} color="var(--dc-info-solid)" />
            </div>
          </div>

          {/* Top performers */}
          <div className="grid grid-rows-2 gap-3">
            {/* O fundo destes dois cards foi CLAREADO no rebrand (tint de
                --warning / --success-bg sobre o card escuro) mas a tinta
                continuou nos degraus escuros do Tailwind — yellow-600 e
                emerald-600 sao cores de texto para PAPEL. Sobem para os
                degraus de texto da rampa. */}
            <div
              className="rounded-xl p-3 border border-warning/30 flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, color-mix(in oklch, var(--warning) 18%, transparent), color-mix(in oklch, var(--warning) 6%, transparent))' }}
            >
              <Trophy className="h-7 w-7 text-warning shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-warning/80 font-semibold">Top Produto</p>
                <p className="text-sm font-extrabold text-foreground truncate">
                  {data.topProductEntry?.value ? (data.topProductEntry.key === 'global' ? 'GLOBAL' : 'POSTGRADUATE') : '—'}
                </p>
                <p className="text-sm font-bold text-warning">{fmtBRL(data.topProductEntry?.value || 0)}</p>
              </div>
            </div>
            <div
              className="rounded-xl p-3 border border-success-line flex items-center gap-3"
              style={{ background: 'linear-gradient(135deg, var(--success-bg), color-mix(in oklch, var(--dc-info-solid) 10%, transparent))' }}
            >
              <Sparkles className="h-7 w-7 text-success-text shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-success-text/80 font-semibold">Top Funil</p>
                <p className="text-sm font-extrabold text-foreground truncate">
                  {data.topFunnelEntry?.value ? (data.topFunnelEntry.key === 'workshop' ? 'Workshop / Live' : 'Application') : '—'}
                </p>
                <p className="text-sm font-bold text-success-text">{fmtBRL(data.topFunnelEntry?.value || 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  name, total, pct, workshop, application, accent, isTop,
}: {
  name: string; total: number; pct: number; workshop: number; application: number;
  accent: 'primary' | 'info'; isTop: boolean;
}) {
  // O antigo 'lavender' virou --brand-grad-end (= green-11) no rebrand, ou
  // seja: GLOBAL e POSTGRADUATE passaram a ser dois verdes quase iguais e o
  // par deixou de distinguir produto. Azul informativo devolve a distincao e
  // bate com o mapa de cor de produto de meetings/analytics/Charts.tsx.
  const accentColor = accent === 'primary' ? 'var(--primary)' : 'var(--dc-info-solid)';
  return (
    <div
      className="rounded-xl p-4 border relative overflow-hidden"
      style={{
        borderColor: isTop ? 'color-mix(in oklch, var(--warning) 40%, transparent)' : 'var(--border)',
        background: isTop ? 'linear-gradient(135deg, color-mix(in oklch, var(--warning) 18%, transparent), var(--card))' : 'color-mix(in oklch, var(--card) 60%, transparent)',
      }}
    >
      {isTop && (
        <div className="absolute top-2 right-2 text-warning flex items-center gap-1 text-[10px] font-bold">
          <Trophy className="h-3 w-3" /> TOP
        </div>
      )}
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">{name}</h3>
        <span className="text-xs font-semibold" style={{ color: accentColor }}>{pct}%</span>
      </div>
      <p className="text-2xl font-extrabold text-foreground tracking-tight">{fmtBRL(total)}</p>
      <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Workshop / Live</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{fmtBRL(workshop)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Application</p>
          <p className="text-sm font-bold text-foreground mt-0.5">{fmtBRL(application)}</p>
        </div>
      </div>
    </div>
  );
}

function FunnelRow({ label, value, pct, color }: { label: string; value: number; pct: number; color: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-foreground font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          {label}
        </span>
        <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>
      </div>
      <p className="text-sm font-bold text-foreground">{fmtBRL(value)}</p>
      <div className="h-1.5 rounded-full overflow-hidden bg-muted mt-1">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
