import { useState, useCallback, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useNetworkStatus } from './useNetworkStatus';

export interface PendingItem {
  id: string;
  label: string;
  retryFn: () => Promise<void>;
  timestamp: number;
}

/**
 * Global pending sync queue for failed mutations.
 * Retries automatically when network returns.
 */
let globalQueue: PendingItem[] = [];
let listeners: Array<(q: PendingItem[]) => void> = [];

function notify() {
  listeners.forEach(fn => fn([...globalQueue]));
}

export function addPendingItem(item: PendingItem) {
  // Avoid duplicates
  if (!globalQueue.find(i => i.id === item.id)) {
    globalQueue.push(item);
    notify();
  }
}

export function removePendingItem(id: string) {
  globalQueue = globalQueue.filter(i => i.id !== id);
  notify();
}

export function usePendingSync() {
  const [queue, setQueue] = useState<PendingItem[]>([...globalQueue]);
  const { online, wasOffline } = useNetworkStatus();
  const retryingRef = useRef(false);

  useEffect(() => {
    listeners.push(setQueue);
    return () => {
      listeners = listeners.filter(fn => fn !== setQueue);
    };
  }, []);

  // Auto-retry when coming back online
  useEffect(() => {
    if (wasOffline && online && globalQueue.length > 0) {
      retryAll();
    }
  }, [wasOffline, online]);

  const retryAll = useCallback(async () => {
    if (retryingRef.current || globalQueue.length === 0) return;
    retryingRef.current = true;
    toast.info('Sincronizando alterações pendentes...');

    const items = [...globalQueue];
    let successCount = 0;

    for (const item of items) {
      try {
        await item.retryFn();
        removePendingItem(item.id);
        successCount++;
      } catch {
        // Keep in queue
      }
    }

    retryingRef.current = false;

    if (successCount > 0) {
      toast.success(`${successCount} alteração(ões) sincronizada(s) com sucesso`);
    }
    if (globalQueue.length > 0) {
      toast.error(`${globalQueue.length} alteração(ões) ainda pendente(s)`);
    }
  }, []);

  const retryOne = useCallback(async (id: string) => {
    const item = globalQueue.find(i => i.id === id);
    if (!item) return;
    try {
      toast.info('Tentando sincronizar...');
      await item.retryFn();
      removePendingItem(id);
      toast.success('Alteração sincronizada com sucesso');
    } catch {
      toast.error('Falha ao sincronizar. Tente novamente.');
    }
  }, []);

  return { queue, online, retryAll, retryOne, pendingCount: queue.length };
}
