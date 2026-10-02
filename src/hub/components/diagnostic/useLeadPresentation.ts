/**
 * Estado da apresentacao no cockpit: cena e passo atuais, transmissao para a
 * tela do lead, confirmacoes (ACK), efeitos no diagnostico e atalhos.
 *
 * - Comando do consultor (passo, cena, pausa) vai na hora; dado que muda com a
 *   cena aberta (ex.: compromisso digitado) vai 250 ms depois da ultima tecla.
 * - O passo e lembrado pela chave (leadView.resolveStep): dado editado com a
 *   cena aberta nao revela nem esconde passo sozinho.
 * - Cena e passo ficam em call_data.presentation: recarregar volta igual.
 * - O ACK registra efeitos (reportagem, bolsa) pelo retrato que a tela aplicou.
 * - Funciona sem a tela do lead aberta; so leitura nao transmite nem grava.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiagnosisModel, DiagnosticContent, OfferEvaluation } from '@diag/types.ts';
import type { Workspace } from '@/lib/diagnostic/workspace';
import {
  presentationFromSnapshot,
  sceneOrder,
  snapshotOf,
  type LeadViewModel,
  type PresentationState,
  type SceneEntry,
  type SceneId,
} from '@/lib/diagnostic/presentation';
import {
  buildLeadView,
  resolveStep,
  sceneStatus,
  type LeadViewContext,
  type SceneStatus,
} from '@/lib/diagnostic/leadView';
import {
  PING_INTERVAL_MS,
  createCockpitTransport,
  isClosedWindow,
  type AckMessage,
  type CockpitTransport,
} from '@/lib/diagnostic/presentationTransport';
import { ackWorkspaceUpdate } from '@/lib/diagnostic/presentationEffects';
import { shortcutFor, type SceneShortcut } from '@/lib/diagnostic/sceneShortcuts';

const CONTENT_DEBOUNCE_MS = 250;
/** Retratos recentes lembrados para casar com o ACK (a tela confirma o ultimo aplicado). */
const SENT_MEMORY = 20;

export interface LeadPresentationInput {
  ws: Workspace;
  model: DiagnosisModel;
  content: DiagnosticContent;
  offer: OfferEvaluation;
  update: (fn: (ws: Workspace) => Workspace) => void;
  readOnly?: boolean;
}

export interface LeadLink {
  /** Ultima confirmacao da tela do lead. */
  ack: AckMessage | null;
  /** Quando ela chegou (relogio do cockpit). */
  lastAckAt: number | null;
  /** Quando a tela avisou que fechou. */
  byeAt: number | null;
  /** Ultimo seq transmitido. */
  sentSeq: number;
}

export type PresentationActions = Record<SceneShortcut, () => void> & {
  jumpTo: (id: SceneId) => void;
  /** false quando o navegador bloqueou a janela (pop-up). */
  openWindow: () => boolean;
};

export interface LeadPresentation {
  state: PresentationState;
  vm: LeadViewModel;
  statuses: Record<SceneId, SceneStatus>;
  order: SceneEntry[];
  /**
   * Passo atual na lista de passos de agora. -1: o passo mostrado saiu da cena
   * quando os dados mudaram (o lead ve a tela neutra ate o proximo comando).
   */
  step: number;
  steps: number;
  link: LeadLink;
  can: { next: boolean; prev: boolean; nextScene: boolean; prevScene: boolean };
  actions: PresentationActions;
}

/** Proxima (ou anterior) cena ligada e pronta na ordem da preparacao. */
export function neighborScene(
  order: SceneEntry[],
  statuses: Record<SceneId, SceneStatus>,
  from: SceneId | null,
  dir: 1 | -1,
): SceneId | null {
  const idx = from ? order.findIndex((o) => o.id === from) : -1;
  if (dir === -1 && idx < 0) return null;
  for (let i = idx + dir; i >= 0 && i < order.length; i += dir) {
    if (order[i].enabled && statuses[order[i].id].ready) return order[i].id;
  }
  return null;
}

const sameKeys = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((k, i) => k === b[i]);

export function useLeadPresentation(input: LeadPresentationInput): LeadPresentation {
  const { ws, model, content, offer, update, readOnly = false } = input;
  const sessionId = ws.ids.sessionId;
  const prep = ws.diagnosis.prep_config;

  const ctx = useMemo<LeadViewContext>(() => ({ ws, model, content, offer }), [ws, model, content, offer]);
  const statuses = useMemo(() => sceneStatus(ctx), [ctx]);
  const order = useMemo(() => sceneOrder(prep), [prep]);
  const [state, setState] = useState<PresentationState>(() =>
    presentationFromSnapshot(ws.diagnosis.call_data.presentation),
  );
  const vm = useMemo(() => buildLeadView(ctx, state), [ctx, state]);
  const vmJson = useMemo(() => JSON.stringify(vm), [vm]);
  const [link, setLink] = useState<LeadLink>({ ack: null, lastAckAt: null, byeAt: null, sentSeq: 0 });

  const current = state.sceneId ? statuses[state.sceneId] : null;
  const steps = current?.ready ? current.steps : 0;
  const step = current?.ready ? resolveStep(current.keys, state) : 0;

  const transportRef = useRef<CockpitTransport | null>(null);
  /** Contexto de cada retrato transmitido (seq -> ctx): o ACK vale pelo que a tela aplicou. */
  const sentRef = useRef(new Map<number, LeadViewContext>());
  const windowRef = useRef<{ sessionId: string; win: Window } | null>(null);
  const lastSentRef = useRef('');
  const immediateRef = useRef(true);
  const latest = useRef({ ctx, statuses, order, state, vm, update, readOnly });
  latest.current = { ctx, statuses, order, state, vm, update, readOnly };

  const send = useCallback((payload: LeadViewModel, json: string, from: LeadViewContext) => {
    const t = transportRef.current;
    if (!t) return;
    lastSentRef.current = json;
    const seq = t.sendState(payload);
    const sent = sentRef.current;
    sent.set(seq, from);
    if (sent.size > SENT_MEMORY) sent.delete(sent.keys().next().value as number);
    setLink((l) => ({ ...l, sentSeq: seq }));
  }, []);

  // Canal com a tela do lead.
  useEffect(() => {
    if (!sessionId) return undefined;
    const t = createCockpitTransport(sessionId);
    transportRef.current = t;
    lastSentRef.current = '';
    sentRef.current.clear();
    const off = t.onMessage((msg) => {
      const cur = latest.current;
      if (msg.type === 'ACK') {
        setLink((l) => ({ ...l, ack: msg, lastAckAt: Date.now(), byeAt: null }));
        // O dado pode ter mudado depois desse retrato: o passo vale na lista de passos dele.
        const from = sentRef.current.get(msg.seq);
        if (!cur.readOnly && from) {
          const fn = ackWorkspaceUpdate(msg, from, new Date().toISOString());
          if (fn) cur.update(fn);
        }
      } else if (msg.type === 'HELLO') {
        if (!cur.readOnly) send(cur.vm, JSON.stringify(cur.vm), cur.ctx);
      } else if (msg.type === 'BYE') {
        setLink((l) => ({ ...l, byeAt: Date.now() }));
      }
    });
    let ping: number | undefined;
    if (!readOnly) {
      t.ping();
      ping = window.setInterval(() => t.ping(), PING_INTERVAL_MS);
    }
    return () => {
      off();
      window.clearInterval(ping);
      t.close();
      if (transportRef.current === t) transportRef.current = null;
    };
  }, [sessionId, readOnly, send]);

  // Retrato novo para a tela: comando na hora, dado com uma pequena espera.
  useEffect(() => {
    if (readOnly || !transportRef.current || vmJson === lastSentRef.current) return undefined;
    if (immediateRef.current) {
      immediateRef.current = false;
      send(vm, vmJson, ctx);
      return undefined;
    }
    const timer = window.setTimeout(() => send(vm, vmJson, ctx), CONTENT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [vm, vmJson, ctx, readOnly, send]);

  // Guarda cena, passo e pausa no diagnostico (volta igual depois de recarregar).
  // O indice segue a chave; passo que saiu da cena fica salvo como pausa.
  const sceneId = state.sceneId;
  const snapStep = step < 0 ? 0 : steps ? step : state.step;
  const snapCurtain = state.curtain || step < 0;
  const snapKey = `${sceneId}|${snapStep}|${snapCurtain}`;
  const persistedRef = useRef(snapKey);
  useEffect(() => {
    if (snapKey === persistedRef.current) return;
    persistedRef.current = snapKey;
    const cur = latest.current;
    if (cur.readOnly) return;
    const snap = snapshotOf({ sceneId, step: snapStep, curtain: snapCurtain });
    cur.update((w) => {
      const p = w.diagnosis.call_data.presentation;
      if (p && p.sceneId === snap.sceneId && p.step === snap.step && p.curtain === snap.curtain) return w;
      return { ...w, diagnosis: { ...w.diagnosis, call_data: { ...w.diagnosis.call_data, presentation: snap } } };
    });
  }, [snapKey, sceneId, snapStep, snapCurtain]);

  const go = useCallback((id: SceneId, to: number, curtain: boolean) => {
    const cur = latest.current;
    if (cur.readOnly) return;
    const shown = cur.statuses[id].keys.slice(0, to + 1);
    immediateRef.current = true;
    setState((prev) =>
      prev.sceneId === id && prev.step === to && prev.curtain === curtain && sameKeys(prev.shown, shown)
        ? prev
        : { sceneId: id, step: to, shown, curtain, seq: prev.seq + 1 },
    );
  }, []);

  const actions = useMemo<PresentationActions>(() => {
    const cur = () => latest.current;
    const stepOf = (id: SceneId) => resolveStep(cur().statuses[id].keys, cur().state);
    const nextScene = () => {
      const { state: s, order: o, statuses: st } = cur();
      const id = neighborScene(o, st, s.sceneId, 1);
      if (id) go(id, 0, s.curtain);
    };
    const prevScene = () => {
      const { state: s, order: o, statuses: st } = cur();
      const id = neighborScene(o, st, s.sceneId, -1);
      if (id) go(id, Math.max(0, st[id].steps - 1), s.curtain);
    };
    const next = () => {
      const { state: s, statuses: st } = cur();
      if (!s.sceneId) return nextScene();
      const at = stepOf(s.sceneId);
      if (st[s.sceneId].ready && at < st[s.sceneId].steps - 1) go(s.sceneId, at + 1, s.curtain);
    };
    const prev = () => {
      const { state: s, statuses: st } = cur();
      if (!s.sceneId || !st[s.sceneId].ready) return;
      const at = stepOf(s.sceneId);
      if (at > 0) go(s.sceneId, at - 1, s.curtain);
    };
    const curtain = () => {
      if (cur().readOnly) return;
      immediateRef.current = true;
      setState((prev) => ({ ...prev, curtain: !prev.curtain, seq: prev.seq + 1 }));
    };
    const jumpTo = (id: SceneId) => {
      const { state: s, statuses: st } = cur();
      if (st[id].ready) go(id, 0, s.curtain);
    };
    const openWindow = () => {
      if (cur().readOnly) return false;
      const sid = cur().ctx.ws.ids.sessionId;
      const opened = windowRef.current;
      // Ja aberta: so traz para a frente. Abrir de novo recarregaria a tela que o lead esta vendo.
      if (opened && opened.sessionId === sid && !isClosedWindow(opened.win)) {
        try {
          opened.win.focus();
        } catch {
          // o navegador pode recusar o foco; a janela segue aberta
        }
        transportRef.current?.attachWindow(opened.win);
        return true;
      }
      const win = window.open(`/sessao.html?id=${encodeURIComponent(sid)}`, `diag-sessao-${sid}`, 'popup,width=1280,height=720');
      windowRef.current = win ? { sessionId: sid, win } : null;
      transportRef.current?.attachWindow(win);
      return !!win;
    };
    return { next, prev, nextScene, prevScene, curtain, jumpTo, openWindow };
  }, [go]);

  // Atalhos na janela inteira enquanto o controle estiver montado.
  useEffect(() => {
    if (readOnly) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const action = shortcutFor(e);
      if (!action) return;
      // Tambem impede o botao focado de disparar de novo com o Espaco.
      e.preventDefault();
      actions[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly, actions]);

  const can = {
    next: !readOnly && (state.sceneId ? steps > 0 && step < steps - 1 : neighborScene(order, statuses, null, 1) != null),
    prev: !readOnly && steps > 0 && step > 0,
    nextScene: !readOnly && neighborScene(order, statuses, state.sceneId, 1) != null,
    prevScene: !readOnly && neighborScene(order, statuses, state.sceneId, -1) != null,
  };

  return { state, vm, statuses, order, step, steps, link, can, actions };
}
