import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSales, useProfiles, useTeamSettings } from '@/hooks/useSupabaseData';
import { useGoals } from '@/hooks/useGoals';
import { audioManager } from '@/lib/audioManager';
import { parseLocalDate, getCashCollected } from '@/lib/utils';
import { filterVisibleProfiles } from '@/lib/hiddenUsers';
import type { CelebrationEvent } from '@/components/CelebrationOverlay';
import type { SaleNotificationData } from '@/components/ranking/SaleNotifications';
import { STORAGE_KEYS } from '@/lib/storage';

export interface SellerRank {
  id: string;
  name: string;
  initials: string;
  avatarUrl?: string | null;
  totalSales: number;
  totalDealValue: number;
  cashCollectedPct: number;
  goal: number;
  goalProgress: number;
  remaining: number;
}


export interface OvertakeNotification {
  id: string;
  message: string;
  timestamp: number;
}

const MILESTONE_KEY = STORAGE_KEYS.milestones;

function loadMilestones(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(MILESTONE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveMilestone(key: string) {
  const m = loadMilestones();
  m[key] = true;
  localStorage.setItem(MILESTONE_KEY, JSON.stringify(m));
}

function hasMilestone(key: string): boolean {
  return !!loadMilestones()[key];
}

export function useSalesRanking() {
  const [notifications, setNotifications] = useState<OvertakeNotification[]>([]);
  const [saleNotifications, setSaleNotifications] = useState<SaleNotificationData[]>([]);
  const [celebrationEvent, setCelebrationEvent] = useState<CelebrationEvent | null>(null);
  const prevRankRef = useRef<string[]>([]);
  const prevSalesCountRef = useRef<number>(0);
  const prevSaleIdsRef = useRef<Set<string>>(new Set());
  const prevLeaderRef = useRef<string | null>(null);
  const celebrationQueue = useRef<CelebrationEvent[]>([]);
  const isCelebrating = useRef(false);

  const { data: allSalesRaw = [] } = useSales();
  const { data: profilesRaw = [], isSuccess: directoryAvailable, isPending: directoryLoading } = useProfiles();
  // The company goal still includes all genuine sales; participation only changes people rankings.
  const allSales = allSalesRaw;
  const profiles = useMemo(() => filterVisibleProfiles(profilesRaw as any[]), [profilesRaw]);
  const { data: settingsRaw } = useTeamSettings();
  const { data: goals } = useGoals();

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const data = useMemo(() => {
    const settings = settingsRaw || { team_goal: 0 };
    const users = directoryAvailable ? profiles.filter((u: any) => (u.role === 'vendedor' || u.role === 'pre-vendedor') && u.active) : [];
    const monthSales = allSales.filter((s: any) => {
      const d = parseLocalDate(s.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const totalTeamSales = monthSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
    // Cash collected geral do time (dinheiro de fato recebido)
    const teamCashCollected = monthSales.reduce((sum: number, s: any) => sum + getCashCollected(s), 0);
    const teamCashCollectedPct = totalTeamSales > 0 ? Math.round((teamCashCollected / totalTeamSales) * 100) : 0;

    // Prefer monthly_goals (configurable per month) over global team_settings
    const teamGoal = goals?.team_goal || settings.team_goal || 0;
    const monthlyHyperGoal = goals?.monthly_hyper_goal || 0;
    const teamProgress = teamGoal > 0 ? Math.round((totalTeamSales / teamGoal) * 100) : 0;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = lastDay - now.getDate();
    const weeksRemaining = Math.floor(daysRemaining / 7);
    const extraDays = daysRemaining % 7;

    // Daily pace: ideal daily sales = goal / business days in month (~22)
    const businessDays = 22;

    const sellers: SellerRank[] = users.map((u: any) => {
      const userSales = monthSales.filter((s: any) => s.seller_id === u.id);
      const total = userSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      // Cash Collected = dinheiro DE FATO recebido (qualquer plataforma).
      // Valores pendentes/futuros NÃO contam.
      const hublaCashCollected = userSales.reduce(
        (sum: number, s: any) => sum + getCashCollected(s),
        0,
      );

      // Valor vendido = soma do valor total negociado de todas as vendas
      const totalDealValue = userSales.reduce((sum: number, s: any) => {
        const cash = Number(s.amount) || 0;
        const outstanding = Number(s.future_outstanding_value) || 0;
        const deal = Number(s.total_sale_value) || (cash + outstanding);
        return sum + deal;
      }, 0);
      const cashCollectedPct = totalDealValue > 0 ? Math.round((hublaCashCollected / totalDealValue) * 100) : 0;

      const goal = Number(u.individual_goal) || 0;

      // Today's sales for pace tracking
      const todaySales = userSales
        .filter((s: any) => {
          const d = parseLocalDate(s.date);
          return d.getDate() === now.getDate();
        })
        .reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      const dailyPaceGoal = goal > 0 ? Math.round(goal / businessDays) : 0;

      return {
        id: u.id, name: u.name,
        initials: u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        avatarUrl: u.avatar_url || null,
        totalSales: total,
        totalDealValue,
        cashCollectedPct,
        goal,
        goalProgress: goal > 0 ? Math.round((total / goal) * 100) : 0,
        remaining: Math.max(0, goal - total),
        todaySales,
        dailyPaceGoal,
      };
    }).sort((a, b) => b.totalSales - a.totalSales);


    return { sellers, totalTeamSales, teamCashCollected, teamCashCollectedPct, teamGoal, monthlyHyperGoal, teamProgress, daysRemaining, weeksRemaining, extraDays, salesCount: monthSales.length, monthSales, users, directoryAvailable, directoryLoading };
  }, [allSales, profiles, settingsRaw, goals, directoryAvailable, directoryLoading]);

  const queueCelebration = useCallback((event: CelebrationEvent) => {
    celebrationQueue.current.push(event);
    if (!isCelebrating.current) {
      isCelebrating.current = true;
      setCelebrationEvent(celebrationQueue.current.shift()!);
    }
  }, []);

  const handleCelebrationDone = useCallback(() => {
    if (celebrationQueue.current.length > 0) {
      setCelebrationEvent(celebrationQueue.current.shift()!);
    } else {
      setCelebrationEvent(null);
      isCelebrating.current = false;
    }
  }, []);

  // Detect milestones
  useEffect(() => {
    const currentSaleIds = new Set(data.monthSales.map((s: any) => s.id));

    if (prevSalesCountRef.current === 0) {
      prevRankRef.current = data.sellers.map(s => s.id);
      prevSalesCountRef.current = data.salesCount;
      prevLeaderRef.current = data.sellers[0]?.id || null;
      prevSaleIdsRef.current = currentSaleIds;
      return;
    }

    const isNewData = data.salesCount > prevSalesCountRef.current;

    if (isNewData) {
      // Detect new sales
      const newSales = data.monthSales.filter((s: any) => !prevSaleIdsRef.current.has(s.id) && data.users.some((user: any) => user.id === s.seller_id));

      newSales.forEach((sale: any, i: number) => {
        const seller = data.users.find((u: any) => u.id === sale.seller_id);
        const sellerName = seller?.name || 'Vendedor';
        const sellerInitials = sellerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

        setTimeout(() => audioManager.playCelebration(), i * 600);

        setSaleNotifications(prev => [...prev, {
          id: sale.id,
          sellerName,
          sellerInitials,
          sellerAvatarUrl: seller?.avatar_url || null,
          amount: Number(sale.amount),
          product: sale.product || 'Produto',
          timestamp: Date.now() + i * 200,
        }]);
      });

      // Check overtakes → full-screen celebration
      const currentRank = data.sellers.map(s => s.id);
      if (prevRankRef.current.length > 0) {
        currentRank.forEach((id, newPos) => {
          const oldPos = prevRankRef.current.indexOf(id);
          if (oldPos > newPos && oldPos !== -1) {
            const seller = data.sellers.find(s => s.id === id);
            const overtaken = data.sellers[newPos + 1];
            if (seller && overtaken) {
              audioManager.playOvertake();
              // Toast notification
              setNotifications(prev => [...prev, {
                id: `${Date.now()}-${id}`,
                message: `🏎️ ${seller.name} ultrapassou ${overtaken.name} e agora está em ${newPos + 1}º lugar!`,
                timestamp: Date.now(),
              }]);
              // Full-screen celebration for overtakes
              const milestoneKey = `overtake-${todayKey}-${id}-${newPos}`;
              if (!hasMilestone(milestoneKey)) {
                saveMilestone(milestoneKey);
                setTimeout(() => {
                  queueCelebration({
                    type: 'overtake',
                    sellerName: seller.name,
                    sellerInitials: seller.initials,
                    overtakenName: overtaken.name,
                    newPosition: newPos + 1,
                  });
                }, 1000);
              }
            }
          }
        });
      }

      // EVENT: New leader
      const currentLeader = data.sellers[0];
      if (currentLeader && prevLeaderRef.current && currentLeader.id !== prevLeaderRef.current) {
        const milestoneKey = `leader-${monthKey}-${currentLeader.id}`;
        if (!hasMilestone(milestoneKey)) {
          saveMilestone(milestoneKey);
          setTimeout(() => {
            audioManager.playNewLeader();
            queueCelebration({
              type: 'new-leader',
              sellerName: currentLeader.name,
              sellerInitials: currentLeader.initials,
            });
          }, 1500);
        }
      }

      // EVENT: Individual goal achieved
      data.sellers.forEach(seller => {
        if (seller.goal > 0 && seller.totalSales >= seller.goal) {
          const milestoneKey = `goal-${monthKey}-${seller.id}`;
          if (!hasMilestone(milestoneKey)) {
            saveMilestone(milestoneKey);
            setTimeout(() => {
              audioManager.playGoalAchieved();
              queueCelebration({
                type: 'goal-achieved',
                sellerName: seller.name,
                sellerInitials: seller.initials,
              });
            }, 2000);
          }
        }
      });

      // EVENT: Daily pace achieved
      data.sellers.forEach((seller: any) => {
        if (seller.dailyPaceGoal > 0 && seller.todaySales >= seller.dailyPaceGoal) {
          const milestoneKey = `pace-${todayKey}-${seller.id}`;
          if (!hasMilestone(milestoneKey)) {
            saveMilestone(milestoneKey);
            setTimeout(() => {
              audioManager.playPaceAchieved();
              queueCelebration({
                type: 'pace-achieved',
                sellerName: seller.name,
                sellerInitials: seller.initials,
              });
            }, 2500);
          }
        }
      });

      // EVENT: Team milestones (50%, 70%, 100%)
      if (data.teamGoal > 0) {
        // 50%
        if (data.totalTeamSales >= data.teamGoal * 0.5) {
          const milestoneKey = `team-50-${monthKey}`;
          if (!hasMilestone(milestoneKey)) {
            saveMilestone(milestoneKey);
            setTimeout(() => {
              audioManager.playTeamMilestone();
              queueCelebration({ type: 'team-milestone-50', teamGoalValue: data.teamGoal });
            }, 3000);
          }
        }

        // 70%
        if (data.totalTeamSales >= data.teamGoal * 0.7) {
          const milestoneKey = `team-70-${monthKey}`;
          if (!hasMilestone(milestoneKey)) {
            saveMilestone(milestoneKey);
            setTimeout(() => {
              audioManager.playTeamMilestone();
              queueCelebration({ type: 'team-milestone-70', teamGoalValue: data.teamGoal });
            }, 3500);
          }
        }

        // 100%
        if (data.totalTeamSales >= data.teamGoal) {
          const milestoneKey = `team-goal-${monthKey}`;
          if (!hasMilestone(milestoneKey)) {
            saveMilestone(milestoneKey);
            setTimeout(() => {
              audioManager.playTeamGoalAchieved();
              queueCelebration({ type: 'team-goal', teamGoalValue: data.teamGoal });
            }, 4000);
          }
        }
      }
    }

    prevRankRef.current = data.sellers.map(s => s.id);
    prevSalesCountRef.current = data.salesCount;
    prevLeaderRef.current = data.sellers[0]?.id || null;
    prevSaleIdsRef.current = currentSaleIds;
  }, [data.salesCount, data.sellers, data.monthSales, data.users, data.teamGoal, data.totalTeamSales, monthKey, todayKey, queueCelebration]);

  // Auto-remove overtake notifications
  useEffect(() => {
    if (notifications.length === 0) return;
    const timer = setTimeout(() => {
      setNotifications(prev => prev.filter(n => Date.now() - n.timestamp < 5000));
    }, 5000);
    return () => clearTimeout(timer);
  }, [notifications]);

  // Auto-remove sale notifications after 5s
  useEffect(() => {
    if (saleNotifications.length === 0) return;
    const timer = setTimeout(() => {
      setSaleNotifications(prev => prev.filter(n => Date.now() - n.timestamp < 5000));
    }, 5000);
    return () => clearTimeout(timer);
  }, [saleNotifications]);

  return { data, notifications, saleNotifications, celebrationEvent, handleCelebrationDone };
}
