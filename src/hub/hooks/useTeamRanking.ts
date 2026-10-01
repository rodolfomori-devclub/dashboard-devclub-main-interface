import { useMemo } from 'react';
import { useSales, useProfiles } from '@/hooks/useSupabaseData';
import { useTeams } from '@/hooks/useTeams';
import { useTeamGoals } from '@/hooks/useTeamGoals';
import { parseLocalDate } from '@/lib/utils';
import { filterVisibleProfiles, filterVisibleSales } from '@/lib/hiddenUsers';

export interface TeamRank {
  id: string | null;
  name: string;
  image_url: string;
  totalSales: number;
  salesCount: number;
  goal: number;
  hyperGoal: number;
  progress: number;
  remaining: number;
  memberIds: string[];
  hublaTotal: number;
  voompTotal: number;
  tmbTotal: number;
  hublaPct: number;
  voompPct: number;
  tmbPct: number;
}

export const useTeamRanking = (month?: number, year?: number) => {
  const { data: salesRaw = [] } = useSales();
  const { data: profilesRaw = [], isSuccess: directoryAvailable, isPending: directoryLoading } = useProfiles();
  const sales = useMemo(() => filterVisibleSales(salesRaw as any[], profilesRaw as any[]), [salesRaw, profilesRaw]);
  const profiles = useMemo(() => filterVisibleProfiles(profilesRaw as any[]), [profilesRaw]);
  const { data: teams = [] } = useTeams(false);
  const { data: goals = [] } = useTeamGoals(month, year);

  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();

  const ranks = useMemo(() => {
    if (!directoryAvailable) return [];
    const monthSales = sales.filter((s: any) => {
      const d = parseLocalDate(s.date);
      return d.getMonth() + 1 === m && d.getFullYear() === y;
    });

    const sellerToTeam = new Map<string, string | null>();
    profiles.forEach((p: any) => sellerToTeam.set(p.id, p.team_id || null));

    const goalByTeam = new Map<string, any>();
    (goals as any[]).forEach((g) => goalByTeam.set(g.team_id, g));

    const teamMembers = new Map<string, string[]>();
    profiles.forEach((p: any) => {
      if (!p.team_id) return;
      if (!teamMembers.has(p.team_id)) teamMembers.set(p.team_id, []);
      teamMembers.get(p.team_id)!.push(p.id);
    });

    const teamOf = (s: any) => s.team_id || sellerToTeam.get(s.seller_id) || null;

    const ranks: TeamRank[] = teams.map((t) => {
      const teamSales = monthSales.filter((s: any) => teamOf(s) === t.id);
      const total = teamSales.reduce((sum, s: any) => sum + Number(s.amount || 0), 0);
      const hublaTotal = teamSales.reduce((sum, s: any) => {
        const p = String(s.platform || '');
        return sum + (p.includes('Hubla') ? Number(s.amount || 0) : 0);
      }, 0);
      const voompTotal = teamSales.reduce((sum, s: any) => {
        const p = String(s.platform || '');
        return sum + (p.includes('Voomp') ? Number(s.amount || 0) : 0);
      }, 0);
      const tmbTotal = teamSales.reduce((sum, s: any) => {
        const p = String(s.platform || '');
        return sum + (p.includes('TMB') ? Number(s.amount || 0) : 0);
      }, 0);
      const g = goalByTeam.get(t.id);
      const goal = Number(g?.monthly_goal || 0);
      const hyperGoal = Number(g?.monthly_hyper_goal || 0);
      return {
        id: t.id,
        name: t.name,
        image_url: t.image_url,
        totalSales: total,
        salesCount: teamSales.length,
        goal,
        hyperGoal,
        progress: goal > 0 ? Math.round((total / goal) * 100) : 0,
        remaining: Math.max(0, goal - total),
        memberIds: teamMembers.get(t.id) || [],
        hublaTotal,
        voompTotal,
        tmbTotal,
        hublaPct: total > 0 ? Math.round((hublaTotal / total) * 100) : 0,
        voompPct: total > 0 ? Math.round((voompTotal / total) * 100) : 0,
        tmbPct: total > 0 ? Math.round((tmbTotal / total) * 100) : 0,
      };
    });

    // No-team bucket
    const noTeamSales = monthSales.filter((s: any) => !teamOf(s));
    if (noTeamSales.length > 0) {
      const total = noTeamSales.reduce((sum, s: any) => sum + Number(s.amount || 0), 0);
      ranks.push({
        id: null,
        name: 'Sem Time',
        image_url: '',
        totalSales: total,
        salesCount: noTeamSales.length,
        goal: 0,
        hyperGoal: 0,
        progress: 0,
        remaining: 0,
        memberIds: [],
        hublaTotal: 0,
        voompTotal: 0,
        tmbTotal: 0,
        hublaPct: 0,
        voompPct: 0,
        tmbPct: 0,
      });
    }

    ranks.sort((a, b) => b.totalSales - a.totalSales);
    return ranks;
  }, [sales, profiles, teams, goals, m, y, directoryAvailable]);
  return { ranks, directoryAvailable, directoryLoading };
};
