import { useParams } from 'react-router-dom';
import { useDiagnosticWorkspace } from '@/hooks/useDiagnosticWorkspace';
import { WorkspaceGate } from '@/components/diagnostic/WorkspaceFrame';
import { PrepWorkspace } from '@/components/diagnostic/prep/PrepWorkspace';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

/** Preparacao da sessao de diagnostico, antes da call (dentro do Layout do Hub). */
function DiagnosticPrepScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const api = useDiagnosticWorkspace(sessionId);
  return <WorkspaceGate api={api}>{(ready) => <PrepWorkspace api={ready} />}</WorkspaceGate>;
}

export default function DiagnosticPrep() {
  return (
    <DiagnosticScope>
      <DiagnosticPrepScreen />
    </DiagnosticScope>
  );
}
