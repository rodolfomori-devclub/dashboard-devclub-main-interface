import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, Loader2, MonitorPlay } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { ReadyWorkspace } from '@/components/diagnostic/WorkspaceFrame';
import { diagnosticPaths } from '@/lib/diagnostic/routes';
import { patchPrepConfig } from '@/lib/diagnostic/workspace';
import { openBlockers, type PrepChecklistItem } from '@/lib/diagnostic/prepChecklist';

/**
 * "Comecar a call": marca a preparacao como pronta, salva tudo e abre o
 * cockpit. Com bloqueio em aberto pergunta antes; a call funciona assim mesmo.
 */
export function StartCallButton({ api, items }: { api: ReadyWorkspace; items: PrepChecklistItem[] }) {
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const mountedRef = useRef(true);
  const { ws } = api;
  const cockpit = diagnosticPaths.cockpit(ws.ids.sessionId);
  const blockers = openBlockers(items);

  const label =
    ws.status === 'sent' || !api.canEdit ? 'Abrir a call' : ws.session.call_started_at ? 'Voltar à call' : 'Começar a call';
  const asksFirst = label === 'Começar a call' && blockers.length > 0;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const start = async () => {
    setConfirming(false);
    setStarting(true);
    api.update((w) => (w.diagnosis.prep_config.readyAt ? w : patchPrepConfig(w, { readyAt: new Date().toISOString() })));
    const saved = await api.flush();
    // Saiu da preparacao enquanto salvava: o navigate do router ainda funcionaria e puxaria para a call.
    if (!mountedRef.current) return;
    setStarting(false);
    if (saved) {
      navigate(cockpit);
      return;
    }
    toast.error('Não deu para salvar as últimas alterações.', {
      description: 'Veja o aviso no topo da página. Se abrir a call agora, o que não foi salvo pode se perder.',
      action: { label: 'Abrir assim mesmo', onClick: () => navigate(cockpit) },
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        className="gap-1.5"
        onClick={() => (asksFirst ? setConfirming(true) : void start())}
        disabled={starting}
      >
        {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorPlay className="h-4 w-4" />}
        {label}
      </Button>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Falta confirmar antes da call</AlertDialogTitle>
            <AlertDialogDescription>
              A call funciona assim mesmo, mas estes itens mudam o diagnóstico e o que você pode mostrar no fim.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2">
            {blockers.map((b) => (
              <li key={b.id} className="flex gap-2 text-sm">
                <CircleAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <span>
                  <span className="text-foreground font-medium">{b.label}</span>
                  {b.hint && <span className="block text-xs text-muted-foreground">{b.hint}</span>}
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e completar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void start()}>Começar assim mesmo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
