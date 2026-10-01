import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TeamGoal {
  id?: string;
  team_id: string;
  month: number;
  year: number;
  monthly_goal: number;
  monthly_hyper_goal: number;
  weekly_goal: number;
  daily_goal: number;
}

export const useTeamGoals = (month?: number, year?: number) => {
  const now = new Date();
  const m = month ?? now.getMonth() + 1;
  const y = year ?? now.getFullYear();
  return useQuery({
    queryKey: ['team_goals', m, y],
    queryFn: async (): Promise<TeamGoal[]> => {
      const { data, error } = await supabase
        .from('team_goals' as any)
        .select('*')
        .eq('month', m)
        .eq('year', y);
      if (error) throw error;
      return (data as unknown as TeamGoal[]) || [];
    },
  });
};

export const useUpsertTeamGoal = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (g: TeamGoal) => {
      const { error } = await supabase.from('team_goals' as any).upsert(
        {
          team_id: g.team_id,
          month: g.month,
          year: g.year,
          monthly_goal: g.monthly_goal,
          monthly_hyper_goal: g.monthly_hyper_goal,
          weekly_goal: g.weekly_goal,
          daily_goal: g.daily_goal,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id,month,year' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_goals'] });
      toast.success('Meta do time salva');
    },
    onError: (err: any) => toast.error('Erro ao salvar meta: ' + (err.message || '')),
  });
};
