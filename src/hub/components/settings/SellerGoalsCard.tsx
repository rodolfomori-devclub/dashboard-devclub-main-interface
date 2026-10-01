import { useEffect, useMemo, useState } from 'react';
import { Users, Save, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProfiles, useUpdateProfile } from '@/hooks/useSupabaseData';
import { SellerAvatar } from '@/components/SellerAvatar';
import { toast } from 'sonner';

const fmtBRL = (raw: string) => {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('pt-BR');
};
const parseBRL = (s: string) => parseFloat((s || '').replace(/\./g, '').replace(',', '.')) || 0;

export function SellerGoalsCard() {
  const { data: profiles = [], isLoading } = useProfiles();
  const updateProfile = useUpdateProfile();

  const sellers = useMemo(
    () => (profiles as any[])
      .filter(p => p.active && p.role === 'vendedor')
      .sort((a, b) => a.name.localeCompare(b.name)),
    [profiles]
  );

  const [values, setValues] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    const next: Record<string, string> = {};
    sellers.forEach((s: any) => {
      next[s.id] = fmtBRL(String(s.individual_goal || ''));
    });
    setValues(next);
  }, [sellers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sellers;
    return sellers.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [sellers, search]);

  const isDirty = (s: any) => parseBRL(values[s.id] || '') !== Number(s.individual_goal || 0);

  const saveOne = async (s: any) => {
    setSavingId(s.id);
    try {
      await updateProfile.mutateAsync({ id: s.id, individual_goal: parseBRL(values[s.id] || '') });
    } finally {
      setSavingId(null);
    }
  };

  const saveAll = async () => {
    const dirty = sellers.filter(isDirty);
    if (dirty.length === 0) {
      toast.info('Nenhuma alteração para salvar');
      return;
    }
    setBulkSaving(true);
    try {
      for (const s of dirty) {
        await updateProfile.mutateAsync({ id: s.id, individual_goal: parseBRL(values[s.id] || '') });
      }
      toast.success(`${dirty.length} meta(s) atualizada(s)`);
    } finally {
      setBulkSaving(false);
    }
  };

  const dirtyCount = sellers.filter(isDirty).length;

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Metas Individuais dos Vendedores</h3>
            <p className="text-xs text-muted-foreground">
              Defina a meta mensal de receita (R$) de cada vendedor (closer).
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar vendedor..."
            className="pl-8 h-9 w-[220px]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando vendedores...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-8">
          Nenhum vendedor encontrado.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s: any) => {
            const dirty = isDirty(s);
            return (
              <div
                key={s.id}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  dirty ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-muted/20'
                }`}
              >
                <SellerAvatar name={s.name} avatarUrl={s.avatar_url} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{s.name}</p>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Vendedor
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-background/60 border border-border/40 rounded-lg px-3 py-1.5 min-w-[180px]">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={values[s.id] ?? ''}
                    onChange={(e) =>
                      setValues((prev) => ({ ...prev, [s.id]: fmtBRL(e.target.value) }))
                    }
                    placeholder="0"
                    className="flex-1 bg-transparent border-0 outline-none text-base font-bold text-foreground placeholder:text-muted-foreground/40 w-full"
                  />
                </div>

                <Button
                  size="sm"
                  variant={dirty ? 'default' : 'outline'}
                  disabled={!dirty || savingId === s.id}
                  onClick={() => saveOne(s)}
                  className="min-w-[90px]"
                >
                  {savingId === s.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                      Salvar
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {sellers.length > 0 && (
        <Button
          onClick={saveAll}
          disabled={bulkSaving || dirtyCount === 0}
          className="w-full btn-gradient text-primary-foreground h-11"
        >
          {bulkSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {bulkSaving
            ? 'Salvando alterações...'
            : dirtyCount > 0
              ? `Salvar todas (${dirtyCount} alteração${dirtyCount > 1 ? 'ões' : ''})`
              : 'Nenhuma alteração pendente'}
        </Button>
      )}
    </div>
  );
}
