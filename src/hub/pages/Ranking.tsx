import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, Trophy } from 'lucide-react';
import { useSalesRanking } from '@/hooks/useSalesRanking';
import { TeamGoalBar } from '@/components/ranking/TeamGoalBar';
import { RankingPodium } from '@/components/ranking/RankingPodium';
import { RankingList } from '@/components/ranking/RankingList';
import { TeamRankingList } from '@/components/ranking/TeamRankingList';
import { OvertakeNotifications } from '@/components/ranking/OvertakeNotifications';
import { SaleNotifications } from '@/components/ranking/SaleNotifications';
import { CelebrationOverlay } from '@/components/CelebrationOverlay';
import { SoundControlPanel } from '@/components/SoundControlPanel';
import TVWorkspace from '../../components/tv/TVWorkspace';

export default function RankingPage() {
  const [view, setView] = useState('tv');
  return <><nav className="tv-ranking-tabs" aria-label="Visualização do ranking"><button aria-pressed={view === 'tv'} onClick={() => setView('tv')}>TV Mode</button><button aria-pressed={view === 'ranking'} onClick={() => setView('ranking')}>Ranking comercial</button></nav>{view === 'tv' ? <TVWorkspace /> : <LegacyRanking />}</>;
}

function LegacyRanking() {
  const [liveMode, setLiveMode] = useState(false);
  const { data, notifications, saleNotifications, celebrationEvent, handleCelebrationDone } = useSalesRanking();

  const toggleLiveMode = useCallback(() => {
    if (!liveMode) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
    setLiveMode(!liveMode);
  }, [liveMode]);

  return (
    <div className={`${liveMode ? 'fixed inset-0 z-50' : ''} min-h-screen overflow-auto bg-transparent`}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl animate-pulse bg-primary/10" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse bg-secondary/10" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl animate-pulse bg-primary/5" style={{ animationDelay: '2s' }} />
      </div>

      <CelebrationOverlay event={celebrationEvent} onDone={handleCelebrationDone} />
      <OvertakeNotifications notifications={notifications} />
      <SaleNotifications sales={saleNotifications} variant={liveMode ? 'tv' : 'default'} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Sales Ranking</h1>
          </div>
          <div className="flex gap-2 items-center">
            <SoundControlPanel variant={liveMode ? 'tv' : 'default'} />
            <Button variant="ghost" size="sm" onClick={toggleLiveMode} className="text-muted-foreground hover:text-foreground gap-1.5">
              {liveMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {liveMode ? 'Sair' : 'Ampliar ranking'}
            </Button>
          </div>
        </div>

        <TeamGoalBar
          totalTeamSales={data.totalTeamSales}
          teamGoal={data.teamGoal}
          teamProgress={data.teamProgress}
          weeksRemaining={data.weeksRemaining}
          extraDays={data.extraDays}
          hyperGoal={data.monthlyHyperGoal}
          cashCollected={data.teamCashCollected}
          cashCollectedPct={data.teamCashCollectedPct}
        />

        <TeamRankingList />

        {data.directoryAvailable ? <><RankingPodium sellers={data.sellers} /><RankingList sellers={data.sellers} /></> : <div className="glass-card p-8 text-center text-muted-foreground" role="status">{data.directoryLoading ? 'Carregando vendedores do ranking…' : 'Ranking de vendedores indisponível: não foi possível confirmar os participantes.'}</div>}
      </div>
    </div>
  );
}
