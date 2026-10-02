import { useCallback, useEffect, useRef, useState } from 'react';
import type { CallBlock, CallBlockId, QuoteTag } from '@diag/types.ts';
import { blockShortcutFor, nextBlock } from '@/lib/diagnostic/cockpit';
import { EMPTY_QUOTE_DRAFT, QUOTE_TAG_LABEL, type QuoteDraft } from '@/lib/diagnostic/capture';
import type { CallData } from '@/lib/diagnostic/workspace';

/** Relogio que re-renderiza so quem usa (cronometros, modo curto). */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function matchesQuery(query: string): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
}

export function useMinWidth(px: number): boolean {
  const query = `(min-width: ${px}px)`;
  const [matches, setMatches] = useState(() => matchesQuery(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);
  return matches;
}

export type CockpitLock = 'pending' | 'held' | 'denied' | 'unsupported';

const LOCK_RETRY_MS = 300;

/**
 * Um cockpit por sessao (navigator.locks): a segunda janela fica so para
 * leitura. A pagina decide antes de abrir o workspace (a janela passiva nem le
 * nem grava o rascunho local) e segura o lock enquanto estiver montada.
 */
export function useCockpitLock(sessionId: string | undefined): CockpitLock {
  const [state, setState] = useState<CockpitLock>(() =>
    sessionId && typeof navigator !== 'undefined' && navigator.locks ? 'pending' : 'unsupported',
  );
  useEffect(() => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
    if (!sessionId || !locks || typeof locks.request !== 'function') {
      setState('unsupported');
      return undefined;
    }
    let disposed = false;
    let release = () => {};
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    setState('pending');
    const attempt = (retriesLeft: number) =>
      locks
        .request(`diag-cockpit-${sessionId}`, { ifAvailable: true }, (lock) => {
          // Desmontou antes de o pedido voltar: devolve o lock na hora.
          if (disposed) return undefined;
          if (!lock) {
            // A montagem dupla do StrictMode e um recarregar soltam o lock anterior logo depois.
            // Outra janela conduzindo a call continua com ele: depois das tentativas, so leitura.
            if (retriesLeft > 0) retryTimer = setTimeout(() => !disposed && attempt(retriesLeft - 1), LOCK_RETRY_MS);
            else setState('denied');
            return undefined;
          }
          setState('held');
          return held;
        })
        .catch(() => {
          if (!disposed) setState('unsupported');
        });
    void attempt(2);
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      release();
    };
  }, [sessionId]);
  return state;
}

/** Alt+1..9 vai ao bloco N e Alt+N ao proximo (fora de campos de texto). */
export function useBlockShortcuts(
  blocks: CallBlock[],
  currentId: CallBlockId,
  shortMode: boolean,
  goToBlock: (id: CallBlockId) => void,
): void {
  const latest = useRef({ blocks, currentId, shortMode, goToBlock });
  latest.current = { blocks, currentId, shortMode, goToBlock };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const shortcut = blockShortcutFor(e);
      if (!shortcut) return;
      const cur = latest.current;
      const target = shortcut.kind === 'jump' ? cur.blocks[shortcut.index]?.id : nextBlock(cur.blocks, cur.currentId, cur.shortMode);
      if (!target) return;
      e.preventDefault();
      cur.goToBlock(target);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

// ---------------------------------------------------------------------------
// Estado desta aba (sessionStorage): sobrevive a recarregar, some ao fechar
// ---------------------------------------------------------------------------

function readTab(key: string): unknown {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeTab(key: string, value: unknown): void {
  try {
    if (value == null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem sessionStorage (modo restrito): segue so na memoria
  }
}

const QUOTE_TAGS: readonly string[] = Object.keys(QUOTE_TAG_LABEL);

/** Rascunho guardado nesta aba; o que nao tiver a forma esperada vira vazio. */
export function parseQuoteDraft(raw: unknown): QuoteDraft {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const text = typeof o.text === 'string' ? o.text : '';
  const tag = typeof o.tag === 'string' && QUOTE_TAGS.includes(o.tag) ? (o.tag as QuoteTag) : null;
  return text || tag ? { text, tag } : EMPTY_QUOTE_DRAFT;
}

/**
 * A frase sendo digitada: uma so para todos os campos de frases do cockpit (a
 * largura da janela muda qual deles esta montado) e guardada nesta aba, para
 * voltar depois de recarregar.
 */
export function useQuoteDraft(diagnosisId: string): [QuoteDraft, (draft: QuoteDraft) => void] {
  const key = `diag-cockpit-quote:${diagnosisId}`;
  const [draft, setDraft] = useState(() => parseQuoteDraft(readTab(key)));
  const change = useCallback(
    (next: QuoteDraft) => {
      setDraft(next);
      writeTab(key, next.text || next.tag ? next : null);
    },
    [key],
  );
  return [draft, change];
}

/** "Assumir a call" vale para esta aba: recarregar nao volta a so acompanhar. */
export function useTakeover(diagnosisId: string, viewerId: string | null): [boolean, () => void] {
  const key = `diag-cockpit-takeover:${diagnosisId}`;
  const [taken, setTaken] = useState(() => !!viewerId && readTab(key) === viewerId);
  const take = useCallback(() => {
    setTaken(true);
    writeTab(key, viewerId);
  }, [key, viewerId]);
  return [taken, take];
}

/**
 * Inicio da entrada atual no bloco da call. blockStartedAt guarda so a primeira
 * entrada: voltar ao bloco (ou ter espiado antes) nao herda aquele tempo. Cada
 * carimbo, de qualquer bloco, e um limite (ali a call entrou em outro bloco ou
 * neste pela primeira vez) e `visitSince` e quando esta tela viu a call entrar
 * nele: vale o mais recente. null sem carimbo do bloco (call nao rodando).
 */
export function blockVisitStart(callData: CallData, visitSince: string | null): string | null {
  const stamps = callData.blockStartedAt ?? {};
  if (!stamps[callData.currentBlock]) return null;
  let latest: string | null = null;
  for (const iso of [...Object.values(stamps), visitSince]) {
    const at = iso ? Date.parse(iso) : NaN;
    if (Number.isFinite(at) && (latest == null || at > Date.parse(latest))) latest = iso ?? null;
  }
  return latest;
}

interface BlockVisit {
  block: string;
  at: string | null;
}

/**
 * Quando esta tela viu a call entrar no bloco atual. Guardado nesta aba; null
 * quando nao da para saber (abriu ou recarregou ja no bloco, sem registro).
 */
export function useBlockVisitSince(diagnosisId: string, currentBlock: string): string | null {
  const key = `diag-cockpit-visit:${diagnosisId}`;
  const [visit, setVisit] = useState<BlockVisit>(() => {
    const stored = readTab(key) as Partial<BlockVisit> | null;
    const at = stored && stored.block === currentBlock && typeof stored.at === 'string' ? stored.at : null;
    return { block: currentBlock, at };
  });
  let current = visit;
  if (visit.block !== currentBlock) {
    // Trocou de bloco com a tela aberta: a visita comeca agora (no mesmo render, sem piscar o tempo antigo).
    current = { block: currentBlock, at: new Date().toISOString() };
    setVisit(current);
  }
  useEffect(() => {
    if (visit.at) writeTab(key, visit);
  }, [key, visit]);
  return current.at;
}
