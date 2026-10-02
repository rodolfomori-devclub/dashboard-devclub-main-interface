/**
 * Estado editavel de um diagnostico + autosave seguro para 45 minutos de call.
 *
 * - O estado local e a fonte da verdade enquanto a tela esta aberta: cada tela
 *   le o banco uma vez ao abrir (nada de linhas guardadas de outra etapa, sem
 *   refetch ao voltar o foco, fora do realtime).
 * - Cada mudanca vai na hora para o localStorage (draftStore) e, 1,2 s depois
 *   da ultima, para diagnostic_save com o `rev` conhecido. A resposta do
 *   servidor nunca sobrescreve o que foi digitado enquanto a requisicao voava.
 * - Sem rede ou servidor instavel: guarda local, tenta de novo com espera crescente.
 * - Outra janela salvou antes: para tudo e pergunta qual versao manter.
 * - Ao esconder a aba, fechar ou sair da tela: salva na hora. Uma tela que abre
 *   espera o salvamento pendente da anterior antes de ler o banco.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { draftStore } from '@/lib/draftStore';
import type { SyncState } from '@/components/SyncStatusBanner';
import { useDiagnosticContent, useDiagnosticSettings } from '@/hooks/useDiagnosticData';
import { FROZEN_NOTICE, useWorkspaceStatusActions, type MarkSentResult } from '@/hooks/useWorkspaceStatusActions';
import { diffWorkspace, fullPatch, isEmptyPatch, toDiagnosisInput, workspaceFromRows, type Workspace } from '@/lib/diagnostic/workspace';
import {
  clearDraft,
  draftKey,
  fetchWorkspaceRows,
  mergeDraft,
  pendingRequest,
  readWorkspaceRows,
  requestSave,
  sameSections,
  saveDraft,
  touchesFrozen,
  trackFlush,
  type DraftData,
} from '@/lib/diagnostic/workspaceSync';
import { diagnosticErrorMessage, isConflictError, isTransientError } from '@/lib/diagnostic/errors';
import { EMPTY_OFFER_SETTINGS } from '@/lib/diagnostic/settings';
import type { DiagnosticWorkspaceApi, DiagnosticWorkspaceOptions } from '@/lib/diagnostic/workspaceApi';
import { deriveDiagnosis, validateForDelivery } from '@diag/derive.ts';
import { conditionLine, evaluateOffer } from '@diag/offer.ts';
import { todayYmd } from '@diag/dates.ts';
import type { DiagnosisInput, DiagnosisModel, OfferEvaluation, ValidationIssue } from '@diag/types.ts';

const SAVE_DEBOUNCE_MS = 1200;
const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];

/** Cada tela aberta tem a propria leitura do banco. */
let mountSeq = 0;

/** Tentativa sem resposta (rede, gateway): o banco pode ter gravado mesmo assim. */
interface UnconfirmedSave {
  sent: Workspace;
  rev: number;
}

export type { MarkSentResult, DiagnosticWorkspaceApi, DiagnosticWorkspaceOptions };

export function useDiagnosticWorkspace(
  sessionId: string | undefined,
  options: DiagnosticWorkspaceOptions = {},
): DiagnosticWorkspaceApi {
  const { user, isManager } = useAuth();
  const lockPending = options.passive === null;
  const passive = options.passive === true;
  const qc = useQueryClient();
  const [mountId] = useState(() => ++mountSeq);

  const query = useQuery({
    // Uma entrada por tela: trocar de etapa sempre le de novo, depois do salvamento da anterior.
    queryKey: ['diagnostic_workspace', sessionId, mountId],
    enabled: !!sessionId,
    queryFn: () => fetchWorkspaceRows(sessionId as string),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const [ws, setWs] = useState<Workspace | null>(null);
  const [sync, setSync] = useState<SyncState>('idle');
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const wsRef = useRef<Workspace | null>(null);
  const savedRef = useRef<Workspace | null>(null);
  const savingRef = useRef(false);
  const againRef = useRef(false);
  const dirtyRef = useRef(false);
  const stoppedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const retryRef = useRef(0);
  const initRef = useRef(false);
  const saveRef = useRef<() => Promise<boolean>>(async () => true);
  const canEditRef = useRef(false);
  const passiveRef = useRef(passive);
  passiveRef.current = passive;
  const unconfirmedRef = useRef<UnconfirmedSave[]>([]);

  const contentQuery = useDiagnosticContent(ws?.contentVersionId ?? null, { enabled: !!ws });
  const settingsQuery = useDiagnosticSettings();
  const settings = settingsQuery.data?.offer ?? EMPTY_OFFER_SETTINGS;
  // O conteudo so existe no banco: sem ele a tela mostra o erro com "tentar de novo".
  const content = contentQuery.data?.content ?? null;

  const userId = user?.id;

  const setLocal = useCallback((next: Workspace) => {
    wsRef.current = next;
    setWs(next);
  }, []);

  const scheduleSave = useCallback((delay: number) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void saveRef.current();
    }, delay);
  }, []);

  // Carrega uma vez e, se houver, recupera o rascunho local
  useEffect(() => {
    if (initRef.current || !query.data || lockPending) return;
    initRef.current = true;
    const server = workspaceFromRows(query.data);
    let initial = server;
    // Tela passiva: o rascunho local e da janela que conduz a call; nem le nem apaga.
    if (userId && !passive) {
      const draft = draftStore.load<DraftData>(userId, draftKey(server.ids.diagnosisId));
      const pending = draft && !draft.synced && draft.data?.ws ? draft.data : null;
      if (pending && pending.baseRev === server.rev) {
        initial = mergeDraft(server, pending.ws);
      } else if (draft) {
        clearDraft(userId, server.ids.diagnosisId);
        if (pending && !sameSections(pending.ws, server)) {
          toast.warning('Havia alterações locais antigas deste diagnóstico. Ficou valendo a versão salva.');
        }
      }
    }
    savedRef.current = server;
    setLocal(initial);
    if (initial !== server) {
      dirtyRef.current = true;
      setSync('draft');
      scheduleSave(300);
    }
  }, [query.data, userId, setLocal, scheduleSave, lockPending, passive]);

  /** Depois de gravar `sent`, ajusta rev e decide se ainda ha o que salvar. */
  const afterSaved = useCallback(
    (sent: Workspace, newRev: number) => {
      savedRef.current = { ...sent, rev: newRev };
      const current = wsRef.current;
      if (current) setLocal({ ...current, rev: newRev });
      retryRef.current = 0;
      unconfirmedRef.current = [];
      setSaveError(null);
      const latest = wsRef.current;
      if (latest && !isEmptyPatch(diffWorkspace(savedRef.current, latest))) {
        // O que foi digitado durante o salvamento passa a valer sobre o rev novo.
        if (userId) saveDraft(userId, latest, newRev);
        scheduleSave(400);
        return;
      }
      dirtyRef.current = false;
      if (userId) clearDraft(userId, sent.ids.diagnosisId);
      setSync('saved');
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => setSync((s) => (s === 'saved' ? 'idle' : s)), 2000);
    },
    [scheduleSave, setLocal, userId],
  );

  const handleSaveError = useCallback(
    (err: unknown) => {
      if (isConflictError(err)) {
        stoppedRef.current = true;
        setConflict(true);
        setSync('error');
        return;
      }
      if (isTransientError(err)) {
        setSync('draft');
        const delay = RETRY_DELAYS_MS[Math.min(retryRef.current, RETRY_DELAYS_MS.length - 1)];
        retryRef.current += 1;
        scheduleSave(delay);
        return;
      }
      stoppedRef.current = true;
      const message = diagnosticErrorMessage(err);
      setSaveError(message);
      setSync('error');
      toast.error(message);
    },
    [scheduleSave],
  );

  /**
   * DIAG_CONFLICT depois de uma tentativa sem resposta: se o banco subiu um rev
   * e tem exatamente o que foi mandado, quem gravou foi esta tela. Segue sem
   * perguntar (nao havia outra janela).
   */
  const adoptUnconfirmed = useCallback(
    async (expectedRev: number, sent: Workspace): Promise<boolean> => {
      const attempts = unconfirmedRef.current.filter((a) => a.rev === expectedRev);
      if (attempts.length === 0) return false;
      try {
        // sem esperar salvamentos pendentes: o pendente e este
        const rows = await readWorkspaceRows(sent.ids.sessionId);
        if (!rows) return false;
        const server = workspaceFromRows(rows);
        if (server.rev !== expectedRev + 1) return false;
        const mine = attempts.find((a) => a.sent.status === server.status && sameSections(a.sent, server));
        if (!mine) return false;
        afterSaved(mine.sent, server.rev);
        return true;
      } catch {
        return false;
      }
    },
    [afterSaved],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const current = wsRef.current;
    const saved = savedRef.current;
    if (!current || !saved || passiveRef.current) return true;
    if (stoppedRef.current) return false;
    if (savingRef.current) {
      againRef.current = true;
      return true;
    }
    const patch = diffWorkspace(saved, current);
    if (isEmptyPatch(patch)) {
      dirtyRef.current = false;
      if (userId) clearDraft(userId, current.ids.diagnosisId);
      setSync((s) => (s === 'saving' || s === 'draft' ? 'idle' : s));
      return true;
    }
    savingRef.current = true;
    setSync('saving');
    try {
      const newRev = await requestSave(patch, saved.rev, current);
      afterSaved(current, newRev);
      return true;
    } catch (err) {
      if (isConflictError(err) && (await adoptUnconfirmed(saved.rev, current))) return true;
      if (isTransientError(err)) {
        const list = unconfirmedRef.current;
        if (list[list.length - 1]?.sent !== current) unconfirmedRef.current = [...list.slice(-9), { sent: current, rev: saved.rev }];
      }
      handleSaveError(err);
      return false;
    } finally {
      savingRef.current = false;
      if (againRef.current) {
        againRef.current = false;
        scheduleSave(0);
      }
    }
  }, [adoptUnconfirmed, afterSaved, handleSaveError, scheduleSave, userId]);

  saveRef.current = save;

  const update = useCallback(
    (fn: (w: Workspace) => Workspace) => {
      const current = wsRef.current;
      // Quem so pode ver (outro vendedor) nunca dispara salvamento.
      if (!current || !canEditRef.current) return;
      const next = fn(current);
      if (next === current) return;
      if (touchesFrozen(current, next)) {
        toast.info(FROZEN_NOTICE, { id: 'diag-frozen' });
        return;
      }
      setLocal(next);
      dirtyRef.current = true;
      if (userId && savedRef.current) saveDraft(userId, next, savedRef.current.rev);
      if (!stoppedRef.current) {
        setSync((s) => (s === 'error' ? s : 'saving'));
        scheduleSave(SAVE_DEBOUNCE_MS);
      }
    },
    [scheduleSave, setLocal, userId],
  );

  const flushNow = useCallback(async (): Promise<boolean> => {
    for (let attempt = 0; attempt < 6; attempt++) {
      clearTimeout(timerRef.current);
      const sid = wsRef.current?.ids.sessionId;
      const pending = sid ? pendingRequest(sid) : undefined;
      if (pending || savingRef.current) {
        if (pending) await pending.catch(() => undefined);
        // deixa a continuacao do save() em andamento terminar
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (stoppedRef.current) return false;
      if (savingRef.current) continue;
      const ok = await saveRef.current();
      if (!ok) return false;
      const saved = savedRef.current;
      const current = wsRef.current;
      if (!savingRef.current && (!saved || !current || isEmptyPatch(diffWorkspace(saved, current)))) {
        clearTimeout(timerRef.current);
        return true;
      }
    }
    return false;
  }, []);

  /** Salva agora e so resolve quando nao ha nada pendente (ou o autosave parou). */
  const flush = useCallback((): Promise<boolean> => {
    const run = flushNow();
    const sid = wsRef.current?.ids.sessionId;
    if (sid) trackFlush(sid, run);
    return run;
  }, [flushNow]);

  // Salva na hora ao esconder a aba, fechar a janela ou sair da tela
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current) void flush();
    };
    const onPageHide = () => {
      if (dirtyRef.current) void flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      clearTimeout(idleTimerRef.current);
      if (dirtyRef.current) void flush();
    };
  }, [flush]);

  const resolveConflict = useCallback(
    async (keep: 'mine' | 'theirs') => {
      const current = wsRef.current;
      if (!current) return;
      unconfirmedRef.current = [];
      if (keep === 'theirs') {
        const rows = await readWorkspaceRows(current.ids.sessionId).catch((err: unknown) => {
          toast.error(diagnosticErrorMessage(err));
          return null;
        });
        if (!rows) return;
        const server = workspaceFromRows(rows);
        savedRef.current = server;
        setLocal(server);
        if (userId) clearDraft(userId, server.ids.diagnosisId);
        dirtyRef.current = false;
        stoppedRef.current = false;
        setConflict(false);
        setSync('idle');
        return;
      }
      const { data, error } = await supabase
        .from('diagnostic_diagnoses')
        .select('rev')
        .eq('id', current.ids.diagnosisId)
        .single();
      if (error || !data) {
        toast.error(diagnosticErrorMessage(error));
        return;
      }
      try {
        setSync('saving');
        const newRev = await requestSave(fullPatch(current), data.rev, current);
        stoppedRef.current = false;
        setConflict(false);
        afterSaved(current, newRev);
      } catch (err) {
        handleSaveError(err);
      }
    },
    [afterSaved, handleSaveError, setLocal, userId],
  );

  // Derivados
  const offer = useMemo<OfferEvaluation | null>(() => {
    if (!ws) return null;
    const now = Date.now();
    return evaluateOffer(ws.diagnosis.prep_config.offer, settings, {
      todayYmd: todayYmd(now),
      sessionYmd: ws.session.scheduled_date ?? '',
      nowMs: now,
    });
  }, [ws, settings]);

  const input = useMemo<DiagnosisInput | null>(() => {
    if (!ws || !offer) return null;
    const presented = ws.diagnosis.scholarship_status !== 'none';
    return toDiagnosisInput(ws, presented ? conditionLine(offer.view) : null);
  }, [ws, offer]);

  const liveModel = useMemo<DiagnosisModel | null>(
    () => (input && content ? deriveDiagnosis(input, content) : null),
    [input, content],
  );

  const model = ws?.status === 'sent' && ws.renderSnapshot ? ws.renderSnapshot : liveModel;

  const issues = useMemo<ValidationIssue[]>(
    () => (input && liveModel ? validateForDelivery(input, liveModel) : []),
    [input, liveModel],
  );

  const { markSent, reopen } = useWorkspaceStatusActions({
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
  });

  const canEdit = !!ws && !!user && !passive && (ws.consultantId === user.id || isManager);
  canEditRef.current = canEdit;

  const { refetch } = query;
  const { refetch: refetchContent } = contentQuery;
  const { refetch: refetchSettings } = settingsQuery;
  // Only a first load that failed blocks the screen; a failed background refetch keeps
  // the data. For the workspace this also covers the Hub-wide "Tentar novamente": an
  // open cockpit is never replaced (its local state is the source of truth).
  const workspaceFailed = query.isError && !query.isFetching && !query.data;
  const contentFailed = contentQuery.isError && !contentQuery.isFetching && !contentQuery.data;
  const settingsFailed = settingsQuery.isError && !settingsQuery.isFetching && !settingsQuery.data;
  const retryLoad = useCallback(() => {
    if (workspaceFailed) void refetch();
    if (contentFailed) void refetchContent();
    if (settingsFailed) void refetchSettings();
  }, [workspaceFailed, refetch, contentFailed, refetchContent, settingsFailed, refetchSettings]);
  const loadFailure = workspaceFailed ? query.error : contentFailed ? contentQuery.error : settingsFailed ? settingsQuery.error : null;

  return {
    // Os numeros da Head entram no calculo da oferta: sem eles a bolsa sairia sem ancora.
    loading:
      !loadFailure &&
      (query.isLoading || (!!query.data && !ws) || (!!ws && !content) || !settingsQuery.data || lockPending),
    notFound: query.isSuccess && query.data === null,
    // Enquanto tenta de novo, a tela volta para o carregando.
    loadError: loadFailure ? diagnosticErrorMessage(loadFailure) : null,
    retryLoad,
    ws,
    content,
    settings,
    offer,
    input,
    model,
    issues,
    canEdit,
    passive,
    frozen: ws?.status === 'sent',
    sync,
    conflict,
    saveError,
    update,
    flush,
    resolveConflict,
    markSent,
    reopen,
  };
}
