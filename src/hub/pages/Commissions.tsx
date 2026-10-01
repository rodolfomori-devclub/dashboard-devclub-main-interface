import React, { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSales, useMonthlyIncome, useUpsertMonthlyIncome, useSellerBonuses, useAddSellerBonus, useDeleteSellerBonus, useCommissionObservations, useAddCommissionObservation, useDeleteCommissionObservation, useCommissionInstallments, useMarkInstallmentPaid } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { parseLocalDate, getCashCollected } from '@/lib/utils';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileDown, Plus, Trash2, DollarSign, Trophy, Gift, TrendingUp, CalendarIcon, Send, CheckCircle2, MessageSquarePlus, ArrowUpCircle, ArrowDownCircle, ChevronDown, ChevronRight, AlertTriangle, HandCoins, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { calculateCommissions, type Seniority, type CommissionModel } from '@/lib/commissionCalculator';
import { FutureCommissions } from '@/components/commission/FutureCommissions';
import { openCommissionReport, computeReportSummary, validateReport } from '@/lib/commissionReportGenerator';
import { toast } from 'sonner';
import { WhatsAppIconButton } from '@/components/meetings/WhatsAppButton';


const SENIORITY_OPTIONS = [
  { value: 'junior', label: 'Junior' },
  { value: 'pleno', label: 'Pleno' },
  { value: 'senior', label: 'Senior' },
];

const COMMISSION_MODEL_OPTIONS = [
  { value: 'lancamento', label: 'Lançamento' },
  { value: 'perpetuo', label: 'Perpétuo' },
];

const BONUS_CATEGORIES = [
  'Meta Individual Atingida',
  'Meta do Time Atingida',
  'Meta de Venda Diária Atingida',
  'Meta de Cash Collected',
  'Bônus de Meta Semanal',
  'Outro',
];

export default function CommissionsPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [seniority, setSeniority] = useState('');
  const [commissionModel, setCommissionModel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: allSales = [] } = useSales();
  const { data: incomeRecord } = useMonthlyIncome(user!.id, month, year);
  const { data: bonuses = [] } = useSellerBonuses(user!.id, month, year);
  const upsertIncome = useUpsertMonthlyIncome();
  const addBonus = useAddSellerBonus();
  const deleteBonus = useDeleteSellerBonus();
  const { data: observations = [] } = useCommissionObservations(user!.id, month, year);
  const addObservation = useAddCommissionObservation();
  const deleteObservation = useDeleteCommissionObservation();
  const { data: myInstallments = [] } = useCommissionInstallments(user!.id);
  const { data: monthInstallments = [] } = useCommissionInstallments(user!.id, month + 1, year);
  const markInstallmentPaid = useMarkInstallmentPaid();

  // Check if report already submitted for this month
  const { data: existingReport, refetch: refetchReport } = useQuery({
    queryKey: ['commission_report', user!.id, month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_reports')
        .select('*')
        .eq('seller_id', user!.id)
        .eq('month', month + 1)
        .eq('year', year)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [fixedSalary, setFixedSalary] = useState('');
  const [salaryLoaded, setSalaryLoaded] = useState(false);
  const [sellerNotes, setSellerNotes] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Sync fixed salary from DB
  if (incomeRecord && !salaryLoaded) {
    setFixedSalary(incomeRecord.fixed_salary?.toString() || '');
    setSalaryLoaded(true);
  }
  // Reset when month/year changes
  const incomeKey = `${month}-${year}`;
  const [lastKey, setLastKey] = useState(incomeKey);
  if (incomeKey !== lastKey) {
    setLastKey(incomeKey);
    setSalaryLoaded(false);
    setFixedSalary('');
    setSellerNotes('');
    setExpanded(new Set());
  }


  const data = useMemo(() => {
    const mySales = allSales.filter((s: any) => s.seller_id === user!.id);
    const filtered = mySales
      .filter((s: any) => { const d = parseLocalDate(s.date); return d.getMonth() === month && d.getFullYear() === year; })
      .sort((a: any, b: any) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

    // Total sold = total_sale_value (or amount as fallback) — the full sale value, NOT cash collected
    const totalSold = filtered.reduce((sum: number, r: any) => sum + Number(r.total_sale_value || r.amount || 0), 0);

    // Apply commission calculation if model and seniority are selected
    if ((commissionModel === 'perpetuo' || commissionModel === 'lancamento') && seniority) {
      const result = calculateCommissions(filtered, seniority as Seniority, commissionModel as CommissionModel);
      return {
        rows: result.rows,
        totalSales: totalSold,
        commissionTotal: result.totalCommission,
        hasCommission: true,
      };
    }

    return {
      rows: filtered.map((s: any) => ({ ...s, commissionRate: 0, commissionValue: 0 })),
      totalSales: totalSold,
      commissionTotal: 0,
      hasCommission: false,
    };
  }, [user, month, year, allSales, seniority, commissionModel]);

  const commissionTotal = data.commissionTotal;
  const totalBonuses = bonuses.reduce((sum: number, b: any) => sum + Number(b.amount), 0);
  const totalObsExtra = observations.filter((o: any) => o.type === 'extra').reduce((sum: number, o: any) => sum + Number(o.amount), 0);
  const totalObsDeduction = observations.filter((o: any) => o.type === 'deduction').reduce((sum: number, o: any) => sum + Number(o.amount), 0);
  const totalObservations = totalObsExtra - totalObsDeduction;
  const parsedSalary = parseFloat(fixedSalary) || 0;

  // Installment commissions for this month (only confirmed ones count in total)
  const confirmedInstallmentCommission = monthInstallments
    .filter((i: any) => i.status === 'confirmed')
    .reduce((sum: number, i: any) => sum + Number(i.commission_value), 0);
  const pendingInstallmentCommission = monthInstallments
    .filter((i: any) => i.status === 'pending')
    .reduce((sum: number, i: any) => sum + Number(i.commission_value), 0);

  const totalIncome = parsedSalary + commissionTotal + totalBonuses + totalObservations + confirmedInstallmentCommission;

  const handleSaveFixedSalary = () => {
    upsertIncome.mutate({
      seller_id: user!.id,
      month: month + 1,
      year,
      fixed_salary: parsedSalary,
    });
  };

  const monthName = format(new Date(year, month, 1), 'MMMM', { locale: ptBR });

  // ── Build the unified report input (sales for the period, raw rows for cash/pending lookup)
  const mySalesMonth = useMemo(
    () =>
      allSales.filter((s: any) => {
        if (s.seller_id !== user!.id) return false;
        const d = parseLocalDate(s.date);
        return d.getMonth() === month && d.getFullYear() === year;
      }),
    [allSales, user, month, year],
  );

  const reportInput = useMemo(() => {
    const seniorityLabel = SENIORITY_OPTIONS.find((s) => s.value === seniority)?.label || '-';
    const modelLabel = COMMISSION_MODEL_OPTIONS.find((m) => m.value === commissionModel)?.label || '-';
    return {
      seller: { name: user!.name, role: (user as any).role },
      month,
      year,
      seniorityLabel,
      modelLabel,
      sales: mySalesMonth,
      commissionRows: data.rows as any,
      installments: monthInstallments,
      bonuses,
      observations,
      fixedSalary: parsedSalary,
      sellerNotes,
    };
  }, [user, month, year, seniority, commissionModel, mySalesMonth, data.rows, monthInstallments, bonuses, observations, parsedSalary, sellerNotes]);

  const summary = useMemo(() => computeReportSummary(reportInput as any), [reportInput]);
  const warnings = useMemo(() => validateReport(reportInput as any), [reportInput]);

  const generatePDF = () => openCommissionReport(reportInput as any);


  const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: format(new Date(2026, i, 1), 'MMMM', { locale: ptBR }) }));
  const tempLabel = (t: string) => t === 'hot' ? 'Quente' : t === 'cold' ? 'Frio' : '-';

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="page-title">Comissões</h2><p className="page-subtitle">Relatório mensal de comissões e receita</p></div>
        <Button variant="outline" size="sm" onClick={generatePDF} disabled={data.rows.length === 0} className="border-border/50 hover:bg-accent/50"><FileDown className="h-3.5 w-3.5 mr-1" /> Gerar PDF</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value.toString()} className="capitalize">{m.label}</SelectItem>)}</SelectContent></Select>
        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent>{[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent></Select>
        <Select value={seniority} onValueChange={setSeniority}><SelectTrigger className="w-40"><SelectValue placeholder="Senioridade" /></SelectTrigger><SelectContent>{SENIORITY_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
        <Select value={commissionModel} onValueChange={setCommissionModel}><SelectTrigger className="w-40"><SelectValue placeholder="Regra de comissão" /></SelectTrigger><SelectContent>{COMMISSION_MODEL_OPTIONS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent></Select>
      </div>

      {/* ─── Executive Summary ─── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Resumo Executivo — {monthName.charAt(0).toUpperCase() + monthName.slice(1)} {year}
          </h3>
          <p className="text-xs text-muted-foreground">{user!.name}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Vendido', value: summary.totalSalesValue },
            { label: 'Cash Collected', value: summary.totalCashCollected, accent: 'text-emerald-500' },
            { label: 'Pending Future', value: summary.totalPendingFuture, accent: 'text-amber-500' },
            { label: 'Base de Comissão', value: summary.commissionBaseTotal },
            { label: 'Comissões', value: summary.totalCommissions, accent: 'text-primary' },
            { label: 'Parc. TMB Confirmadas', value: summary.totalConfirmedInstallmentCommission },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border border-border/40 bg-background/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className={`text-base font-semibold mt-1 ${m.accent || 'text-foreground'}`}>
                R$ {m.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Validation Warnings ─── */}
      {warnings.length > 0 && (
        <div className="glass-card p-4 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-4 w-4" />
            <p className="text-sm font-semibold">Validações ({warnings.length})</p>
          </div>
          <ul className="space-y-1 pl-1">
            {warnings.map((w, i) => (
              <li
                key={i}
                className={`text-xs ${w.level === 'critical' ? 'text-error' : 'text-amber-500/90'}`}
              >
                <strong>{w.level === 'critical' ? 'CRÍTICO:' : 'Atenção:'}</strong> {w.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sales table */}
      <div className="glass-card overflow-hidden">
        {data.rows.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Nenhuma venda neste período.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border/50">
                <th className="w-8 p-3"></th>
                <th className="text-left p-3 font-medium text-muted-foreground">Data</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Cash Collected</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Pending Future</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Plataforma</th>
                <th className="text-right p-3 font-medium text-muted-foreground">% Comissão</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Comissão</th>
              </tr></thead>
              <tbody>{data.rows.map((r: any) => {
                const isSplit = r.hublaCommission != null;
                const raw: any = mySalesMonth.find((s: any) => s.id === r.id) || {};
                const cash = getCashCollected(raw);
                const pending = Number(raw.pending_future_value ?? 0);
                const total = Number(raw.total_sale_value ?? cash);

                const isOpen = expanded.has(r.id);
                return (
                <React.Fragment key={r.id}>
                <tr
                  className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors cursor-pointer"
                  onClick={() => toggleExpand(r.id)}
                >

                  <td className="p-3 text-muted-foreground">{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</td>
                  <td className="p-3">{format(parseLocalDate(r.date), 'dd/MM/yyyy')}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span>{r.client_name || '-'}</span>
                      {raw.client_whatsapp && <WhatsAppIconButton phone={raw.client_whatsapp} tokens={{ client_name: r.client_name || '' }} />}
                    </div>
                  </td>
                  <td className="p-3">{r.product || '-'}</td>
                  <td className="p-3 text-right font-medium text-emerald-500">R$ {cash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 text-right text-amber-500">{pending > 0 ? `R$ ${pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}</td>
                  <td className="p-3 text-muted-foreground">{r.platform || '-'}</td>
                  <td className="p-3 text-right text-muted-foreground">
                    {data.hasCommission
                      ? isSplit
                        ? `${(r.commissionRate * 100).toFixed(1)}% (mix)`
                        : `${(r.commissionRate * 100).toFixed(1)}%`
                      : '—'}
                  </td>
                  <td className="p-3 text-right font-medium">
                    {data.hasCommission ? (
                      <div>
                        <span>R$ {r.commissionValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        {isSplit && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Hubla: R$ {r.hublaCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            {' · '}
                            TMB: R$ {r.tmbCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </div>
                        )}
                      </div>
                    ) : '—'}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-accent/10 border-b border-border/30">
                    <td></td>
                    <td colSpan={8} className="p-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                        <Detail label="Valor Total da Venda" value={`R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                        <Detail label="Cash Collected (base)" value={`R$ ${cash.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} accent="text-emerald-500" />
                        <Detail label="Pending Future" value={pending > 0 ? `R$ ${pending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'} accent={pending > 0 ? 'text-amber-500' : ''} />
                        <Detail label="Origem" value={raw.origin || '-'} />
                        <Detail label="Plataforma" value={raw.platform || '-'} />
                        <Detail label="Parcelas" value={String(raw.installments || 1)} />
                        <Detail label="Temperatura" value={tempLabel(raw.temperature)} />
                        <Detail label="UTM" value={raw.utm || '-'} />
                        {raw.future_payment_platform && <Detail label="Plataforma Pendente" value={raw.future_payment_platform} />}
                        {raw.future_due_date && <Detail label="Vencimento Pendente" value={format(parseLocalDate(raw.future_due_date), 'dd/MM/yyyy')} />}
                        {raw.outstanding_status && raw.outstanding_status !== 'none' && <Detail label="Status Outstanding" value={raw.outstanding_status} />}
                        {raw.expected_close_date && <Detail label="Previsão de Fechamento" value={format(parseLocalDate(raw.expected_close_date), 'dd/MM/yyyy')} />}
                        {isSplit && (
                          <>
                            <Detail label="Comissão Hubla" value={`R$ ${r.hublaCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                            <Detail label="Comissão TMB" value={`R$ ${r.tmbCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
                          </>
                        )}
                        {raw.note && <Detail label="Observação" value={raw.note} fullWidth />}
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>

                );

              })}</tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sales totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5"><p className="text-sm text-muted-foreground">Total de Vendas</p><p className="text-2xl font-semibold text-foreground mt-1">R$ {data.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
        <div className="glass-card p-5"><p className="text-sm text-muted-foreground">Total Coletado</p><p className="text-2xl font-semibold text-emerald-500 mt-1">R$ {summary.totalCashCollected.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
        <div className="glass-card p-5"><p className="text-sm text-muted-foreground">Total de Comissões</p><p className="text-2xl font-semibold text-primary mt-1">{data.hasCommission ? `R$ ${commissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'A calcular'}</p></div>
      </div>

      {/* ── Income Summary Section ── */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Resumo de Receita do Vendedor
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Fixed Salary */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm font-medium">Fixo do mês</p>
            </div>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.01"
                min={0}
                value={fixedSalary}
                onChange={e => setFixedSalary(e.target.value)}
                placeholder="0,00"
                className="flex-1"
              />
              <Button size="sm" onClick={handleSaveFixedSalary} disabled={upsertIncome.isPending} className="btn-gradient text-primary-foreground">
                Salvar
              </Button>
            </div>
            <p className="text-2xl font-semibold text-foreground">R$ {parsedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>

          {/* Commissions (read-only) */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="h-4 w-4" />
              <p className="text-sm font-medium">Comissões</p>
            </div>
            <p className="text-2xl font-semibold text-primary mt-4">{data.hasCommission ? `R$ ${commissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'A calcular'}</p>
            <p className="text-xs text-muted-foreground">{data.hasCommission ? 'Calculado automaticamente' : 'Selecione senioridade e regra Perpétuo'}</p>
          </div>

          {/* Bonuses */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Gift className="h-4 w-4" />
                <p className="text-sm font-medium">Bônus</p>
              </div>
              <BonusFormDialog
                sellerId={user!.id}
                month={month}
                year={year}
                onAdd={addBonus.mutate}
                isPending={addBonus.isPending}
              />
            </div>
            <p className="text-2xl font-semibold text-foreground">R$ {totalBonuses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-muted-foreground">{bonuses.length} bônus registrado{bonuses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {/* Bonus list */}
        {bonuses.length > 0 && (
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-border/50">
              <p className="text-sm font-medium text-muted-foreground">Bônus do mês</p>
            </div>
            <div className="divide-y divide-border/30">
              {bonuses.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-4 hover:bg-accent/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      Dia {b.bonus_date ? format(parseLocalDate(b.bonus_date), 'dd/MM/yyyy') : '—'} o vendedor {user!.name} atingiu o bônus <strong>{b.category}</strong> de <strong>R$ {Number(b.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>.
                    </p>
                    {b.description && <span className="text-xs text-muted-foreground mt-0.5 block">{b.description}</span>}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-accent/50" onClick={() => deleteBonus.mutate(b.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Observations Section ── */}
        <div className="glass-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MessageSquarePlus className="h-4 w-4" />
              <p className="text-sm font-medium">Observações de Comissão</p>
            </div>
            <ObservationFormDialog
              sellerId={user!.id}
              month={month}
              year={year}
              onAdd={addObservation.mutate}
              isPending={addObservation.isPending}
            />
          </div>
          {totalObservations !== 0 && (
            <p className={`text-lg font-semibold ${totalObservations > 0 ? 'text-emerald-500' : 'text-error'}`}>
              {totalObservations > 0 ? '+' : '-'} R$ {Math.abs(totalObservations).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
          {observations.length > 0 && (
            <div className="divide-y divide-border/30">
              {observations.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {o.type === 'extra' ? (
                      <ArrowUpCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <ArrowDownCircle className="h-4 w-4 text-error shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{o.description || 'Sem descrição'}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.type === 'extra' ? 'Comissão a mais' : 'Comissão a menos'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`text-sm font-semibold ${o.type === 'extra' ? 'text-emerald-500' : 'text-error'}`}>
                      {o.type === 'extra' ? '+' : '-'} R$ {Number(o.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-error hover:bg-accent/50" onClick={() => deleteObservation.mutate(o.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {observations.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhuma observação registrada.</p>
          )}
        </div>

        {/* ── Comissões Parceladas TMB ── */}
        <div className="space-y-3">
          <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Comissões Parceladas TMB — {monthName.charAt(0).toUpperCase() + monthName.slice(1)} {year}
          </h4>
        {monthInstallments.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Confirmadas</p>
                <p className="text-xl font-semibold text-primary mt-1">R$ {confirmedInstallmentCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-semibold text-muted-foreground mt-1">R$ {pendingInstallmentCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border/50">
                    <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Venda Original</th>
                    <th className="text-center p-3 font-medium text-muted-foreground">Parcela</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Valor Parcela</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Comissão</th>
                    <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                    <th className="p-3 font-medium text-muted-foreground"></th>
                  </tr></thead>
                  <tbody>
                    {monthInstallments.map((item: any) => {
                      const statusInfo = item.status === 'confirmed'
                        ? { label: 'Pagamento Confirmado', className: 'bg-primary/10 text-primary border-primary/30', icon: CheckCircle2 }
                        : item.status === 'not_confirmed'
                        ? { label: 'Não Confirmado', className: 'bg-destructive/10 text-error border-destructive/30', icon: null }
                        : item.status === 'paid_by_seller'
                        ? { label: 'Aguardando Validação', className: 'bg-amber-500/10 text-amber-500 border-amber-500/30', icon: HandCoins }
                        : { label: 'Pendente', className: 'bg-muted text-muted-foreground border-border', icon: Clock };
                      const Icon = statusInfo.icon;
                      return (
                        <tr key={item.id} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                          <td className="p-3">{item.product}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <span>{item.client_name || <span className="text-muted-foreground">—</span>}</span>
                              {item.client_whatsapp && <WhatsAppIconButton phone={item.client_whatsapp} tokens={{ client_name: item.client_name || '' }} />}
                            </div>
                          </td>
                          <td className="p-3 text-right">R$ {Number(item.original_sale_value).toLocaleString('pt-BR')}</td>
                          <td className="p-3 text-center font-medium">{item.installment_number}/{item.total_installments}</td>
                          <td className="p-3 text-right">R$ {Number(item.installment_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3 text-right font-medium">R$ {Number(item.commission_value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          <td className="p-3">
                            <Badge variant="outline" className={`text-xs gap-1 ${statusInfo.className}`}>
                              {Icon ? <Icon className="h-3 w-3" /> : null}
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="p-3 text-right">
                            {item.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={markInstallmentPaid.isPending}
                                onClick={() => markInstallmentPaid.mutate({ id: item.id })}
                              >
                                <HandCoins className="h-3 w-3 mr-1" /> Marcar como Pago
                              </Button>
                            )}
                            {item.status === 'paid_by_seller' && (
                              <span className="text-[11px] text-muted-foreground">Enviado p/ validação</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-card p-8 text-center text-sm text-muted-foreground">
            Nenhuma parcela de comissão TMB registrada para este mês. Quando vendas na plataforma TMB com parcelas forem registradas, as comissões aparecerão aqui automaticamente.
          </div>
        )}
        </div>

        {/* Total Income */}
        <div className="glass-card p-6 border-2 border-primary/30">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">Total recebido no mês</p>
              <div className="flex items-baseline gap-3 flex-wrap text-sm text-muted-foreground">
                <span>Fixo: R$ {parsedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                <span className="text-border">+</span>
                <span>Comissões: {data.hasCommission ? `R$ ${commissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'A calcular'}</span>
                <span className="text-border">+</span>
                <span>Bônus: R$ {totalBonuses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                {totalObservations !== 0 && (
                  <>
                    <span className="text-border">{totalObservations > 0 ? '+' : '-'}</span>
                    <span>Obs: R$ {Math.abs(totalObservations).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </>
                )}
                {confirmedInstallmentCommission > 0 && (
                  <>
                    <span className="text-border">+</span>
                    <span>Parcelas TMB: R$ {confirmedInstallmentCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-3xl sm:text-4xl font-bold text-primary">
              R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        {/* Future Commissions */}
        <FutureCommissions installments={myInstallments} />

        {/* Submit Report */}
        {(() => {
          const today = new Date();
          const dayOfMonth = today.getDate();
          const isSubmissionWindow = true;
          // The report always refers to the previous month
          const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
          const reportMonthName = format(prevMonthDate, 'MMMM', { locale: ptBR });
          const reportMonthNameCap = reportMonthName.charAt(0).toUpperCase() + reportMonthName.slice(1);
          const reportMonth = prevMonthDate.getMonth(); // 0-indexed
          const reportYear = prevMonthDate.getFullYear();

          return (
            <div className="glass-card p-5 space-y-4">
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  Envie seu relatório de comissões de {reportMonthNameCap} para o time Financeiro.
                </p>
                <p className="text-xs text-muted-foreground">
                  Envio único mensal.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Notas do mês (opcional)</Label>
                <Textarea
                  value={
                    existingReport && existingReport.month === reportMonth + 1 && existingReport.year === reportYear
                      ? (existingReport as any).seller_notes || sellerNotes
                      : sellerNotes
                  }
                  onChange={(e) => setSellerNotes(e.target.value)}
                  placeholder="Observações para Gestão / Financeiro sobre este mês..."
                  rows={3}
                  disabled={!!(existingReport && existingReport.month === reportMonth + 1 && existingReport.year === reportYear)}
                />

              </div>



              {existingReport && existingReport.month === reportMonth + 1 && existingReport.year === reportYear ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Relatório de {reportMonthNameCap} enviado em {format(new Date(existingReport.submitted_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                  <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-500 shrink-0">
                    <CheckCircle2 className="h-3 w-3" /> Enviado
                  </Badge>
                </div>
              ) : isSubmissionWindow ? (() => {
                const criticalWarnings = warnings.filter((w) => w.level === 'critical');
                const blocked = criticalWarnings.length > 0;
                return (
                <div className="space-y-2">
                  {blocked && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-error flex gap-2 items-start">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Envio bloqueado — corrija {criticalWarnings.length} validação{criticalWarnings.length > 1 ? 'ões' : ''} crítica{criticalWarnings.length > 1 ? 's' : ''} antes de enviar.</p>
                        <p className="opacity-80 mt-0.5">Veja a seção "Validações" acima.</p>
                      </div>
                    </div>
                  )}
                  <Button
                  size="sm"
                  className="btn-gradient text-primary-foreground w-full sm:w-auto"
                  disabled={submitting || blocked}
                  onClick={async () => {
                    setSubmitting(true);
                    try {
                      // Use the previous month's data for submission
                      const prevSales = allSales.filter((s: any) => {
                        if (s.seller_id !== user!.id) return false;
                        const d = parseLocalDate(s.date);
                        return d.getMonth() === reportMonth && d.getFullYear() === reportYear;
                      });
                      const prevTotalSales = prevSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

                      const { error } = await supabase.from('commission_reports').insert({
                        seller_id: user!.id,
                        seller_name: user!.name,
                        month: reportMonth + 1,
                        year: reportYear,
                        total_sales: prevTotalSales,
                        total_commission: commissionTotal,
                        total_bonuses: totalBonuses,
                        fixed_salary: parsedSalary,
                        total_payment: totalIncome,
                        seller_notes: sellerNotes.trim(),
                      } as any);

                      if (error) throw error;

                      await supabase.from('financial_notifications').insert({
                        message: `${user!.name} enviou o relatório de comissões de ${reportMonthNameCap} ${reportYear}.`,
                        seller_id: user!.id,
                        seller_name: user!.name,
                      } as any);

                      toast.success('Relatório enviado com sucesso!');
                      refetchReport();
                    } catch (err: any) {
                      toast.error('Erro ao enviar relatório: ' + (err.message || 'Tente novamente'));
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                >
                  <Send className="h-3.5 w-3.5 mr-1" /> {submitting ? 'Enviando...' : 'Enviar Relatório Mensal de Comissões'}
                </Button>
                </div>
                );
              })() : (
                <div className="space-y-2">
                  <Button size="sm" disabled className="w-full sm:w-auto opacity-50 cursor-not-allowed">
                    <Send className="h-3.5 w-3.5 mr-1" /> Enviar Relatório Mensal de Comissões
                  </Button>
                  <p className="text-xs text-error/80">
                    O envio de relatórios está disponível apenas nos dias 1 e 2 de cada mês.
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function BonusFormDialog({ sellerId, month, year, onAdd, isPending }: { sellerId: string; month: number; year: number; onAdd: (b: any) => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [bonusDate, setBonusDate] = useState<Date | undefined>(undefined);
  const [dateError, setDateError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !category) return;
    if (!bonusDate) {
      setDateError('Selecione a data em que o bônus foi conquistado.');
      return;
    }
    setDateError('');
    const finalCategory = category === 'Outro' ? customCategory.trim() || 'Outro' : category;
    onAdd({
      seller_id: sellerId,
      month: month + 1,
      year,
      amount: parsedAmount,
      category: finalCategory,
      description: description.trim(),
      bonus_date: format(bonusDate, 'yyyy-MM-dd'),
    });
    setAmount('');
    setCategory('');
    setCustomCategory('');
    setDescription('');
    setBonusDate(undefined);
    setDateError('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-accent/50"><Plus className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Adicionar Bônus</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Valor do bônus (R$) *</Label>
            <Input type="number" step="0.01" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="space-y-2">
            <Label>Categoria do bônus *</Label>
            <Select value={category} onValueChange={v => { setCategory(v); if (v !== 'Outro') setCustomCategory(''); }}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>{BONUS_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {category === 'Outro' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label>Categoria personalizada *</Label>
              <Input value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Descreva a categoria" required />
            </div>
          )}
          <div className="space-y-2">
            <Label>Data do bônus *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !bonusDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {bonusDate ? format(bonusDate, 'dd/MM/yyyy') : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={bonusDate}
                  onSelect={(d) => { setBonusDate(d); setDateError(''); }}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {dateError && <p className="text-xs text-error">{dateError}</p>}
          </div>
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Meta do mês alcançada" rows={2} />
          </div>
          <Button type="submit" disabled={isPending} className="w-full btn-gradient text-primary-foreground">
            {isPending ? 'Salvando...' : 'Adicionar Bônus'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ObservationFormDialog({ sellerId, month, year, onAdd, isPending }: { sellerId: string; month: number; year: number; onAdd: (o: any) => void; isPending: boolean }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState('extra');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0 || !description.trim()) return;
    onAdd({
      seller_id: sellerId,
      month: month + 1,
      year,
      type,
      description: description.trim(),
      amount: parsedAmount,
    });
    setType('extra');
    setDescription('');
    setAmount('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-accent/50"><Plus className="h-3.5 w-3.5" /></Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Adicionar Observação</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo *</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="extra">
                  <span className="flex items-center gap-2"><ArrowUpCircle className="h-3.5 w-3.5 text-emerald-500" /> Comissão a mais</span>
                </SelectItem>
                <SelectItem value="deduction">
                  <span className="flex items-center gap-2"><ArrowDownCircle className="h-3.5 w-3.5 text-error" /> Comissão a menos</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o motivo da observação..." rows={2} required />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input type="number" step="0.01" min={0} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" required />
          </div>
          <Button type="submit" disabled={isPending} className="w-full btn-gradient text-primary-foreground">
            {isPending ? 'Salvando...' : 'Adicionar Observação'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value, accent, fullWidth }: { label: string; value: string; accent?: string; fullWidth?: boolean }) {
  return (
    <div className={fullWidth ? 'col-span-2 md:col-span-4' : ''}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xs mt-0.5 ${accent || 'text-foreground'}`}>{value}</p>
    </div>
  );
}
