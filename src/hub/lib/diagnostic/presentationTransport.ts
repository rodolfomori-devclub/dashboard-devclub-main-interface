/**
 * Conversa entre o cockpit (privado) e a tela do lead (sessao.html), no mesmo
 * navegador. Mensagens e validacao: presentationProtocol.ts.
 *
 * Canal principal: BroadcastChannel('diag-sessao:<id>'). Reservas: postMessage
 * entre a janela que abriu e a aberta (so a mesma origem) e localStorage com o
 * evento 'storage'. O ultimo retrato fica em localStorage ('diag_sessao_<id>')
 * para a tela voltar igual depois de recarregar.
 *
 * A tela ignora seq menor que o ultimo aplicado. O cockpit manda PING a cada
 * 2 s e a tela responde ACK no proprio handler da mensagem: timers sao
 * estrangulados em janela escondida, eventos nao.
 */
import type { LeadViewModel } from '@/lib/diagnostic/presentation';
import {
  ackFor,
  channelName,
  envelope,
  messageKey,
  parseEnvelope,
  readSnapshot,
  snapshotKey,
  storageRemove,
  storageSet,
  type LeadMessage,
  type LeadStatus,
  type PresentationMessage,
  type PresentationSide,
  type StateMessage,
} from '@/lib/diagnostic/presentationProtocol';

export {
  ackFor,
  channelName,
  readSnapshot,
  snapshotKey,
  type AckMessage,
  type ByeMessage,
  type CockpitMessage,
  type HelloMessage,
  type LeadMessage,
  type LeadStatus,
  type PingMessage,
  type PresentationMessage,
  type PresentationSide,
  type StateMessage,
} from '@/lib/diagnostic/presentationProtocol';

export const PING_INTERVAL_MS = 2000;
/** Sem ACK por este tempo, a tela conta como desconectada. */
export const ACK_LOST_MS = 6000;

// ---------------------------------------------------------------------------
// Ambiente (injetavel nos testes)
// ---------------------------------------------------------------------------

export interface ChannelLike {
  postMessage(data: unknown): void;
  addEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (ev: MessageEvent) => void): void;
  close(): void;
}

export interface TransportEnv {
  /** null: navegador sem BroadcastChannel. */
  openChannel: ((name: string) => ChannelLike) | null;
  storage: Storage | null;
  /** Janela atual: eventos 'message' e 'storage' e a origem. */
  win: Window | null;
  /** Lado do lead: a janela do cockpit que abriu esta. */
  opener: Window | null;
  now: () => number;
}

export function browserEnv(): TransportEnv {
  const win = typeof window !== 'undefined' ? window : null;
  let storage: Storage | null = null;
  try {
    storage = win ? win.localStorage : null;
  } catch {
    storage = null;
  }
  let opener: Window | null = null;
  try {
    opener = win && win.opener && win.opener !== win ? (win.opener as Window) : null;
  } catch {
    opener = null;
  }
  const BC = typeof BroadcastChannel === 'function' ? BroadcastChannel : null;
  return {
    openChannel: BC ? (name) => new BC(name) as unknown as ChannelLike : null,
    storage,
    win,
    opener,
    now: () => Date.now(),
  };
}

/** Apaga o retrato guardado neste navegador (ex.: ao enviar o diagnostico). */
export function clearLeadWindowSnapshot(sessionId: string, env: Pick<TransportEnv, 'storage'> = browserEnv()): void {
  storageRemove(env.storage, snapshotKey(sessionId));
}

/** Janela fechada (ou inacessivel). */
export function isClosedWindow(w: Window): boolean {
  try {
    return w.closed;
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// Ligacao comum aos dois lados
// ---------------------------------------------------------------------------

interface Link {
  post(msg: PresentationMessage): void;
  saveSnapshot(msg: StateMessage): void;
  setPeer(win: Window | null): void;
  close(): void;
}

function createLink(
  sessionId: string,
  side: PresentationSide,
  env: TransportEnv,
  onMessage: (msg: PresentationMessage) => void,
): Link {
  const peerSide: PresentationSide = side === 'cockpit' ? 'lead' : 'cockpit';
  const origin = env.win?.location?.origin ?? '';
  let peer: Window | null = side === 'lead' ? env.opener : null;
  let closed = false;
  let nonce = 0;

  let channel: ChannelLike | null = null;
  try {
    channel = env.openChannel ? env.openChannel(channelName(sessionId)) : null;
  } catch {
    channel = null;
  }

  const handle = (data: unknown) => {
    if (closed) return;
    const msg = parseEnvelope(data, sessionId, peerSide);
    if (msg) onMessage(msg);
  };
  const onChannel = (ev: MessageEvent) => handle(ev.data);
  const onWindowMessage = (ev: MessageEvent) => {
    // Reserva por postMessage: so a mesma origem, so a janela par.
    if (!origin || ev.origin !== origin) return;
    const source = ev.source as Window | null;
    if (side === 'lead') {
      if (!peer || source !== peer) return;
    } else if (peer && source !== peer) {
      return;
    }
    if (side === 'cockpit' && !peer && source && typeof source.postMessage === 'function') {
      // Cockpit recarregado: a tela continua com o mesmo opener.
      if (parseEnvelope(ev.data, sessionId, peerSide)) peer = source;
    }
    handle(ev.data);
  };
  const onStorage = (ev: StorageEvent) => {
    if (!ev.key || ev.newValue == null) return;
    const ours = ev.key === messageKey(sessionId, peerSide) || (side === 'lead' && ev.key === snapshotKey(sessionId));
    if (!ours) return;
    try {
      handle(JSON.parse(ev.newValue));
    } catch {
      // valor estranho no armazenamento: ignora
    }
  };

  channel?.addEventListener('message', onChannel);
  env.win?.addEventListener('message', onWindowMessage);
  env.win?.addEventListener('storage', onStorage);

  return {
    post(msg) {
      if (closed) return;
      const data = envelope(sessionId, side, msg);
      if (channel) {
        try {
          channel.postMessage(data);
          return;
        } catch {
          // canal fechado pelo navegador: cai na reserva
        }
      }
      if (peer && !isClosedWindow(peer) && origin) {
        try {
          peer.postMessage(data, origin);
          return;
        } catch {
          // segue para o armazenamento
        }
      }
      nonce += 1;
      storageSet(env.storage, messageKey(sessionId, side), JSON.stringify({ ...data, n: `${env.now()}-${nonce}` }));
    },
    saveSnapshot(msg) {
      if (!closed) storageSet(env.storage, snapshotKey(sessionId), JSON.stringify(envelope(sessionId, side, msg)));
    },
    setPeer(win) {
      peer = win;
    },
    close() {
      if (closed) return;
      closed = true;
      channel?.removeEventListener('message', onChannel);
      try {
        channel?.close();
      } catch {
        // ja fechado
      }
      env.win?.removeEventListener('message', onWindowMessage);
      env.win?.removeEventListener('storage', onStorage);
    },
  };
}

// ---------------------------------------------------------------------------
// Cockpit
// ---------------------------------------------------------------------------

export interface CockpitTransport {
  /** Transmite o retrato completo da tela. Devolve o seq usado. */
  sendState(vm: LeadViewModel): number;
  ping(): void;
  /** Janela aberta por "Abrir tela do lead" (reserva via postMessage). */
  attachWindow(win: Window | null): void;
  onMessage(fn: (msg: LeadMessage) => void): () => void;
  /** Apaga o retrato guardado neste navegador (fim da call). */
  clearSnapshot(): void;
  /** Ultimo seq transmitido. */
  lastSeq(): number;
  close(): void;
}

export function createCockpitTransport(sessionId: string, env: TransportEnv = browserEnv()): CockpitTransport {
  const listeners = new Set<(msg: LeadMessage) => void>();
  // seq cresce com o relogio: um cockpit recarregado nunca fica abaixo do anterior.
  let lastSeq = readSnapshot(sessionId, env)?.seq ?? 0;
  const link = createLink(sessionId, 'cockpit', env, (msg) => {
    listeners.forEach((fn) => fn(msg as LeadMessage));
  });
  let closed = false;

  return {
    sendState(vm) {
      const seq = Math.max(lastSeq + 1, Math.floor(env.now()));
      lastSeq = seq;
      const msg: StateMessage = { type: 'STATE', seq, sentAt: env.now(), vm };
      link.post(msg);
      link.saveSnapshot(msg);
      return seq;
    },
    ping() {
      link.post({ type: 'PING', at: env.now() });
    },
    attachWindow(win) {
      link.setPeer(win);
    },
    onMessage(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    clearSnapshot() {
      storageRemove(env.storage, snapshotKey(sessionId));
    },
    lastSeq: () => lastSeq,
    close() {
      if (closed) return;
      closed = true;
      link.post({ type: 'BYE', at: env.now() });
      link.close();
      listeners.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Tela do lead
// ---------------------------------------------------------------------------

export interface LeadTransport {
  /** Ultimo STATE aplicado. */
  applied(): StateMessage | null;
  /** Retrato guardado pelo cockpit (repinta depois de recarregar). */
  readSnapshot(): StateMessage | null;
  /** Aplica um retrato que nao veio pelo canal (cache). Ignora se for mais velho. */
  restore(msg: StateMessage): boolean;
  onState(fn: (msg: StateMessage) => void): () => void;
  /** O cockpit fechou ou recarregou. */
  onCockpitBye(fn: () => void): () => void;
  hello(): void;
  /** Confirma o que esta aplicado, com visibilidade e fontes. */
  ack(): void;
  close(): void;
}

export function createLeadTransport(
  sessionId: string,
  getStatus: () => LeadStatus,
  env: TransportEnv = browserEnv(),
): LeadTransport {
  let applied: StateMessage | null = null;
  const stateListeners = new Set<(msg: StateMessage) => void>();
  const byeListeners = new Set<() => void>();
  let closed = false;

  const sendAck = () => link.post(ackFor(applied, getStatus(), env.now()));

  const link = createLink(sessionId, 'lead', env, (msg) => {
    if (msg.type === 'STATE') {
      if (applied && msg.seq <= applied.seq) {
        // Repetido (chegou por dois caminhos): nada. Mais velho: avisa o que esta na tela.
        if (msg.seq < applied.seq) sendAck();
        return;
      }
      applied = msg;
      stateListeners.forEach((fn) => fn(msg));
      sendAck();
    } else if (msg.type === 'PING') {
      sendAck();
    } else if (msg.type === 'BYE') {
      byeListeners.forEach((fn) => fn());
    }
  });

  return {
    applied: () => applied,
    readSnapshot: () => readSnapshot(sessionId, env),
    restore(msg) {
      if (applied && msg.seq <= applied.seq) return false;
      applied = msg;
      return true;
    },
    onState(fn) {
      stateListeners.add(fn);
      return () => {
        stateListeners.delete(fn);
      };
    },
    onCockpitBye(fn) {
      byeListeners.add(fn);
      return () => {
        byeListeners.delete(fn);
      };
    },
    hello() {
      link.post({ type: 'HELLO', at: env.now() });
    },
    ack: sendAck,
    close() {
      if (closed) return;
      closed = true;
      link.post({ type: 'BYE', at: env.now() });
      link.close();
      stateListeners.clear();
      byeListeners.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Estado da conexao (chip do cockpit)
// ---------------------------------------------------------------------------

export type LeadConnection = 'live' | 'background' | 'disconnected' | 'closed';

export interface ConnectionInput {
  /** Quando chegou o ultimo ACK (relogio do cockpit). null = nunca. */
  lastAckAt: number | null;
  visibility: 'visible' | 'hidden' | null;
  /** Quando a tela avisou que fechou (BYE). */
  byeAt: number | null;
}

/** Ao vivo (ACK recente e visivel), segundo plano, desconectada (6 s sem ACK) ou fechada. */
export function connectionStatus(input: ConnectionInput, now: number): LeadConnection {
  if (input.lastAckAt == null) return 'closed';
  if (input.byeAt != null && input.byeAt >= input.lastAckAt) return 'closed';
  if (now - input.lastAckAt >= ACK_LOST_MS) return 'disconnected';
  return input.visibility === 'hidden' ? 'background' : 'live';
}
