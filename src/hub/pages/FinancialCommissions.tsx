import { fetchAllRows } from '@/lib/fetchAllRows';
import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSales, useProfiles } from '@/hooks/useSupabaseData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate, getCashCollected } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { FileDown, Users, Bell, CheckCircle2, MessageSquare, Save } from 'lucide-react';
import { openCommissionReport } from '@/lib/commissionReportGenerator';
import { toast } from 'sonner';

import { CommercialAnalytics } from '@/components/financial/CommercialAnalytics';
import { InstallmentManager } from '@/components/commission/InstallmentManager';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i,
  label: format(new Date(2026, i, 1), 'MMMM', { locale: ptBR }),
}));

const YEARS = [2025, 2026, 2027, 2028, 2029, 2030];

export default function FinancialCommissionsPage() {
  const { user } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const { data: allSales = [] } = useSales();
  const { data: profiles = [] } = useProfiles();

  // Fetch all monthly_income for this month/year
  const { data: allIncome = [] } = useQuery({
    queryKey: ['all_monthly_income', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('monthly_income')
        .select('*')
        .eq('month', month + 1)
        .eq('year', year);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch all bonuses for this month/year
  const { data: allBonuses = [] } = useQuery({
    queryKey: ['all_seller_bonuses', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seller_bonuses')
        .select('*')
        .eq('month', month + 1)
        .eq('year', year);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch submitted reports
  const { data: reports = [] } = useQuery({
    queryKey: ['commission_reports', month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('commission_reports')
        .select('*')
        .eq('month', month + 1)
        .eq('year', year);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ['financial_notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('financial_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const sellers = useMemo(() => {
    return profiles.filter((p: any) => (p.role === 'vendedor' || p.role === 'pre-vendedor') && p.active);
  }, [profiles]);

  const sellerData = useMemo(() => {
    return sellers.map((seller: any) => {
      const sellerSales = allSales.filter((s: any) => {
        const d = parseLocalDate(s.date);
        return s.seller_id === seller.id && d.getMonth() === month && d.getFullYear() === year;
      });
      const totalSales = sellerSales.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      const income = allIncome.find((i: any) => i.seller_id === seller.id);
      const fixedSalary = income ? Number(income.fixed_salary) : 0;

      const sellerBonuses = allBonuses.filter((b: any) => b.seller_id === seller.id);
      const totalBonuses = sellerBonuses.reduce((sum: number, b: any) => sum + Number(b.amount), 0);

      // Commission from sales records
      const totalCommission = sellerSales.reduce((sum: number, s: any) => sum + Number(s.commission_value || 0), 0);

      const totalPayment = fixedSalary + totalCommission + totalBonuses;

      const report = reports.find((r: any) => r.seller_id === seller.id);

      return {
        ...seller,
        totalSales,
        fixedSalary,
        totalCommission,
        totalBonuses,
        totalPayment,
        report,
      };
    }).sort((a: any, b: any) => b.totalPayment - a.totalPayment);
  }, [sellers, allSales, allIncome, allBonuses, reports, month, year]);


  const monthName = format(new Date(year, month, 1), 'MMMM yyyy', { locale: ptBR });

  const generateSellerPDF = async (seller: any) => {
    const sellerSales = allSales.filter((s: any) => {
      const d = parseLocalDate(s.date);
      return s.seller_id === seller.id && d.getMonth() === month && d.getFullYear() === year;
    }).sort((a: any, b: any) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime());

    const sellerBonuses = allBonuses.filter((b: any) => b.seller_id === seller.id);

    // Fetch installments + observations for this seller/month so the PDF is complete
    const [installmentsRaw, observations] = await Promise.all([
      fetchAllRows<any>(() => supabase.from('commission_installments').select('*', { count: 'exact' })
        .eq('seller_id', seller.id).eq('expected_month', month + 1).eq('expected_year', year)),
      fetchAllRows<any>(() => supabase.from('commission_observations').select('*', { count: 'exact' })
        .eq('seller_id', seller.id).eq('month', month + 1).eq('year', year)),
    ]);

    // Bounded ID batches avoid URL limits while resolving every installment.
    const saleIds: string[] = Array.from(new Set(installmentsRaw.map((i: any) => i.sale_id).filter(Boolean)));
    const salesMap: Record<string, string> = {};
    for (let start = 0; start < saleIds.length; start += 100) {
      const ids = saleIds.slice(start, start + 100);
      const linkedSales = await fetchAllRows(() => supabase.from('sales')
        .select('id, client_name', { count: 'exact' }).in('id', ids));
      for (const sale of linkedSales) salesMap[sale.id] = sale.client_name;
    }
    const installments = (installmentsRaw ?? []).map((i: any) => ({
      ...i,
      client_name: salesMap[i.sale_id] || null,
    }));

    // Build commission rows from stored commission_value (financial doesn't recompute)
    const commissionRows = sellerSales.map((s: any) => ({
      id: s.id,
      date: s.date,
      client_name: s.client_name,
      product: s.product,
      amount: getCashCollected(s),
      origin: s.origin,
      temperature: s.temperature,
      platform: s.platform,
      commissionRate: Number(s.amount) > 0 ? Number(s.commission_value || 0) / Number(s.amount) : 0,
      commissionValue: Number(s.commission_value || 0),
    }));

    openCommissionReport({
      seller: { name: seller.name, role: seller.role },
      month,
      year,
      seniorityLabel: '-',
      modelLabel: '-',
      sales: sellerSales,
      commissionRows: commissionRows as any,
      installments: installments ?? [],
      bonuses: sellerBonuses,
      observations: observations ?? [],
      fixedSalary: Number(seller.fixedSalary || 0),
      sellerNotes: seller.report?.seller_notes || '',
      managerNotes: seller.report?.manager_notes || '',
    });
  };


  const unreadNotifications = notifications.filter((n: any) => !n.read);

  return (
    <div className="page-container space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="page-title">Painel Financeiro</h2>
          <p className="page-subtitle">Relatórios de pagamento e comissões dos vendedores</p>
        </div>
        {unreadNotifications.length > 0 && (
          <Badge variant="default" className="gap-1.5">
            <Bell className="h-3.5 w-3.5" />
            {unreadNotifications.length} nova{unreadNotifications.length > 1 ? 's' : ''} notificação{unreadNotifications.length > 1 ? 'ões' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={month.toString()} onValueChange={v => setMonth(parseInt(v))}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={m.value.toString()} className="capitalize">{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={year.toString()} onValueChange={v => setYear(parseInt(v))}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {/* Notifications */}
      {unreadNotifications.length > 0 && (
        <div className="space-y-2">
          {unreadNotifications.slice(0, 5).map((n: any) => (
            <div key={n.id} className="glass-card p-4 border-l-4 border-l-primary/50 flex items-center gap-3">
              <Bell className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-foreground">{n.message}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(n.created_at), 'dd/MM/yyyy HH:mm')}</p>
              </div>
              {n.report_id && (
                <Badge variant="outline" className="text-xs gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Relatório enviado
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Seller Payment Report */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-border/50 flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-foreground">Relatório de Pagamentos – {monthName.charAt(0).toUpperCase() + monthName.slice(1)}</h3>
        </div>
        {sellerData.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum vendedor ativo encontrado.</div>
        ) : (
          <div className="divide-y divide-border/30">
            {sellerData.map((seller: any) => (
              <SellerReportRow key={seller.id} seller={seller} onPDF={() => { void generateSellerPDF(seller).catch(() => toast.error('Não foi possível carregar todos os dados do relatório. Tente novamente.')); }} />
            ))}
          </div>
        )}
      </div>



      {/* TMB Global Installment Manager */}
      <InstallmentManager month={month} year={year} />

      {/* Commercial Financial Analytics */}
      <CommercialAnalytics
        allSales={allSales}
        sellerData={sellerData}
        month={month}
        year={year}
      />
    </div>
  );
}

function SellerReportRow({ seller, onPDF }: { seller: any; onPDF: () => void }) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(seller.report?.manager_notes || '');
  const [saving, setSaving] = useState(false);

  const saveNotes = async () => {
    if (!seller.report?.id) {
      toast.error('Vendedor ainda não enviou relatório este mês.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('commission_reports')
      .update({ manager_notes: notes } as any)
      .eq('id', seller.report.id);
    setSaving(false);
    if (error) toast.error('Erro ao salvar: ' + error.message);
    else toast.success('Notas salvas');
  };

  return (
    <div className="p-5 hover:bg-accent/20 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <p className="font-semibold text-foreground text-lg">{seller.name}</p>
            {seller.report && (
              <Badge variant="outline" className="text-xs gap-1 border-emerald-500/30 text-emerald-500">
                <CheckCircle2 className="h-3 w-3" /> Relatório enviado
              </Badge>
            )}
            {seller.report?.seller_notes && (
              <Badge variant="outline" className="text-xs gap-1">
                <MessageSquare className="h-3 w-3" /> Notas do vendedor
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Fixo</p>
              <p className="text-sm font-medium text-foreground">R$ {seller.fixedSalary.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Comissões</p>
              <p className="text-sm font-medium text-primary">R$ {seller.totalCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bônus</p>
              <p className="text-sm font-medium text-foreground">R$ {seller.totalBonuses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">Total Pagamento</p>
              <p className="text-lg font-bold text-foreground">R$ {seller.totalPayment.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
          {seller.report?.seller_notes && (
            <div className="mt-3 rounded-md border border-border/40 bg-background/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Notas do Vendedor</p>
              <p className="text-xs text-foreground whitespace-pre-wrap">{seller.report.seller_notes}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={onPDF} className="border-border/50 hover:bg-accent/50">
            <FileDown className="h-3.5 w-3.5 mr-1" /> Ver PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!seller.report}
            onClick={() => setNotesOpen((o) => !o)}
            className="border-border/50 hover:bg-accent/50"
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1" /> {notesOpen ? 'Fechar' : 'Notas Gestão'}
          </Button>
        </div>
      </div>
      {notesOpen && seller.report && (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Notas internas de Gestão / Financeiro (visíveis no PDF do relatório)</p>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Observações sobre validações, deduções aplicadas, ajustes manuais..."
          />
          <Button size="sm" onClick={saveNotes} disabled={saving} className="btn-gradient text-primary-foreground">
            <Save className="h-3.5 w-3.5 mr-1" /> {saving ? 'Salvando...' : 'Salvar notas'}
          </Button>
        </div>
      )}
    </div>
  );
}
