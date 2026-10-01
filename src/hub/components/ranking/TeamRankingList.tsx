import { Trophy, Target, TrendingUp } from 'lucide-react';
import { useTeamRanking } from '@/hooks/useTeamRanking';
import { TeamAvatar } from '@/components/TeamAvatar';
import { Progress } from '@/components/ui/progress';

const fmt = (n: number) => `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

export function TeamRankingList({ month, year, variant = 'default' }: { month?: number; year?: number; variant?: 'default' | 'tv' }) {
  const { ranks, directoryAvailable, directoryLoading } = useTeamRanking(month, year);
  const isTv = variant === 'tv';

  if (!directoryAvailable) return <div className="glass-card p-8 text-center text-muted-foreground" role="status">{directoryLoading ? 'Carregando participantes do ranking…' : 'Ranking indisponível: não foi possível confirmar os participantes.'}</div>;

  if (!ranks.length) {
    return (
      <div className="glass-card p-8 text-center text-muted-foreground">
        Nenhum time configurado ainda. Crie times em Configurações → Times.
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-3 mb-2">
        <Trophy className={`${isTv ? 'h-7 w-7' : 'h-5 w-5'} text-primary`} />
        <h2 className={`${isTv ? 'text-2xl' : 'text-lg'} font-bold text-foreground`}>Ranking de Times</h2>
      </div>
      {ranks.map((r, i) => {
        const medal = i === 0 ? 'border-yellow-400/40 bg-gradient-to-r from-yellow-400/10 to-transparent' :
          i === 1 ? 'border-gray-400/30 bg-gradient-to-r from-gray-400/10 to-transparent' :
          i === 2 ? 'border-amber-600/30 bg-gradient-to-r from-amber-600/10 to-transparent' :
          'border-border/30';
        const positionBg = i === 0 ? 'bg-yellow-400/20 text-yellow-400' :
          i === 1 ? 'bg-gray-400/20 text-gray-300' :
          i === 2 ? 'bg-amber-600/20 text-amber-500' :
          'bg-muted text-muted-foreground';
        return (
          <div key={r.id ?? 'none'} className={`p-4 rounded-xl border ${medal} flex items-center gap-4`}>
            <div className={`${isTv ? 'w-14 h-14 text-2xl' : 'w-10 h-10 text-lg'} rounded-lg flex items-center justify-center font-bold ${positionBg}`}>{i + 1}</div>
            <TeamAvatar name={r.name} imageUrl={r.image_url} size={isTv ? 'lg' : 'md'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <p className={`${isTv ? 'text-2xl' : 'text-base'} font-bold text-foreground truncate`}>{r.name}</p>
                <p className={`${isTv ? 'text-3xl' : 'text-lg'} font-bold text-primary`}>{fmt(r.totalSales)}</p>
              </div>
              {r.goal > 0 ? (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Meta {fmt(r.goal)}</span>
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {r.progress}%</span>
                  </div>
                  <Progress value={Math.min(100, r.progress)} className="h-2 mt-2" />
                  {r.remaining > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1">Faltam {fmt(r.remaining)}</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">{r.salesCount} venda(s) • Sem meta configurada</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
