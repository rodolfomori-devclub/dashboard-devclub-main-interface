import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDiagnosticWorkspace } from '@/hooks/useDiagnosticWorkspace';
import { WorkspaceGate } from '@/components/diagnostic/WorkspaceFrame';
import { Cockpit } from '@/components/diagnostic/cockpit/Cockpit';
import { useCockpitLock } from '@/components/diagnostic/cockpit/hooks';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

/** Cockpit da call: tela cheia, fora do Layout do Hub (sem alerta do checklist nem Jarbas por cima). */
function DiagnosticCockpitScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuth();
  // A trava sai antes do workspace: a segunda janela nem le nem grava o rascunho local da que conduz.
  const lock = useCockpitLock(sessionId);
  const api = useDiagnosticWorkspace(sessionId, { passive: lock === 'pending' ? null : lock === 'denied' });
  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceGate api={api}>{(ready) => <Cockpit api={ready} lock={lock} viewerId={user?.id ?? null} />}</WorkspaceGate>
    </div>
  );
}

export default function DiagnosticCockpit() {
  return (
    <DiagnosticScope>
      <DiagnosticCockpitScreen />
    </DiagnosticScope>
  );
}
