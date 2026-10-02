/**
 * Enviar e reabrir o diagnostico (diagnostic_set_status). Parte do autosave de
 * useDiagnosticWorkspace, separada so por tamanho: recebe as mesmas refs.
 */
import { useCallback, type MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { SyncState } from '@/components/SyncStatusBanner';
import type { AuthUser } from '@/contexts/AuthContext';
import { logActivity } from '@/lib/activityLogger';
import { diffWorkspace, isEmptyPatch, type Workspace } from '@/lib/diagnostic/workspace';
import { clearDraft, keepFrozen, requestSetStatus, saveDraft, touchesFrozen } from '@/lib/diagnostic/workspaceSync';
import { diagnosticErrorMessage, isConflictError } from '@/lib/diagnostic/errors';
import { validateForDelivery } from '@diag/derive.ts';
import type { DiagnosisInput, DiagnosisModel, ValidationIssue } from '@diag/types.ts';

export const FLUSH_FAILED = 'Não foi possível salvar as últimas alterações. Tente de novo.';
export const FROZEN_NOTICE = 'Diagnóstico já enviado. Para corrigir o que o lead recebeu, reabra na tela de entrega.';

export type MarkSentResult = { ok: true } | { ok: false; issues?: ValidationIssue[]; message?: string };

export interface StatusActionsContext {
  wsRef: MutableRefObject<Workspace | null>;
  savedRef: MutableRefObject<Workspace | null>;
  savingRef: MutableRefObject<boolean>;
  dirtyRef: MutableRefObject<boolean>;
  againRef: MutableRefObject<boolean>;
  stoppedRef: MutableRefObject<boolean>;
  setLocal: (ws: Workspace) => void;
  setConflict: (conflict: boolean) => void;
  setSync: (state: SyncState) => void;
  scheduleSave: (delay: number) => void;
  flush: () => Promise<boolean>;
  qc: QueryClient;
  user: AuthUser | null;
  input: DiagnosisInput | null;
  liveModel: DiagnosisModel | null;
}

export function useWorkspaceStatusActions(ctx: StatusActionsContext) {
  const {
    wsRef,
    savedRef,
    savingRef,
    dirtyRef,
    againRef,
    stoppedRef,
    setLocal,
    setConflict,
    setSync,
    scheduleSave,
    flush,
    qc,
    user,
    input,
    liveModel,
  } = ctx;
  const userId = user?.id;

  /**
   * Enviar ou reabrir. O autosave espera a resposta (os dois mudam o rev) e o
   * que foi digitado nesse meio-tempo continua pendente sobre o rev novo.
   */
  const changeStatus = useCallback(
    async (
      status: 'sent' | 'draft',
      snapshot: DiagnosisModel | null,
      settle: (rev: number) => { saved: Workspace; local: Workspace },
    ): Promise<string | null> => {
      const saved = savedRef.current;
      if (!saved) return 'Diagnóstico ainda carregando.';
      savingRef.current = true;
      try {
        const rev = await requestSetStatus(saved, status, snapshot);
        const next = settle(rev);
        savedRef.current = next.saved;
        setLocal(next.local);
        if (isEmptyPatch(diffWorkspace(next.saved, next.local))) {
          dirtyRef.current = false;
          if (userId) clearDraft(userId, saved.ids.diagnosisId);
        } else {
          dirtyRef.current = true;
          if (userId) saveDraft(userId, next.local, rev);
          againRef.current = true;
        }
        qc.invalidateQueries({ queryKey: ['diagnostic_sessions'] });
        if (user) {
          logActivity({
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            action: status === 'sent' ? 'DIAGNOSIS_SENT' : 'DIAGNOSIS_REOPENED',
            details: saved.lead.name,
            entityType: 'diagnostic_diagnosis',
            entityId: saved.ids.diagnosisId,
          });
        }
        return null;
      } catch (err) {
        if (isConflictError(err)) {
          stoppedRef.current = true;
          setConflict(true);
          setSync('error');
        }
        return diagnosticErrorMessage(err);
      } finally {
        savingRef.current = false;
        if (againRef.current) {
          againRef.current = false;
          scheduleSave(0);
        }
      }
    },
    [againRef, dirtyRef, qc, savedRef, savingRef, scheduleSave, setConflict, setLocal, setSync, stoppedRef, user, userId],
  );

  const markSent = useCallback(async (): Promise<MarkSentResult> => {
    const clicked = wsRef.current;
    if (!(await flush())) return { ok: false, message: FLUSH_FAILED };
    const current = wsRef.current;
    if (!current || !input || !liveModel) return { ok: false, message: 'Diagnóstico ainda carregando.' };
    // A pending autosave may take long enough for more answers to be edited.
    // Never freeze those new answers with the older PDF captured by this click.
    if (clicked && touchesFrozen({ ...clicked, status: 'sent' }, current)) {
      return { ok: false, message: 'O diagnóstico mudou durante o salvamento. Revise o PDF e tente marcar como enviado novamente.' };
    }
    const found = validateForDelivery(input, liveModel);
    if (found.length > 0) return { ok: false, issues: found };
    const now = new Date().toISOString();
    const asSent = (w: Workspace, rev: number): Workspace => ({
      ...w,
      rev,
      status: 'sent',
      sentAt: now,
      firstSentAt: w.firstSentAt ?? now,
      renderSnapshot: liveModel,
      session: { ...w.session, status: w.session.status === 'scheduled' ? 'completed' : w.session.status },
    });
    const message = await changeStatus('sent', liveModel, (rev) => {
      const latest = wsRef.current ?? current;
      // O lead recebeu o que estava na tela no clique; o resto digitado durante o envio segue pendente.
      if (touchesFrozen(asSent(current, rev), latest)) toast.info(FROZEN_NOTICE, { id: 'diag-frozen' });
      return { saved: asSent(savedRef.current ?? current, rev), local: asSent(keepFrozen(current, latest), rev) };
    });
    return message ? { ok: false, message } : { ok: true };
  }, [changeStatus, flush, input, liveModel, savedRef, wsRef]);

  const reopen = useCallback(async (): Promise<boolean> => {
    // Antes salva o que esta pendente (ex.: bolsa "Fechou" esperando a rede voltar).
    if (!(await flush())) {
      toast.error(FLUSH_FAILED);
      return false;
    }
    const current = wsRef.current;
    if (!current) return false;
    const message = await changeStatus('draft', null, (rev) => ({
      saved: { ...(savedRef.current ?? current), rev, status: 'draft' },
      local: { ...(wsRef.current ?? current), rev, status: 'draft' },
    }));
    if (message) toast.error(message);
    return !message;
  }, [changeStatus, flush, savedRef, wsRef]);

  return { markSent, reopen };
}
