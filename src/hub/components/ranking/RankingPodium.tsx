import type { SellerRank } from '@/hooks/useSalesRanking';
import { SellerAvatar } from '@/components/SellerAvatar';

interface RankingPodiumProps {
  sellers: SellerRank[];
}

export function RankingPodium({ sellers }: RankingPodiumProps) {
  const top3 = sellers.slice(0, 3);
  if (top3.length === 0) return null;

  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumHeights = ['h-20', 'h-28', 'h-16'];
  const podiumColors = [
    'from-gray-400 to-gray-500',
    'from-yellow-400 to-amber-500',
    'from-amber-600 to-orange-700',
  ];
  const podiumBorders = [
    'border-gray-400/50',
    'border-yellow-400/50',
    'border-amber-600/50',
  ];
  const podiumPositions = [2, 1, 3];

  return (
    <div className="flex items-end justify-center gap-4 pt-3 pb-2">
      {podiumOrder.map((seller, i) => {
        if (!seller) return null;
        const pos = podiumPositions[i];
        const isFirst = pos === 1;
        return (
          <div key={seller.id} className="flex flex-col items-center" style={{ width: isFirst ? '200px' : '170px' }}>
            <div className={`relative mb-3 ${isFirst ? 'scale-110' : ''}`}>
              {isFirst && (
                <div className="absolute -inset-2 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 rounded-full blur-md opacity-40 animate-pulse" />
              )}
              <div className="relative">
                <SellerAvatar
                  name={seller.name}
                  avatarUrl={seller.avatarUrl}
                  size="lg"
                  borderColor={podiumBorders[i]}
                />
                <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  pos === 1 ? 'bg-yellow-400 text-black' : pos === 2 ? 'bg-gray-300 text-black' : 'bg-amber-600 text-white'
                }`}>
                  {pos}º
                </div>
              </div>
            </div>
            <p className="font-semibold text-sm text-center truncate w-full text-foreground">{seller.name}</p>
            <p className="text-lg font-bold text-primary">
              R$ {seller.totalSales.toLocaleString('pt-BR')}
            </p>
            <p className="text-[11px] text-muted-foreground">({seller.cashCollectedPct}% de CC)</p>
            <p className="text-xs text-muted-foreground">{seller.goalProgress}% da meta</p>

            <div className={`mt-3 w-full ${podiumHeights[i]} rounded-t-xl bg-gradient-to-t ${podiumColors[i]} opacity-20 border-t border-x border-border`} />
          </div>
        );
      })}
    </div>
  );
}
