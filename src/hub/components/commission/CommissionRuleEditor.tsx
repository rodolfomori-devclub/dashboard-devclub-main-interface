import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, LoaderCircle, Settings2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { requestApi } from '../../../lib/api';
import { toast } from 'sonner';

const PLATFORM_IDS = ['guru', 'hotmart', 'tmb', 'asaas', 'boletex', 'manual'] as const;
type Platform = typeof PLATFORM_IDS[number];
type Rates = Record<Platform, number | null>;
interface CommissionRule { sellerId: string; sellerName: string; month: string; rates: Rates; revision: number; updatedAt: string; basis: 'cash_collected' }
interface RuleCatalog { sellers: { id: string; name: string }[]; rules: CommissionRule[]; platforms: { id: Platform; label: string }[] }
const emptyRates = () => Object.fromEntries(PLATFORM_IDS.map((id) => [id, ''])) as Record<Platform, string>;

export function CommissionRuleEditor({ month, preferredSeller, onSaved }: { month: string; preferredSeller: string | null; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [sellerId, setSellerId] = useState('');
  const [rates, setRates] = useState(emptyRates);
  const [revision, setRevision] = useState(0);
  const queryClient = useQueryClient();
  const query = useQuery<RuleCatalog>({
    queryKey: ['commission-rules', month],
    enabled: open,
    queryFn: async ({ signal }) => {
      const response = await requestApi(`/commissions/rules?${new URLSearchParams({ month })}`, { signal });
      if (!response?.success || !Array.isArray(response.data?.rules) || !Array.isArray(response.data?.sellers) || !Array.isArray(response.data?.platforms)) throw new Error('Não foi possível carregar as regras de comissão.');
      return response.data;
    },
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  useEffect(() => {
    if (!open) return;
    const saved = query.data?.rules.find((item) => item.sellerId === sellerId);
    setRevision(saved?.revision || 0);
    setRates(Object.fromEntries(PLATFORM_IDS.map((id) => [id, saved?.rates[id] === null || saved?.rates[id] === undefined ? '' : String(Math.round(saved.rates[id]! * 1000000) / 10000)])) as Record<Platform, string>);
  }, [open, sellerId, query.data]);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!query.data?.sellers.some((seller) => seller.id === sellerId)) throw new Error('Selecione um vendedor.');
      let configured = 0;
      const payloadRates = Object.fromEntries(PLATFORM_IDS.map((id) => {
        const entered = rates[id].trim();
        if (!entered) return [id, null];
        const value = Number(entered.replace(',', '.'));
        if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error('Os percentuais devem estar entre 0% e 100%.');
        if (Math.abs(value * 10000 - Math.round(value * 10000)) > 0.000001) throw new Error('Use no máximo quatro casas decimais no percentual.');
        configured += 1;
        return [id, Number((value / 100).toFixed(6))];
      }));
      if (!configured && revision === 0) throw new Error('Informe pelo menos um percentual. Deixe as demais plataformas em branco.');
      const response = await requestApi(`/commissions/rules/${encodeURIComponent(sellerId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, rates: payloadRates, expectedRevision: revision }),
      });
      if (!response?.success) throw new Error('Não foi possível salvar a regra.');
    },
    onSuccess: async () => {
      toast.success('Regra de comissão salva');
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['commission-rules'] }),
        queryClient.invalidateQueries({ queryKey: ['automatic-commissions'] }),
      ]);
      onSaved();
    },
    onError: async (error: Error & { status?: number }) => {
      if (error.status === 409) {
        toast.error('A regra foi alterada por outro administrador. Recarregamos a configuração; revise antes de salvar.');
        await query.refetch();
      } else toast.error(error.message || 'Não foi possível salvar a regra.');
    },
  });
  const openEditor = () => { setSellerId(preferredSeller || ''); setRates(emptyRates()); setRevision(0); mutation.reset(); setOpen(true); };
  const closeEditor = (next: boolean) => { if (!mutation.isPending) setOpen(next); };
  const existing = query.data?.rules.find((rule) => rule.sellerId === sellerId);

  return <>
    <button className="button" type="button" onClick={openEditor}><Settings2 size={15} />Configurar comissões</button>
    <Dialog open={open} onOpenChange={closeEditor}><DialogContent className="commission-rule-dialog"><DialogHeader><DialogTitle>Regra de comissão</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Defina os percentuais deste vendedor para {month.split('-').reverse().join('/')}. A base é o cash collected das vendas atribuídas.</p>
      {query.isPending ? <div className="commission-loading-label" role="status"><LoaderCircle size={18} />Carregando regras e vendedores...</div> : query.isError ? <div className="commission-note" role="alert"><AlertCircle size={18} /><div>Não foi possível carregar as regras. <button type="button" onClick={() => query.refetch()}>Tentar novamente</button></div></div> : <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
        <label className="block text-sm">Vendedor da regra<select aria-label="Vendedor da regra" className="ds-input mt-1" value={sellerId} onChange={(event) => setSellerId(event.target.value)} disabled={mutation.isPending} required><option value="">Selecione um vendedor</option>{query.data?.sellers.map((seller) => <option value={seller.id} key={seller.id}>{seller.name}</option>)}</select></label>
        <div className="commission-note"><AlertCircle size={17} /><span>Em branco: comissão pendente de configuração. Digite 0% somente quando a plataforma não gerar comissão. Nenhum percentual é preenchido automaticamente.</span></div>
        <fieldset disabled={!sellerId || mutation.isPending || query.isFetching} className="grid grid-cols-1 sm:grid-cols-2 gap-4"><legend className="sr-only">Percentuais por plataforma</legend>{PLATFORM_IDS.map((id) => <label className="block text-sm" key={id}>{query.data?.platforms.find((platform) => platform.id === id)?.label || id}<div className="commission-rate-field"><input aria-label={`Percentual ${query.data?.platforms.find((platform) => platform.id === id)?.label || id}`} className="ds-input" type="number" inputMode="decimal" min="0" max="100" step="0.0001" placeholder="Não configurado" value={rates[id]} onChange={(event) => setRates((previous) => ({ ...previous, [id]: event.target.value }))} /><span>%</span></div></label>)}</fieldset>
        {existing && <p className="text-xs text-muted-foreground">Configuração já existente nesta competência. Ao salvar, os percentuais serão atualizados e as comissões serão recalculadas. Deixe todos os campos em branco para retirar as taxas e devolver as comissões ao estado pendente.</p>}
        <p className="text-xs text-muted-foreground">Salvar a regra não confirma pagamentos. Vendas com reembolso ou recebimento pendente continuam em conferência.</p>
        <div className="flex justify-end gap-2"><button className="button" type="button" onClick={() => closeEditor(false)} disabled={mutation.isPending}>Cancelar</button><button className="button btn-primary" type="submit" disabled={!sellerId || mutation.isPending || query.isFetching}>{mutation.isPending ? 'Salvando regra...' : 'Salvar regra'}</button></div>
      </form>}
    </DialogContent></Dialog>
  </>;
}
