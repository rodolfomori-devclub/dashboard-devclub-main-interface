import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CommercialGoals {
  id?: string;
  month: number; // 1-12
  year: number;
  team_goal: number;
  monthly_hyper_goal: number;
  weekly_goal: number;
  daily_goal: number;
  daily_special_bonus_threshold?: number;

  cash_collected_target?: number;
}

export const DEFAULT_GOALS: Omit<CommercialGoals, 'month' | 'year'> = {
  team_goal: 0,
  monthly_hyper_goal: 0,
  weekly_goal: 70000,
  daily_goal: 14000,
  daily_special_bonus_threshold: 0,

  cash_collected_target: 0,
};

/**
 * Resolve goals for a given month/year.
 * Fallback strategy: if no record for the requested month exists,
 * return the most recently configured month as a template (so the
 * dashboard never shows zero metas just because the month wasn't set up yet).
 */
export const useGoals = (month?: number, year?: number) => {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();

  return useQuery({
    queryKey: ['commercial-goals', m, y],
    queryFn: async (): Promise<CommercialGoals & { isFallback: boolean }> => {
      // 1. Exact match
      const { data: exact } = await supabase
        .from('monthly_goals' as any)
        .select('*')
        .eq('month', m)
        .eq('year', y)
        .maybeSingle();

      if (exact) {
        return { ...(exact as any), isFallback: false } as CommercialGoals & { isFallback: boolean };
      }

      // 2. Fallback: most recent configured month
      const { data: latest } = await supabase
        .from('monthly_goals' as any)
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest) {
        return { ...(latest as any), month: m, year: y, isFallback: true } as CommercialGoals & { isFallback: boolean };
      }

      // 3. Hard defaults
      return { month: m, year: y, ...DEFAULT_GOALS, isFallback: true };
    },
  });
};

export const useAllGoals = () => {
  return useQuery({
    queryKey: ['commercial-goals', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_goals' as any)
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false });
      if (error) throw error;
      return (data as unknown as CommercialGoals[]) || [];
    },
  });
};

export const useUpsertGoals = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: CommercialGoals) => {
      const { error } = await supabase
        .from('monthly_goals' as any)
        .upsert(
          {
            month: g.month,
            year: g.year,
            team_goal: g.team_goal,
            monthly_hyper_goal: g.monthly_hyper_goal,
            weekly_goal: g.weekly_goal,
            daily_goal: g.daily_goal,
            daily_special_bonus_threshold: g.daily_special_bonus_threshold ?? 0,

            cash_collected_target: g.cash_collected_target ?? 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'month,year' }
        );
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['commercial-goals'] }),
        qc.invalidateQueries({ queryKey: ['monthly_goals'] }),
        qc.invalidateQueries({ queryKey: ['monthly-goal'] }),
        qc.invalidateQueries({ queryKey: ['sales-ranking'] }),
        qc.invalidateQueries({ queryKey: ['sales'] }),
      ]);
      await qc.refetchQueries({ queryKey: ['commercial-goals'] });
      toast.success('Metas salvas com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar metas: ' + (err.message || 'Tente novamente'));
    },
  });
};
