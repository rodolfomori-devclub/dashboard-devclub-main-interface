import type { OvertakeNotification } from '@/hooks/useSalesRanking';

interface Props {
  notifications: OvertakeNotification[];
}

export function OvertakeNotifications({ notifications }: Props) {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map(n => (
        <div key={n.id} className="animate-fade-in glass-card px-5 py-3 text-sm font-medium shadow-2xl max-w-md border-primary/30">
          {n.message}
        </div>
      ))}
    </div>
  );
}
