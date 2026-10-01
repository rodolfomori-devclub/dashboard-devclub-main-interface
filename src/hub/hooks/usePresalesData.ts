import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchAllRows, HISTORY_STALE_TIME } from '@/lib/fetchAllRows';

// ─── Pre-Sales KPIs ───
export const usePresalesKpis = (sellerId?: string) => useQuery({
  queryKey: ['presales_kpis', sellerId],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows(() => {
    let query = supabase.from('presales_kpis' as any).select('*', { count: 'exact' });
    if (sellerId) query = query.eq('seller_id', sellerId);
    return query;
  }, { signal }),
  enabled: !!sellerId,
});

export const useAllPresalesKpis = () => useQuery({
  queryKey: ['presales_kpis'],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows(() => supabase.from('presales_kpis' as any).select('*', { count: 'exact' }), { signal }),
});

export const useUpsertPresalesKpi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kpi: any) => {
      const { error } = await supabase.from('presales_kpis' as any).upsert(kpi, { onConflict: 'seller_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presales_kpis'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar KPI: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Pre-Sales Targets ───
export const usePresalesTargets = () => useQuery({
  queryKey: ['presales_targets'],
  queryFn: async () => {
    const { data, error } = await supabase.from('presales_targets' as any).select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data as unknown as { id: string; target_leads_per_day: number; target_followups_per_day: number; target_calls_scheduled_per_day: number } | null;
  },
});

export const useUpdatePresalesTargets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id?: string; target_leads_per_day: number; target_followups_per_day: number; target_calls_scheduled_per_day: number }) => {
      if (t.id) {
        const { id, ...rest } = t;
        const { error } = await supabase.from('presales_targets' as any).update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('presales_targets' as any).insert(t);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['presales_targets'] });
      toast.success('Metas de pré-vendas atualizadas');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar metas: ' + (err.message || 'Tente novamente'));
    },
  });
};
