import { useMemo, useState } from 'react';
import { useProfiles, useAllCommissionInstallments, useUpdateInstallmentStatus } from '@/hooks/useSupabaseData';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, CheckCircle2, XCircle, Users, HandCoins } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: i + 1,
  label: format(new Date(2026, i, 1), 'MMMM', { locale: ptBR }),
}));

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  paid_by_seller: { label: 'Marcado pelo Vendedor', variant: 'secondary', icon: HandCoins },
  confirmed: { label: 'Confirmada', variant: 'default', icon: CheckCircle2 },
  not_confirmed: { label: 'Não Confirmada', variant: 'destructive', icon: XCircle },
};

interface InstallmentManagerProps {
  month: number; // 0-indexed
  year: number;
}

export function InstallmentManager({ month, year }: InstallmentManagerProps) {
  const { user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: installments = [] } = useAllCommissionInstallments(month + 1, year);
  const updateStatus = useUpdateInstallmentStatus();
  const [sellerFilter, setSellerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const sellers = useMemo(() => {
    return profiles.filter((p: any) => (p.role === 'vendedor' || p.role === 'pre-vendedor') && p.active);
  }, [profiles]);

  const filtered = useMemo(() => {
    return installments.filter((i: any) => {
      if (sellerFilter !== 'all' && i.seller_id !== sellerFilter) return false;
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      return true;
    });
  }, [installments, sellerFilter, statusFilter]);

  const handleStatusChange = (id: string, status: string) => {
    updateStatus.mutate({ id, status, validatedBy: user?.id });
  };

  const awaitingValidation = installments.filter((i: any) => i.status === 'paid_by_seller').length;

  const monthName = format(new Date(year, month, 1), 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Parcelas TMB Global — {monthName.charAt(0).toUpperCase() + monthName.slice(1)}
          {awaitingValidation > 0 && (
            <Badge variant="secondary" className="ml-2 gap-1">
              <HandCoins className="h-3 w-3" /> {awaitingValidation} aguardando validação
            </Badge>
          )}
        </h3>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="paid_by_seller">Aguardando validação</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="confirmed">Confirmada</SelectItem>
              <SelectItem value="not_confirmed">Não Confirmada</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sellerFilter} onValueChange={setSellerFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Filtrar vendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {sellers.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma parcela encontrada para o filtro atual.
        </div>
      ) : (
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-3 font-medium text-muted-foreground">Vendedor</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Venda Original</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Parcela</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Valor Parcela</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
                <th className="p-3 font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => {
                const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
                const StatusIcon = status.icon;
                const sellerName = profiles.find((p: any) => p.id === item.seller_id)?.name || '-';
                const awaiting = item.status === 'paid_by_seller';

                return (
                  <tr key={item.id} className={`border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors ${awaiting ? 'bg-amber-500/5' : ''}`}>
                    <td className="p-3">{sellerName}</td>
                    <td className="p-3">{item.product}</td>
                    <td className="p-3 text-right">R$ {Number(item.original_sale_value).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-center font-medium">{item.installment_number}/{item.total_installments}</td>
                    <td className="p-3 text-right font-medium">R$ {Number(item.installment_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3">
                      <Badge variant={status.variant} className="text-xs gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                      {awaiting && item.marked_paid_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          marcado em {format(new Date(item.marked_paid_at), 'dd/MM/yyyy HH:mm')}
                          {item.marked_paid_note ? ` · "${item.marked_paid_note}"` : ''}
                        </p>
                      )}
                      {item.status === 'confirmed' && item.validated_at && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          validado em {format(new Date(item.validated_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          variant={item.status === 'confirmed' ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => handleStatusChange(item.id, 'confirmed')}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {awaiting ? 'Validar' : 'Confirmar'}
                        </Button>
                        <Button
                          variant={item.status === 'not_confirmed' ? 'destructive' : 'outline'}
                          size="sm"
                          className="h-7 text-xs"
                          disabled={updateStatus.isPending}
                          onClick={() => handleStatusChange(item.id, 'not_confirmed')}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
