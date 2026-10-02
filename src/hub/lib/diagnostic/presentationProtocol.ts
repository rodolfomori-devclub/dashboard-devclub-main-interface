/**
 * Protocolo v1 entre o cockpit e a tela do lead: mensagens, envelope,
 * validacao do que chega (fronteira entre janelas) e o retrato guardado em
 * localStorage. Sempre retratos completos (idempotente):
 *   cockpit -> lead: STATE { seq, sentAt, vm }, PING, BYE
 *   lead -> cockpit: HELLO (pede o estado), ACK { seq, sceneId, step, visibility, fontsReady, at }, BYE
 */
import { isLeadViewModel, isSceneId, type LeadViewModel, type SceneId } from '@/lib/diagnostic/presentation';

export type PresentationSide = 'cockpit' | 'lead';

export interface StateMessage {
  type: 'STATE';
  seq: number;
  sentAt: number;
  vm: LeadViewModel;
}
export interface PingMessage {
  type: 'PING';
  at: number;
}
export interface HelloMessage {
  type: 'HELLO';
  at: number;
}
export interface AckMessage {
  type: 'ACK';
  /** Ultimo STATE aplicado pela tela (0 = nenhum). */
  seq: number;
  sceneId: SceneId | null;
  step: number;
  visibility: 'visible' | 'hidden';
  fontsReady: boolean;
  at: number;
}
export interface ByeMessage {
  type: 'BYE';
  at: number;
}
export type CockpitMessage = StateMessage | PingMessage | ByeMessage;
export type LeadMessage = HelloMessage | AckMessage | ByeMessage;
export type PresentationMessage = CockpitMessage | LeadMessage;

export interface LeadStatus {
  visibility: 'visible' | 'hidden';
  fontsReady: boolean;
}

const PROTOCOL = 'diag-sessao';
/** Retrato mais velho que isso nao repinta a tela (sessao de outro dia). */
const SNAPSHOT_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const channelName = (sessionId: string) => `${PROTOCOL}:${sessionId}`;
export const snapshotKey = (sessionId: string) => `diag_sessao_${sessionId}`;
export const messageKey = (sessionId: string, from: PresentationSide) => `diag_sessao_${sessionId}:${from}`;

export function envelope(sessionId: string, from: PresentationSide, msg: PresentationMessage) {
  return { p: PROTOCOL, v: 1, ch: channelName(sessionId), from, msg };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function parseMessage(m: unknown, from: PresentationSide): PresentationMessage | null {
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.type === 'BYE') return isNum(o.at) ? { type: 'BYE', at: o.at } : null;
  if (from === 'cockpit') {
    if (o.type === 'STATE') {
      return isNum(o.seq) && isNum(o.sentAt) && isLeadViewModel(o.vm)
        ? { type: 'STATE', seq: o.seq, sentAt: o.sentAt, vm: o.vm }
        : null;
    }
    if (o.type === 'PING') return isNum(o.at) ? { type: 'PING', at: o.at } : null;
    return null;
  }
  if (o.type === 'HELLO') return isNum(o.at) ? { type: 'HELLO', at: o.at } : null;
  if (o.type === 'ACK') {
    const okScene = o.sceneId === null || isSceneId(o.sceneId);
    const okVis = o.visibility === 'visible' || o.visibility === 'hidden';
    if (!isNum(o.seq) || !okScene || !isNum(o.step) || !okVis || typeof o.fontsReady !== 'boolean' || !isNum(o.at)) {
      return null;
    }
    return {
      type: 'ACK',
      seq: o.seq,
      sceneId: o.sceneId as SceneId | null,
      step: o.step,
      visibility: o.visibility as 'visible' | 'hidden',
      fontsReady: o.fontsReady,
      at: o.at,
    };
  }
  return null;
}

/** Mensagem valida desta sessao vinda do lado `from`, ou null. */
export function parseEnvelope(data: unknown, sessionId: string, from: PresentationSide): PresentationMessage | null {
  if (!data || typeof data !== 'object') return null;
  const e = data as Record<string, unknown>;
  if (e.p !== PROTOCOL || e.v !== 1 || e.ch !== channelName(sessionId) || e.from !== from) return null;
  return parseMessage(e.msg, from);
}

/** ACK do que esta aplicado. Pausa (sem cena): sceneId null. */
export function ackFor(applied: StateMessage | null, status: LeadStatus, at: number): AckMessage {
  const scene = applied?.vm.scene ?? null;
  return {
    type: 'ACK',
    seq: applied?.seq ?? 0,
    sceneId: scene ? scene.id : null,
    step: scene ? scene.step : 0,
    visibility: status.visibility,
    fontsReady: status.fontsReady,
    at,
  };
}

// ---------------------------------------------------------------------------
// Armazenamento (reserva e retrato para recarregar)
// ---------------------------------------------------------------------------

export function storageGet(storage: Storage | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function storageSet(storage: Storage | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // cota cheia ou armazenamento bloqueado: o canal principal segue
  }
}

export function storageRemove(storage: Storage | null, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    // idem
  }
}

/** Ultimo retrato que o cockpit guardou, se ainda for desta sessao de trabalho. */
export function readSnapshot(sessionId: string, env: { storage: Storage | null; now: () => number }): StateMessage | null {
  const raw = storageGet(env.storage, snapshotKey(sessionId));
  if (!raw) return null;
  try {
    const msg = parseEnvelope(JSON.parse(raw), sessionId, 'cockpit');
    if (!msg || msg.type !== 'STATE') return null;
    return env.now() - msg.sentAt > SNAPSHOT_MAX_AGE_MS ? null : msg;
  } catch {
    return null;
  }
}
