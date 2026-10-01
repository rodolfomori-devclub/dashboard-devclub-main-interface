import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, CheckCircle2, XCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { WhatsAppIconButton } from '@/components/meetings/WhatsAppButton';

interface FutureCommissionsProps {
  installments: any[];
  showSeller?: boolean;
  profiles?: any[];
}

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
  pending: { label: 'Pendente', variant: 'outline', icon: Clock },
  confirmed: { label: 'Confirmada', variant: 'default', icon: CheckCircle2 },
  not_confirmed: { label: 'Não Confirmada', variant: 'destructive', icon: XCircle },
};

export function FutureCommissions({ installments, showSeller, profiles }: FutureCommissionsProps) {
  const futureItems = useMemo(() => {
    return installments.filter(i => i.status === 'pending' || i.status === 'confirmed' || i.status === 'not_confirmed');
  }, [installments]);

  const totalPending = futureItems.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.installment_amount), 0);
  const totalConfirmed = futureItems.filter(i => i.status === 'confirmed').reduce((s, i) => s + Number(i.installment_amount), 0);
  const totalNotConfirmed = futureItems.filter(i => i.status === 'not_confirmed').reduce((s, i) => s + Number(i.installment_amount), 0);

  if (futureItems.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Pipeline de Comissões Futuras
      </h3>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Pendentes</p>
          <p className="text-xl font-semibold text-foreground mt-1">R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">{futureItems.filter(i => i.status === 'pending').length} parcelas</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Confirmadas</p>
          <p className="text-xl font-semibold text-emerald-500 mt-1">R$ {totalConfirmed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">{futureItems.filter(i => i.status === 'confirmed').length} parcelas</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-muted-foreground">Não Confirmadas</p>
          <p className="text-xl font-semibold text-error mt-1">R$ {totalNotConfirmed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-muted-foreground">{futureItems.filter(i => i.status === 'not_confirmed').length} parcelas</p>
        </div>
      </div>

      {/* Detail table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                {showSeller && <th className="text-left p-3 font-medium text-muted-foreground">Vendedor</th>}
                <th className="text-left p-3 font-medium text-muted-foreground">Produto</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Cliente</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Venda Original</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Parcela</th>
                <th className="text-right p-3 font-medium text-muted-foreground">Valor Parcela</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Mês Esperado</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {futureItems.map((item: any) => {
                const status = STATUS_MAP[item.status] || STATUS_MAP.pending;
                const StatusIcon = status.icon;
                const sellerName = showSeller && profiles ? profiles.find((p: any) => p.id === item.seller_id)?.name || '-' : '';
                const monthName = format(new Date(item.expected_year, item.expected_month - 1, 1), 'MMM yyyy', { locale: ptBR });

                return (
                  <tr key={item.id} className="border-b border-border/30 last:border-0 hover:bg-accent/20 transition-colors">
                    {showSeller && <td className="p-3">{sellerName}</td>}
                    <td className="p-3">{item.product}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{item.client_name || <span className="text-muted-foreground">—</span>}</span>
                        {item.client_whatsapp && <WhatsAppIconButton phone={item.client_whatsapp} tokens={{ client_name: item.client_name || '' }} />}
                      </div>
                    </td>
                    <td className="p-3 text-right">R$ {Number(item.original_sale_value).toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-center font-medium">{item.installment_number}/{item.total_installments}</td>
                    <td className="p-3 text-right font-medium">R$ {Number(item.installment_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="p-3 capitalize">{monthName}</td>
                    <td className="p-3">
                      <Badge variant={status.variant} className="text-xs gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
