import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchAllRows, HISTORY_STALE_TIME } from '@/lib/fetchAllRows';

// ─── Profiles ───
export const useProfiles = () => useQuery({
  queryKey: ['profiles'],
  queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('name');
    if (error) throw error;
    return data ?? [];
  },
  networkMode: 'always',
  retry: 1,
  refetchOnWindowFocus: true,
});

export const useUpdateProfile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; individual_goal?: number; avatar_url?: string | null; team_id?: string | null }) => {
      const changes = Object.fromEntries(['individual_goal', 'team_id', 'avatar_url']
        .filter(key => Object.hasOwn(p, key)).map(key => [key, p[key as keyof typeof p]]));
      const { error } = await supabase.from('profiles').update(changes).eq('id', p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles'] });
      toast.success('Perfil atualizado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar perfil: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Sales ───
export const useSales = () => useQuery({
  queryKey: ['sales'],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows(() => supabase.from('sales').select('*', { count: 'exact' }).order('date', { ascending: false }), { signal }),
});

// ─── Products ───
export const useProducts = () => useQuery({
  queryKey: ['products'],
  queryFn: async () => {
    const { data, error } = await supabase.from('products').select('*').order('name');
    if (error) throw error;
    return data ?? [];
  },
});

export const useAddProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { name: string; commission_rate: number }) => {
      const { error } = await supabase.from('products').insert(p);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto adicionado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar produto: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useUpdateProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { id: string; name?: string; commission_rate?: number }) => {
      const { id, ...rest } = p;
      const { error } = await supabase.from('products').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto atualizado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar produto: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteProduct = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produto removido com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover produto: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Team Settings ───
export const useTeamSettings = () => useQuery({
  queryKey: ['team_settings'],
  queryFn: async () => {
    const { data, error } = await supabase.from('team_settings').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data as { id: string; team_goal: number; origins: string[] } | null;
  },
});

export const useUpdateTeamSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: { id?: string; team_goal: number; origins: string[] }) => {
      if (s.id) {
        const { error } = await supabase.from('team_settings').update({ team_goal: s.team_goal, origins: s.origins }).eq('id', s.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('team_settings').insert({ team_goal: s.team_goal, origins: s.origins });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team_settings'] });
      toast.success('Configurações salvas com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar configurações: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Materials ───
export const useMaterials = () => useQuery({
  queryKey: ['materials'],
  queryFn: async () => {
    const { data, error } = await supabase.from('materials').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const useAddMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { title: string; description: string; category: string; url: string; type: string }) => {
      const { error } = await supabase.from('materials').insert(m);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material adicionado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar material: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useUpdateMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: { id: string; title: string; description: string; url: string }) => {
      const { id, ...rest } = m;
      const { error } = await supabase.from('materials').update(rest).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material atualizado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar material: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteMaterial = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['materials'] });
      toast.success('Material removido com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover material: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Announcements ───
export const useAnnouncements = () => useQuery({
  queryKey: ['announcements'],
  queryFn: async () => {
    const { data, error } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
});

export const useAddAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { title: string; content: string; author_id: string }) => {
      const { error } = await supabase.from('announcements').insert(a);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Comunicado publicado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao publicar comunicado: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteAnnouncement = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Comunicado removido com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover comunicado: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Daily KPIs ───
export const useDailyKpis = (sellerId?: string) => useQuery({
  queryKey: ['daily_kpis', sellerId],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows(() => {
    let query = supabase.from('daily_kpis').select('*', { count: 'exact' });
    if (sellerId) query = query.eq('seller_id', sellerId);
    return query;
  }, { signal }),
  enabled: !!sellerId,
});

export const useAllDailyKpis = () => useQuery({
  queryKey: ['daily_kpis'],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows(() => supabase.from('daily_kpis').select('*', { count: 'exact' }), { signal }),
});

export const useUpsertDailyKpi = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (kpi: { seller_id: string; date: string; leads: number; leads_disqualified: number; calls_scheduled: number; calls_completed: number; sales: number; sales_scheduled: number; follows: number; rejections: number }) => {
      const { error } = await supabase.from('daily_kpis').upsert(kpi, { onConflict: 'seller_id,date' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily_kpis'] });
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar KPI: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Daily Targets ───
export const useDailyTargets = () => useQuery({
  queryKey: ['daily_targets'],
  queryFn: async () => {
    const { data, error } = await supabase.from('daily_targets').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data as { id: string; target_leads_per_day: number; target_calls_scheduled: number; target_calls_completed: number; target_sales_per_day: number } | null;
  },
});

export const useUpdateDailyTargets = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: { id?: string; target_leads_per_day: number; target_calls_scheduled: number; target_calls_completed: number; target_sales_per_day: number }) => {
      if (t.id) {
        const { id, ...rest } = t;
        const { error } = await supabase.from('daily_targets').update(rest).eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('daily_targets').insert(t);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['daily_targets'] });
      toast.success('Metas diárias atualizadas com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar metas diárias: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Sales Links ───
export const useSalesLinks = (sellerId?: string) => useQuery({
  queryKey: ['sales_links', sellerId],
  queryFn: async () => {
    let query = supabase.from('sales_links').select('*');
    if (sellerId) query = query.eq('seller_id', sellerId);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },
});

export const useAddSalesLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (link: { seller_id: string; product_name: string; link_url: string; price?: number }) => {
      const { error } = await supabase.from('sales_links').insert(link as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_links'] });
      toast.success('Link adicionado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar link: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useUpdateSalesLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; product_name?: string; link_url?: string; price?: number }) => {
      const { error } = await supabase.from('sales_links').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_links'] });
      toast.success('Link atualizado com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar link: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteSalesLink = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sales_links').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales_links'] });
      toast.success('Link removido com sucesso');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover link: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Monthly Income ───
export const useMonthlyIncome = (sellerId: string, month: number, year: number) => useQuery({
  queryKey: ['monthly_income', sellerId, month, year],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('monthly_income')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('month', month + 1)
      .eq('year', year)
      .maybeSingle();
    if (error) throw error;
    return data;
  },
  enabled: !!sellerId,
});

export const useUpsertMonthlyIncome = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (income: { seller_id: string; month: number; year: number; fixed_salary: number }) => {
      const { error } = await supabase
        .from('monthly_income')
        .upsert(income as any, { onConflict: 'seller_id,month,year' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['monthly_income'] });
      toast.success('Salário fixo salvo');
    },
    onError: (err: any) => {
      toast.error('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Seller Bonuses ───
export const useSellerBonuses = (sellerId: string, month: number, year: number) => useQuery({
  queryKey: ['seller_bonuses', sellerId, month, year],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('seller_bonuses')
      .select('*')
      .eq('seller_id', sellerId)
      .eq('month', month + 1)
      .eq('year', year)
      .order('bonus_date', { ascending: false });
    if (error) throw error;
    return data ?? [];
  },
  enabled: !!sellerId,
});

export const useAddSellerBonus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bonus: { seller_id: string; month: number; year: number; amount: number; category: string; description: string; bonus_date: string }) => {
      const { error } = await supabase.from('seller_bonuses').insert(bonus as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller_bonuses'] });
      toast.success('Bônus adicionado');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar bônus: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteSellerBonus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('seller_bonuses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['seller_bonuses'] });
      toast.success('Bônus removido');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover bônus: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Commission Observations ───
export const useCommissionObservations = (sellerId: string, month: number, year: number) => useQuery({
  queryKey: ['commission_observations', sellerId, month, year],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('commission_observations' as any)
      .select('*')
      .eq('seller_id', sellerId)
      .eq('month', month + 1)
      .eq('year', year)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  },
  enabled: !!sellerId,
});

export const useAddCommissionObservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (obs: { seller_id: string; month: number; year: number; type: string; description: string; amount: number }) => {
      const { error } = await supabase.from('commission_observations' as any).insert(obs as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission_observations'] });
      toast.success('Observação adicionada');
    },
    onError: (err: any) => {
      toast.error('Erro ao adicionar observação: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useDeleteCommissionObservation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('commission_observations' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission_observations'] });
      toast.success('Observação removida');
    },
    onError: (err: any) => {
      toast.error('Erro ao remover observação: ' + (err.message || 'Tente novamente'));
    },
  });
};

// ─── Commission Installments ───
export const useCommissionInstallments = (sellerId?: string, month?: number, year?: number) => useQuery({
  queryKey: ['commission_installments', sellerId, month, year],
  staleTime: HISTORY_STALE_TIME,
  queryFn: async ({ signal }) => {
    const data = await fetchAllRows<any>(() => {
      let query = supabase.from('commission_installments' as any).select('*, sales:sale_id(client_name, client_whatsapp)', { count: 'exact' });
      if (sellerId) query = query.eq('seller_id', sellerId);
      if (month !== undefined) query = query.eq('expected_month', month);
      if (year !== undefined) query = query.eq('expected_year', year);
      return query.order('expected_year').order('expected_month').order('installment_number');
    }, { signal });
    return data.map(row => ({ ...row, client_name: row?.sales?.client_name ?? null, client_whatsapp: row?.sales?.client_whatsapp ?? null }));
  },
});

export const useAllCommissionInstallments = (month?: number, year?: number) => useQuery({
  queryKey: ['all_commission_installments', month, year],
  staleTime: HISTORY_STALE_TIME,
  queryFn: ({ signal }) => fetchAllRows<any>(() => {
    let query = supabase.from('commission_installments' as any).select('*', { count: 'exact' });
    if (month !== undefined) query = query.eq('expected_month', month);
    if (year !== undefined) query = query.eq('expected_year', year);
    return query.order('expected_year').order('expected_month').order('installment_number');
  }, { signal }),
});

export const useUpdateInstallmentStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, validatedBy }: { id: string; status: string; validatedBy?: string }) => {
      const payload: any = { status, updated_at: new Date().toISOString() };
      if (status === 'confirmed' || status === 'not_confirmed' || status === 'cancelled') {
        payload.validated_at = new Date().toISOString();
        if (validatedBy) payload.validated_by = validatedBy;
      }
      const { error } = await supabase
        .from('commission_installments' as any)
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission_installments'] });
      qc.invalidateQueries({ queryKey: ['all_commission_installments'] });
      toast.success('Status da parcela atualizado');
    },
    onError: (err: any) => {
      toast.error('Erro ao atualizar status: ' + (err.message || 'Tente novamente'));
    },
  });
};

export const useMarkInstallmentPaid = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const { error } = await supabase
        .from('commission_installments' as any)
        .update({
          status: 'paid_by_seller',
          marked_paid_at: new Date().toISOString(),
          marked_paid_note: note || '',
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission_installments'] });
      qc.invalidateQueries({ queryKey: ['all_commission_installments'] });
      toast.success('Marcado como pago. Aguardando validação do Gestor/Financeiro.');
    },
    onError: (err: any) => {
      toast.error('Erro ao marcar parcela: ' + (err.message || 'Tente novamente'));
    },
  });
};
