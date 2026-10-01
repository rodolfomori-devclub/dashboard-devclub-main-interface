import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Team {
  id: string;
  name: string;
  image_url: string;
  description: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export const useTeams = (includeArchived = false) =>
  useQuery({
    queryKey: ['teams', includeArchived],
    queryFn: async (): Promise<Team[]> => {
      let q = supabase.from('teams' as any).select('*').order('name');
      if (!includeArchived) q = q.eq('archived', false);
      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as Team[]) || [];
    },
    networkMode: 'always',
    refetchOnWindowFocus: true,
  });

export const useUpsertTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<Team> & { name: string }) => {
      const payload: any = {
        name: t.name,
        image_url: t.image_url ?? '',
        description: t.description ?? '',
        archived: t.archived ?? false,
        updated_at: new Date().toISOString(),
      };
      if (t.id) {
        const { error } = await supabase.from('teams' as any).update(payload).eq('id', t.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('teams' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Time salvo');
    },
    onError: (err: any) => toast.error('Erro ao salvar time: ' + (err.message || '')),
  });
};

export const useArchiveTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase.from('teams' as any).update({ archived }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Time atualizado');
    },
  });
};

export const useDeleteTeam = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('teams' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Time excluído');
    },
  });
};
