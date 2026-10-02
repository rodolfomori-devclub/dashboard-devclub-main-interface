/**
 * Pecas do autosave do diagnostico (src/hooks/useDiagnosticWorkspace.ts) que
 * nao dependem do React: pedidos ao banco, salvamentos em andamento por sessao,
 * rascunho local e comparacao entre versoes.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { draftStore } from '@/lib/draftStore';
import { withHttpStatus } from '@/lib/diagnostic/errors';
import {
  FROZEN_DIAGNOSIS_FIELDS,
  type DiagnosisFields,
  type Workspace,
  type WorkspacePatch,
  type WorkspaceRows,
} from '@/lib/diagnostic/workspace';
import type { DiagnosisModel } from '@diag/types.ts';

// ---------------------------------------------------------------------------
// Salvamentos em andamento por sessao (sobrevivem a troca de tela)
// ---------------------------------------------------------------------------

/** Pedido em voo (salvar, enviar, reabrir), por sessao. */
const requests = new Map<string, Promise<unknown>>();
/** Descargas (flush) em andamento, por sessao. */
const flushes = new Map<string, Set<Promise<unknown>>>();

function trackRequest<T>(sessionId: string, request: Promise<T>): Promise<T> {
  requests.set(sessionId, request);
  const done = () => {
    if (requests.get(sessionId) === request) requests.delete(sessionId);
  };
  request.then(done, done);
  return request;
}

export function pendingRequest(sessionId: string): Promise<unknown> | undefined {
  return requests.get(sessionId);
}

/** Registrar antes de qualquer await: a tela que abre logo depois espera esta descarga. */
export function trackFlush(sessionId: string, flush: Promise<unknown>): void {
  let set = flushes.get(sessionId);
  if (!set) {
    set = new Set();
    flushes.set(sessionId, set);
  }
  const own = set;
  own.add(flush);
  const done = () => {
    own.delete(flush);
    if (own.size === 0 && flushes.get(sessionId) === own) flushes.delete(sessionId);
  };
  flush.then(done, done);
}

/** Espera o que esta salvando a sessao, inclusive o que comecar enquanto espera. */
export async function settleSaves(sessionId: string): Promise<void> {
  for (let round = 0; round < 20; round++) {
    const waits = [...(flushes.get(sessionId) ?? [])];
    const request = requests.get(sessionId);
    if (request) waits.push(request);
    if (waits.length === 0) return;
    await Promise.allSettled(waits);
  }
}

// ---------------------------------------------------------------------------
// Pedidos ao banco
// ---------------------------------------------------------------------------

/**
 * As linhas como estao no banco agora (sem esperar salvamentos). Consultas
 * simples, uma por tabela: o proxy do Dashboard recusa selects relacionais.
 */
export async function readWorkspaceRows(sessionId: string): Promise<WorkspaceRows | null> {
  const { data: session, error, status } = await supabase
    .from('diagnostic_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();
  if (error) throw withHttpStatus(error, status);
  if (!session) return null;

  const row = session as unknown as Record<string, unknown>;
  const [leadResult, diagnosisResult, qualificationResult] = await Promise.all([
    supabase.from('diagnostic_leads').select('*').eq('id', String(row.lead_id)).maybeSingle(),
    supabase.from('diagnostic_diagnoses').select('*').eq('session_id', sessionId).maybeSingle(),
    supabase
      .from('diagnostic_qualifications')
      .select('*')
      .eq('lead_id', String(row.lead_id))
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  for (const result of [leadResult, diagnosisResult, qualificationResult]) {
    if (result.error) throw withHttpStatus(result.error, result.status);
  }
  const lead = leadResult.data as Record<string, unknown> | null;
  const diagnosis = diagnosisResult.data as Record<string, unknown> | null;
  if (!lead || !diagnosis) return null;

  return {
    session: row,
    lead,
    diagnosis,
    qualification: (qualificationResult.data as Record<string, unknown> | null) ?? null,
  };
}

/** Le o banco depois do salvamento pendente da tela anterior. */
export async function fetchWorkspaceRows(sessionId: string): Promise<WorkspaceRows | null> {
  await settleSaves(sessionId);
  return readWorkspaceRows(sessionId);
}

/** diagnostic_save com o rev conhecido. Devolve o rev novo. */
export function requestSave(patch: WorkspacePatch, expectedRev: number, sent: Workspace): Promise<number> {
  const request = (async () => {
    const { data, error, status } = await supabase.rpc('diagnostic_save', {
      _diagnosis_id: sent.ids.diagnosisId,
      _expected_rev: expectedRev,
      _diagnosis: patch.diagnosis as Json,
      _lead: patch.lead as Json,
      _session: patch.session as Json,
      _qualification: patch.qualification as Json,
    });
    if (error) throw withHttpStatus(error, status);
    return data as number;
  })();
  return trackRequest(sent.ids.sessionId, request);
}

/** Marcar como enviado (com a foto do que o lead recebeu) ou reabrir. Devolve o rev novo. */
export function requestSetStatus(
  saved: Workspace,
  status: 'sent' | 'draft',
  snapshot: DiagnosisModel | null,
): Promise<number> {
  const request = (async () => {
    const { data, error, status: http } = await supabase.rpc('diagnostic_set_status', {
      _diagnosis_id: saved.ids.diagnosisId,
      _expected_rev: saved.rev,
      _status: status,
      ...(snapshot ? { _render_snapshot: snapshot as unknown as Json } : {}),
    });
    if (error) throw withHttpStatus(error, http);
    return data as number;
  })();
  return trackRequest(saved.ids.sessionId, request);
}

// ---------------------------------------------------------------------------
// Rascunho local
// ---------------------------------------------------------------------------

export interface DraftData {
  ws: Workspace;
  /** rev do banco sobre o qual o rascunho foi digitado. */
  baseRev: number;
}

export const draftKey = (diagnosisId: string) => `diag_${diagnosisId}`;

/** Sem a foto do enviado: o rascunho so devolve as secoes editaveis (mergeDraft). */
export function saveDraft(userId: string, ws: Workspace, baseRev: number): void {
  draftStore.save<DraftData>(userId, draftKey(ws.ids.diagnosisId), { ws: { ...ws, renderSnapshot: null }, baseRev });
}

/** Salvo no banco: o rascunho nao serve mais e so ocuparia o localStorage. */
export function clearDraft(userId: string, diagnosisId: string): void {
  draftStore.clear(userId, draftKey(diagnosisId));
}

/** Mantem os metadados do servidor e traz as secoes editadas do rascunho local. */
export function mergeDraft(server: Workspace, draft: Workspace): Workspace {
  return {
    ...server,
    lead: draft.lead,
    qualification: draft.qualification,
    session: draft.session,
    diagnosis: draft.diagnosis,
  };
}

// ---------------------------------------------------------------------------
// Comparacoes
// ---------------------------------------------------------------------------

const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** Enviado: o que o lead recebeu (lead e colunas congeladas) nao muda ate reabrir. */
export function touchesFrozen(current: Workspace, next: Workspace): boolean {
  if (current.status !== 'sent') return false;
  if (!same(current.lead, next.lead)) return true;
  return FROZEN_DIAGNOSIS_FIELDS.some((k) => !same(current.diagnosis[k], next.diagnosis[k]));
}

/** `latest` com o lead e as colunas congeladas de `base` (o que foi enviado). */
export function keepFrozen(base: Workspace, latest: Workspace): Workspace {
  const frozen = Object.fromEntries(FROZEN_DIAGNOSIS_FIELDS.map((k) => [k, base.diagnosis[k]])) as Partial<DiagnosisFields>;
  return { ...latest, lead: base.lead, diagnosis: { ...latest.diagnosis, ...frozen } };
}

/** O banco devolve '14:00:00' e '...+00:00' para o que foi mandado como '14:00' e '...Z'. */
function comparable(v: unknown): unknown {
  if (typeof v !== 'string') return v;
  if (/^\d{2}:\d{2}$/.test(v)) return `${v}:00`;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) return t;
  }
  return v;
}

/** Igualdade que ignora a ordem das chaves (jsonb reordena) e o formato de data do banco. */
function looseSame(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => looseSame(x, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ra = a as Record<string, unknown>;
    const rb = b as Record<string, unknown>;
    return [...new Set([...Object.keys(ra), ...Object.keys(rb)])].every((k) => looseSame(ra[k], rb[k]));
  }
  return comparable(a) === comparable(b);
}

/** As quatro secoes editaveis tem o mesmo conteudo. */
export function sameSections(a: Workspace, b: Workspace): boolean {
  return (['lead', 'qualification', 'session', 'diagnosis'] as const).every((k) => looseSame(a[k], b[k]));
}
