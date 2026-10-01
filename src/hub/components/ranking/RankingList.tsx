import type { SellerRank } from '@/hooks/useSalesRanking';
import { SellerAvatar } from '@/components/SellerAvatar';
import { rankingMoney } from '@/lib/rankingAmounts';

interface RankingListProps {
  sellers: SellerRank[];
}

export function RankingList({ sellers }: RankingListProps) {
  if (sellers.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        Nenhum vendedor cadastrado.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="section-title mb-3">Ranking Completo</h3>
      {sellers.map((seller, i) => (
        <div
          key={seller.id}
          data-testid={`legacy-ranking-seller-${seller.id}`}
          className={`group flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4 p-4 rounded-xl border transition-all duration-500 ${
            i === 0
              ? 'bg-gradient-to-r from-yellow-400/10 to-transparent border-yellow-400/20 shadow-lg shadow-yellow-400/5'
              : i === 1
              ? 'bg-gradient-to-r from-gray-400/10 to-transparent border-gray-400/15'
              : i === 2
              ? 'bg-gradient-to-r from-amber-600/10 to-transparent border-amber-600/15'
              : 'border-border/30 hover:bg-accent/20'
          }`}
          style={i > 2 ? { background: 'var(--card)' } : {}}
        >
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
            i === 0 ? 'bg-yellow-400/20 text-yellow-400' :
            i === 1 ? 'bg-gray-400/20 text-gray-300' :
            i === 2 ? 'bg-amber-600/20 text-amber-500' :
            'bg-muted text-muted-foreground'
          }`}>
            {i + 1}
          </div>

          <SellerAvatar
            name={seller.name}
            avatarUrl={seller.avatarUrl}
            size="md"
            borderColor={
              i === 0 ? 'border-yellow-400/50' :
              i === 1 ? 'border-gray-400/50' :
              i === 2 ? 'border-amber-600/50' :
              'border-primary/30'
            }
          />

          <div className="flex-1 min-w-[90px]">
            <p className="font-semibold truncate text-foreground">{seller.name}</p>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex-1 max-w-[200px]">
                <div className="h-1.5 rounded-full overflow-hidden bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${Math.min(seller.goalProgress, 100)}%`,
                      // Meta batida = o verde mais forte da rampa (green-6 -> a
                      // marca cheia). Em progresso vai para NEUTRO: antes as
                      // duas barras eram verdes e a de "em progresso" era ate
                      // mais clara que a de "batida", entao a lista inteira lia
                      // como sucesso. Verde e sinal, nao preenchimento default.
                      background: seller.goalProgress >= 100
                        ? 'linear-gradient(90deg, var(--dc-green-6), var(--primary))'
                        : 'linear-gradient(90deg, var(--dc-navy-9), var(--dc-navy-11))',
                    }}
                  />
                </div>
              </div>
              <span className="text-xs text-muted-foreground">{seller.goalProgress}%</span>
            </div>
          </div>

          <div className="text-right w-full sm:w-auto shrink-0">
            <p className="text-xs text-muted-foreground">Valor bruto{seller.grossPartial ? ' · parcial' : ''}</p>
            <p className="font-bold text-xl text-primary" data-testid="legacy-gross">{rankingMoney(seller.totalDealValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">Cash collected{seller.cashPartial ? ' · parcial' : ''}</p>
            <p className="font-medium text-sm text-foreground" data-testid="legacy-cash">{rankingMoney(seller.cashCollected)}</p>
            {seller.goal > 0 && <p className="text-xs text-muted-foreground mt-2">Realizado da meta: {rankingMoney(seller.totalSales)} / {rankingMoney(seller.goal)}</p>}
            {seller.remaining > 0 && (
              <p className="text-xs text-muted-foreground">Faltam R$ {seller.remaining.toLocaleString('pt-BR')}</p>
            )}
            {seller.remaining === 0 && seller.goal > 0 && (
              <p className="text-xs text-success-text">🎉 Meta batida!</p>
            )}
          </div>

        </div>
      ))}
    </div>
  );
}
