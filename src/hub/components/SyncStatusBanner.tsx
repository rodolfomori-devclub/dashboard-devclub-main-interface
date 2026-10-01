import { WifiOff, RefreshCw, CloudOff, CheckCircle2 } from 'lucide-react';
import { usePendingSync } from '@/hooks/usePendingSync';
import { Button } from '@/components/ui/button';

export function SyncStatusBanner() {
  const { queue, online, retryAll, pendingCount } = usePendingSync();

  if (online && pendingCount === 0) return null;

  return (
    <div className="relative z-50">
      {!online && (
        <div className="flex items-center gap-2 px-4 py-2 bg-warning/15 border-b border-warning/30 text-warning text-sm">
          <WifiOff className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">Você está offline. Suas alterações serão salvas localmente e sincronizadas quando a conexão retornar.</span>
        </div>
      )}
      {pendingCount > 0 && online && (
        <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/30 text-error text-sm">
          <CloudOff className="h-4 w-4 flex-shrink-0" />
          <span className="flex-1">
            {pendingCount} alteração(ões) não sincronizada(s).
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs border-destructive/30 text-error hover:bg-destructive/10"
            onClick={retryAll}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Sincronizar
          </Button>
        </div>
      )}
    </div>
  );
}

/** Small inline sync status chip for forms */
export type SyncState = 'idle' | 'saving' | 'saved' | 'error' | 'draft';

export function SyncStatusChip({ state }: { state: SyncState }) {
  if (state === 'idle') return null;

  const config = {
    saving: { label: 'Salvando...', className: 'text-muted-foreground', icon: RefreshCw },
    saved: { label: 'Salvo', className: 'text-success', icon: CheckCircle2 },
    error: { label: 'Não salvo', className: 'text-error', icon: CloudOff },
    draft: { label: 'Rascunho local', className: 'text-warning', icon: CloudOff },
  }[state];

  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs ${config.className}`}>
      <Icon className={`h-3 w-3 ${state === 'saving' ? 'animate-spin' : ''}`} />
      {config.label}
    </span>
  );
}
