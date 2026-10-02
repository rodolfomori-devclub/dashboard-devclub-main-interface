import { useParams } from 'react-router-dom';
import { WorkspaceGate } from '@/components/diagnostic/WorkspaceFrame';
import { SendView } from '@/components/diagnostic/send/SendView';
import { useDiagnosticWorkspace } from '@/hooks/useDiagnosticWorkspace';
import { DiagnosticScope } from '@/components/diagnostic/DiagnosticScope';

/** Entrega do diagnostico depois da call (dentro do Layout do Hub). */
function DiagnosticSendScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const api = useDiagnosticWorkspace(sessionId);
  return <WorkspaceGate api={api}>{(ready) => <SendView api={ready} />}</WorkspaceGate>;
}

export default function DiagnosticSend() {
  return (
    <DiagnosticScope>
      <DiagnosticSendScreen />
    </DiagnosticScope>
  );
}
