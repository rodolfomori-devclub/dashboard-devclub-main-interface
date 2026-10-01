import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ChevronDown, History, LoaderCircle, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllRows } from '@/lib/fetchAllRows';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { InstallmentManager } from './InstallmentManager';
import { formatCommissionMoney as money } from './commissionApi';

interface LedgerRecord {
  id: string; seller_id: string; seller_name?: string; fixed_salary?: number; amount?: number;
  category?: string; description?: string; type?: string; status?: string; commission_value?: number;
  seller_notes?: string; manager_notes?: string; submitted_at?: string; total_commission?: number; total_payment?: number;
  product?: string; installment_number?: number; total_installments?: number;
}
interface Props { month: string; sellerId: string | null; financialView: boolean; canEditAdjustments: boolean; sellers: { id: string; name: string }[] }
const ledgerTables = ['monthly_income', 'seller_bonuses', 'commission_observations', 'commission_installments', 'commission_reports'] as const;
type LedgerTable = typeof ledgerTables[number];
const sum = (rows: LedgerRecord[], field: keyof LedgerRecord) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

export function CommissionLegacyLedger({ month, sellerId, financialView, canEditAdjustments, sellers }: Props) {
  const { user } = useAuth();
  const [year, monthNumber] = month.split('-').map(Number);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['commission-legacy-ledger', user.id, month, sellerId, financialView],
    queryFn: async ({ signal }) => {
      const data = await Promise.all(ledgerTables.map(async (table) => {
        const installments = table === 'commission_installments';
        const rows = await fetchAllRows<LedgerRecord>(() => {
          let request = supabase.from(table).select('*', { count: 'exact' })
            .eq(installments ? 'expected_month' : 'month', monthNumber)
            .eq(installments ? 'expected_year' : 'year', year);
          if (sellerId) request = request.eq('seller_id', sellerId);
          return request;
        }, { signal });
        return [table, rows] as const;
      }));
      return Object.fromEntries(data) as Record<LedgerTable, LedgerRecord[]>;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    retry: 1,
  });
  const data = query.data;
  const bonuses = data?.seller_bonuses || [];
  const observations = data?.commission_observations || [];
  const installments = data?.commission_installments || [];
  const confirmed = installments.filter((entry) => entry.status === 'confirmed');
  const extra = observations.filter((entry) => entry.type === 'extra');
  const deductions = observations.filter((entry) => entry.type === 'deduction');
  const sellerName = (id: string) => sellers.find((seller) => seller.id === id)?.name || 'Vendedor';
  const refetchLedger = async () => { await queryClient.invalidateQueries({ queryKey: ['commission-legacy-ledger'] }); };

  return <div className="commission-extras">
    <section className="surface-panel" aria-label="Ajustes financeiros registrados">
      <div className="commission-panel-head"><div><h3>Fixo, bônus e ajustes</h3><p>Valores registrados para esta competência, separados das comissões sobre as vendas.</p></div>{canEditAdjustments && <button type="button" className="button" onClick={() => setDialogOpen(true)}><Plus size={15} />Adicionar ajuste</button>}</div>
      {query.isPending ? <div className="commission-loading-label" role="status" style={{ padding: 23 }}><LoaderCircle size={18} />Carregando fixo, bônus e ajustes...</div> : query.isError ? <div className="commission-error" role="alert"><AlertCircle size={19} /><p>Não foi possível carregar os ajustes registrados. Esses valores estão indisponíveis.</p><button className="button" type="button" onClick={() => query.refetch()}>Tentar novamente</button></div> : <>
        <div className="commission-extras-grid">{[
          ['Fixo registrado', sum(data?.monthly_income || [], 'fixed_salary')], ['Bônus registrados', sum(bonuses, 'amount')], ['Extras registrados', sum(extra, 'amount')], ['Descontos registrados', sum(deductions, 'amount')],
        ].map(([label, value]) => <div key={label}><p>{label}</p><strong>{money(Number(value))}</strong></div>)}</div>
        {bonuses.length + observations.length > 0 ? <div className="commission-ledger">{[...bonuses.map((row) => ({ ...row, kind: 'Bônus' })), ...observations.map((row) => ({ ...row, kind: row.type === 'deduction' ? 'Desconto' : 'Extra' }))].map((row) => <div className="commission-ledger-row" key={`${row.kind}-${row.id}`}><div><p>{row.category || row.description || row.kind}</p><small>{row.kind}{financialView ? ` · ${sellerName(row.seller_id)}` : ''}{row.category && row.description ? ` · ${row.description}` : ''}</small></div><strong>{row.type === 'deduction' ? '− ' : ''}{money(Number(row.amount) || 0)}</strong></div>)}</div> : <div className="commission-empty"><p>Nenhum bônus ou ajuste adicional registrado nesta competência.</p></div>}
      </>}
    </section>

    {data && installments.length > 0 && <details className="surface-panel commission-history"><summary><span>Parcelas registradas anteriormente <span className="commission-badge">{installments.length}</span></span><small>{money(sum(confirmed, 'commission_value'))} em comissões confirmadas <ChevronDown size={14} style={{ display: 'inline' }} /></small></summary><div className="commission-note" style={{ margin: '0 20px 15px' }}><History size={17} /><span>Estas parcelas pertencem ao controle anterior. Elas são exibidas para conferência e não são somadas às comissões automáticas das vendas.</span></div>{financialView ? <div style={{ padding: '0 20px 20px' }}><InstallmentManager month={monthNumber - 1} year={year} /></div> : <div className="commission-ledger">{installments.map((entry) => <div className="commission-ledger-row" key={entry.id}><div><p>{entry.product || 'Parcela de comissão'} · {entry.installment_number}/{entry.total_installments}</p><small>{entry.status === 'confirmed' ? 'Confirmada pelo financeiro' : entry.status === 'paid_by_seller' ? 'Aguardando conferência financeira' : entry.status === 'not_confirmed' ? 'Não confirmada' : 'Pendente'}</small></div><strong>{entry.status === 'confirmed' ? money(Number(entry.commission_value) || 0) : 'A confirmar'}</strong></div>)}</div>}</details>}

    {data && data.commission_reports.length > 0 && <details className="surface-panel commission-history"><summary><span>Histórico de relatórios <span className="commission-badge">{data.commission_reports.length}</span></span><small>Registros anteriores desta competência <ChevronDown size={14} style={{ display: 'inline' }} /></small></summary><div className="commission-note" style={{ margin: '0 20px 10px' }}><History size={17} /><span>Os relatórios já enviados permanecem disponíveis para consulta. Seus totais não são somados ao extrato automático.</span></div><div className="commission-ledger">{data.commission_reports.map((report) => <div className="commission-ledger-row" key={report.id}><div><p>{financialView ? report.seller_name || sellerName(report.seller_id) : 'Relatório registrado'}</p><small>{report.submitted_at ? `Registrado em ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' }).format(new Date(report.submitted_at))}` : 'Registro anterior'} · Comissão registrada: {money(Number(report.total_commission) || 0)}</small>{report.seller_notes && <p className="commission-history-notes"><strong>Observações do vendedor:</strong> {report.seller_notes}</p>}{report.manager_notes && <p className="commission-history-notes"><strong>Observações da gestão:</strong> {report.manager_notes}</p>}</div><strong>{money(Number(report.total_payment) || 0)}<small>Total registrado</small></strong></div>)}</div></details>}

    {canEditAdjustments && <AdjustmentDialog open={dialogOpen} onOpenChange={setDialogOpen} month={month} defaultSeller={sellerId} sellers={sellers} onSaved={refetchLedger} />}
  </div>;
}

function AdjustmentDialog({ open, onOpenChange, month, defaultSeller, sellers, onSaved }: {
  open: boolean; onOpenChange: (value: boolean) => void; month: string; defaultSeller: string | null;
  sellers: { id: string; name: string }[]; onSaved: () => Promise<void>;
}) {
  const [seller, setSeller] = useState('');
  const [kind, setKind] = useState('bonus');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [bonusDate, setBonusDate] = useState('');
  const target = seller || defaultSeller || '';
  const save = useMutation({
    mutationFn: async () => {
      const value = Number(amount.replace(',', '.'));
      if (!sellers.some((item) => item.id === target)) throw new Error('Selecione um vendedor.');
      if (!Number.isFinite(value) || value < 0 || (kind !== 'salary' && value === 0)) throw new Error('Informe um valor válido.');
      if (kind !== 'salary' && description.trim().length < 3) throw new Error('Descreva o motivo do ajuste.');
      const [year, monthNumber] = month.split('-').map(Number);
      const common = { seller_id: target, month: monthNumber, year };
      if (kind === 'bonus' && (!/^\d{4}-\d{2}-\d{2}$/.test(bonusDate) || !bonusDate.startsWith(`${month}-`))) throw new Error('Escolha a data do bônus dentro da competência.');
      const result = kind === 'salary'
        ? await supabase.from('monthly_income').upsert({ ...common, fixed_salary: value }, { onConflict: 'seller_id,month,year' })
        : kind === 'bonus'
          ? await supabase.from('seller_bonuses').insert({ ...common, amount: value, category: 'Outro', description: description.trim(), bonus_date: bonusDate })
          : await supabase.from('commission_observations').insert({ ...common, type: kind, amount: value, description: description.trim() });
      if (result.error) throw result.error;
    },
    onSuccess: async () => { toast.success('Ajuste registrado'); setAmount(''); setDescription(''); setBonusDate(''); onOpenChange(false); await onSaved(); },
    onError: (error: Error) => toast.error(error.message || 'Não foi possível salvar o ajuste.'),
  });
  const close = (value: boolean) => { if (!save.isPending) onOpenChange(value); };
  return <Dialog open={open} onOpenChange={close}><DialogContent><DialogHeader><DialogTitle>Adicionar ajuste financeiro</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
    <p className="text-sm text-muted-foreground">Competência: {month.split('-').reverse().join('/')}. Este registro fica separado das comissões calculadas sobre as vendas.</p>
    <label className="block text-sm">Vendedor<select className="ds-input mt-1" value={target} onChange={(event) => setSeller(event.target.value)} required><option value="">Selecione</option>{sellers.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label className="block text-sm">Tipo de ajuste<select className="ds-input mt-1" value={kind} onChange={(event) => setKind(event.target.value)}><option value="bonus">Bônus</option><option value="extra">Valor extra</option><option value="deduction">Desconto</option><option value="salary">Fixo do mês</option></select></label>
    <label className="block text-sm">Valor (R$)<input className="ds-input mt-1" inputMode="decimal" type="number" min={kind === 'salary' ? '0' : '0.01'} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
    {kind === 'bonus' && <label className="block text-sm">Data do bônus<input className="ds-input mt-1" type="date" min={`${month}-01`} max={`${month}-${String(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()).padStart(2, '0')}`} value={bonusDate} onChange={(event) => setBonusDate(event.target.value)} required /></label>}
    {kind !== 'salary' && <label className="block text-sm">Motivo<textarea className="ds-input mt-1" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} minLength={3} maxLength={2000} required /></label>}
    {kind === 'salary' && <p className="text-xs text-muted-foreground">O valor substitui o fixo já registrado para este vendedor nesta competência.</p>}
    <div className="flex justify-end gap-2"><button className="button" type="button" onClick={() => close(false)} disabled={save.isPending}>Cancelar</button><button className="button btn-primary" type="submit" disabled={save.isPending}>{save.isPending ? 'Salvando...' : 'Salvar ajuste'}</button></div>
  </form></DialogContent></Dialog>;
}
