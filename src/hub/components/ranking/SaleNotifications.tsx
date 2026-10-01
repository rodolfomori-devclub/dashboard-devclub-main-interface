import { useEffect, useState } from 'react';
import { DollarSign } from 'lucide-react';
import { SellerAvatar } from '@/components/SellerAvatar';

export interface SaleNotificationData {
  id: string;
  sellerName: string;
  sellerInitials: string;
  sellerAvatarUrl?: string | null;
  amount: number;
  product: string;
  timestamp: number;
}

interface SaleNotificationsProps {
  sales: SaleNotificationData[];
  variant?: 'default' | 'tv';
}

function SaleNotificationCard({ sale, variant }: { sale: SaleNotificationData; variant: 'default' | 'tv' }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const isTv = variant === 'tv';

  return (
    <div
      className={`flex items-center gap-3 glass-card border border-primary/20 shadow-[0_0_20px_-5px_color-mix(in_oklch,var(--primary)_30%,transparent)] transition-all duration-500 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      } ${isTv ? 'px-6 py-4' : 'px-4 py-3'}`}
    >
      <SellerAvatar
        name={sale.sellerName}
        avatarUrl={sale.sellerAvatarUrl}
        size={isTv ? 'md' : 'sm'}
        borderColor="border-primary/30"
      />
      <div className="min-w-0 flex-1">
        <p className={`font-semibold text-foreground truncate ${isTv ? 'text-base' : 'text-sm'}`}>
          💰 {sale.sellerName.split(' ')[0]} fez uma venda!
        </p>
        <p className={`text-muted-foreground truncate ${isTv ? 'text-sm' : 'text-xs'}`}>
          R$ {sale.amount.toLocaleString('pt-BR')} — {sale.product}
        </p>
      </div>
      <DollarSign className={`text-primary flex-shrink-0 ${isTv ? 'h-5 w-5' : 'h-4 w-4'}`} />
    </div>
  );
}

export function SaleNotifications({ sales, variant = 'default' }: SaleNotificationsProps) {
  if (sales.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[9990] space-y-2 max-w-sm w-full">
      {sales.map(sale => (
        <SaleNotificationCard key={sale.id} sale={sale} variant={variant} />
      ))}
    </div>
  );
}
