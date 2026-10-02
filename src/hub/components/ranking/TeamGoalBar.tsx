import { rankingMoney } from '@/lib/rankingAmounts';

interface TeamGoalBarProps {
  totalTeamSales: number;
  gross: number | null;
  grossPartial: boolean;
  cashPartial: boolean;
  teamGoal: number;
  teamProgress: number;
  weeksRemaining: number;
  extraDays: number;
  hyperGoal?: number;
  cashCollected?: number | null;
  cashCollectedPct?: number | null;
}

export function TeamGoalBar({ totalTeamSales, gross, grossPartial, cashPartial, teamGoal, teamProgress, weeksRemaining, extraDays, hyperGoal = 0, cashCollected, cashCollectedPct }: TeamGoalBarProps) {

  const isHyperStage = hyperGoal > teamGoal && totalTeamSales >= teamGoal;
  const hyperRange = hyperGoal - teamGoal;
  const hyperCurrent = totalTeamSales - teamGoal;
  const hyperProgress = isHyperStage && hyperRange > 0 ? Math.round((hyperCurrent / hyperRange) * 100) : 0;

  return (
    <div data-testid="legacy-ranking-overall" className={`glass-card p-4 sm:p-6 transition-all duration-500 ${isHyperStage ? 'ring-2 ring-yellow-500/40' : ''}`}
      style={isHyperStage ? { background: 'linear-gradient(135deg, hsla(45,80%,50%,0.06), hsla(30,70%,40%,0.1))' } : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr] mb-6">
        <div><p className="text-sm text-muted-foreground">Valor das vendas{grossPartial ? ' · parcial' : ''}</p><p className="text-3xl sm:text-4xl font-bold text-primary mt-1" data-testid="legacy-gross">{rankingMoney(gross)}</p></div>
        <div><p className="text-sm text-muted-foreground">Cash collected{cashPartial ? ' · parcial' : ''}</p><p className="text-xl sm:text-2xl font-semibold text-foreground mt-1" data-testid="legacy-cash">{rankingMoney(cashCollected)}</p>{cashCollectedPct !== null && cashCollectedPct !== undefined && <p className="text-xs text-muted-foreground mt-1">{cashCollectedPct}% do valor das vendas</p>}</div>
      </div>
      <p className="text-xs text-muted-foreground -mt-3 mb-4">Guru e Hotmart: líquido após taxas; demais: valor contratado.</p>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <p className={`text-sm uppercase tracking-wider font-semibold ${isHyperStage ? 'text-yellow-400/80' : 'text-muted-foreground'}`}>
            {isHyperStage ? '🏆 Hipermeta do Time' : 'Meta do Time'}
          </p>
          <p className="text-xs text-muted-foreground mt-2">Realizado na base da meta</p>
          <p className="text-lg font-semibold mt-1 text-foreground">
            R$ {totalTeamSales.toLocaleString('pt-BR')}
            <span className="text-lg font-normal text-muted-foreground">
              {' '}/ R$ {(isHyperStage ? hyperGoal : teamGoal).toLocaleString('pt-BR')}
            </span>
          </p>
          {isHyperStage && (

            <p className="text-sm text-yellow-400/80 mt-1 font-medium">
              Meta atingida — em busca da hipermeta
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-4xl font-bold ${isHyperStage ? 'text-yellow-400' : 'text-primary'}`}>
            {isHyperStage ? hyperProgress : teamProgress}%
          </p>
          <p className="text-xs mt-1 text-muted-foreground">
            {weeksRemaining > 0 ? `${weeksRemaining} semanas` : ''} {extraDays > 0 ? `${extraDays} dias restantes` : ''}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {isHyperStage ? (
        <div className="space-y-2">
          {/* Base goal completed bar */}
          <div className="relative h-2 rounded-full overflow-hidden bg-muted">
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 w-full" />
          </div>
          {/* Hyper goal progress bar */}
          <div className="relative h-4 rounded-full overflow-hidden bg-muted">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${Math.min(hyperProgress, 100)}%`,
                background: 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 93%, 47%))',
              }}
            />
            <div
              className="absolute inset-y-0 left-0 rounded-full animate-pulse opacity-40"
              style={{
                width: `${Math.min(hyperProgress, 100)}%`,
                background: 'linear-gradient(90deg, hsl(38, 92%, 50%), hsl(45, 93%, 47%))',
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>R$ {teamGoal.toLocaleString('pt-BR')}</span>
            <span className="text-yellow-400 font-semibold">
              Faltam R$ {Math.max(0, hyperGoal - totalTeamSales).toLocaleString('pt-BR')}
            </span>
            <span>R$ {hyperGoal.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      ) : (
        <div className="relative h-4 rounded-full overflow-hidden bg-muted">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-primary to-[var(--brand-grad-end)]"
            style={{ width: `${Math.min(teamProgress, 100)}%` }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full animate-pulse opacity-40 bg-gradient-to-r from-primary to-[var(--brand-grad-end)]"
            style={{ width: `${Math.min(teamProgress, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
