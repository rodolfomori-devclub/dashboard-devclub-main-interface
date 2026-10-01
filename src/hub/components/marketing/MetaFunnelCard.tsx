import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FUNNEL_RAMP } from '@/lib/chartPalette';

const fmtInt = (v: number) => Math.round(isFinite(v) ? v : 0).toLocaleString('pt-BR');
const fmtK = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}K` : fmtInt(v));
const fmtPct = (v: number) => `${((isFinite(v) ? v : 0) * 100).toFixed(2)}%`;

function num(v: any): number {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[R$\s%]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function normalizeDate(v: string): string {
  if (!v) return '';
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  return '';
}

interface Props {
  from: string;
  to: string;
  salesCount: number;
}

export default function MetaFunnelCard({ from, to, salesCount }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['low-ticket-meta-hubla'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('low-ticket-meta-hubla');
      if (error) throw new Error(error.message);
      return data as { metaAds: string[][]; hublaSales: string[][] };
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 60_000,
  });

  const totals = useMemo(() => {
    const t = { impressions: 0, clicks: 0, pageviews: 0 };
    (data?.metaAds || []).forEach(row => {
      const prod = (row[2] || '').trim().toLowerCase();
      if (prod === 'impulsionamento') return; // pertence à Distribuição de Conteúdo
      const d = normalizeDate(row[1]);
      if (!d || d < from || d > to) return;
      t.clicks += num(row[8]);
      t.impressions += num(row[9]);
      t.pageviews += num(row[10]);
    });
    return t;
  }, [data, from, to]);

  const { impressions, clicks, pageviews } = totals;
  const ctr = impressions ? clicks / impressions : 0;
  const connect = clicks ? pageviews / clicks : 0;
  const saleRate = pageviews ? salesCount / pageviews : 0;

  // A largura de cada faixa e proporcional ao valor, entao a faixa do topo e a
  // maior superficie colorida do card. Por isso os degraus vem da FUNNEL_RAMP:
  // a faixa larga fica neutra (navy) e o verde entra so nas estreitas, ate o
  // premio (Vendas). Os hsl() antigos eram o roxo/violeta do tema anterior.
  const stages = [
    { label: 'Impressões', value: impressions, ramp: 0 },
    { label: 'Cliques', value: clicks, ramp: 2 },
    { label: 'Pageviews', value: pageviews, ramp: 3 },
    { label: 'Vendas', value: salesCount, ramp: 4 },
  ];
  const max = Math.max(...stages.map(s => s.value), 1);

  return (
    <Card className="glass-surface border-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <div className="text-xs text-muted-foreground py-4 text-center">Carregando…</div>}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div className="md:col-span-2 flex flex-col gap-3 items-center py-4">
            {stages.map(s => {
              const w = Math.max((s.value / max) * 100, 12);
              // Texto branco sobre verde da 1.98:1. Cada degrau da rampa ja
              // carrega a propria tinta — a luminancia dela nao e monotonica,
              // entao um limiar por indice colocava tinta clara sobre navy-9
              // (2.83:1, reprova).
              const degrau = FUNNEL_RAMP[s.ramp];
              return (
                <div
                  key={s.label}
                  className="rounded-lg flex items-center justify-center text-sm font-medium py-3 shadow-sm"
                  style={{ width: `${w}%`, background: degrau.fill, color: degrau.ink, minWidth: 140 }}
                >
                  {s.label}: {fmtK(s.value)}
                </div>
              );
            })}
          </div>
          <div className="space-y-5">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">CTR (Impressão → Clique)</p>
              <p className="text-3xl font-bold text-foreground">{fmtPct(ctr)}</p>
              <p className="text-xs text-muted-foreground">{fmtK(clicks)} cliques</p>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Connect Rate (Clique → PV)</p>
              <p className="text-3xl font-bold text-foreground">{fmtPct(connect)}</p>
              <p className="text-xs text-muted-foreground">{fmtK(pageviews)} pageviews</p>
            </div>
            <div className="border-t border-border/40 pt-3">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Taxa de Venda (PV → Venda)</p>
              <p className="text-3xl font-bold text-foreground">{fmtPct(saleRate)}</p>
              <p className="text-xs text-muted-foreground">{fmtInt(salesCount)} vendas</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
