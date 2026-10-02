/**
 * Janela compartilhada com o lead (sessao.html?id=<sessao>). Sem login e sem
 * banco: so desenha o ultimo retrato que o cockpit transmitiu. Titulo neutro,
 * cursor some parado, erro vira a tela neutra e recarregar volta na mesma cena.
 */
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { LeadStage } from '@/components/diagnostic/lead/LeadStage';
import { LeadFallback } from '@/components/diagnostic/lead/LeadSlate';
import { LEAD_WINDOW_TITLE, isLeadViewModel } from '@/lib/diagnostic/presentation';
import { createLeadTransport, type LeadStatus, type StateMessage } from '@/lib/diagnostic/presentationTransport';

const HELLO_EVERY_MS = 1000;
const CURSOR_IDLE_MS = 3000;
const cacheKey = (sessionId: string) => `diag_sessao_cache_${sessionId}`;

/** Faces usadas no palco: carregadas logo ao abrir, antes da primeira cena. */
const FONT_FACES = [
  '700 48px "Diag Bricolage Grotesque"',
  '400 24px "Diag IBM Plex Sans"',
  'italic 400 24px "Diag IBM Plex Sans"',
  '500 24px "Diag IBM Plex Sans"',
  '600 24px "Diag IBM Plex Sans"',
  '400 16px "Diag IBM Plex Mono"',
  '500 16px "Diag IBM Plex Mono"',
  '600 16px "Diag IBM Plex Mono"',
];

function readSessionId(): string {
  try {
    return (new URLSearchParams(window.location.search).get('id') ?? '').trim();
  } catch {
    return '';
  }
}

function readCache(sessionId: string): StateMessage | null {
  try {
    const raw = window.sessionStorage.getItem(cacheKey(sessionId));
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<StateMessage>;
    if (o?.type !== 'STATE' || typeof o.seq !== 'number' || typeof o.sentAt !== 'number' || !isLeadViewModel(o.vm)) {
      return null;
    }
    return o as StateMessage;
  } catch {
    return null;
  }
}

function writeCache(sessionId: string, msg: StateMessage): void {
  try {
    window.sessionStorage.setItem(cacheKey(sessionId), JSON.stringify(msg));
  } catch {
    // sem sessionStorage: so perde o repintar instantaneo
  }
}

function currentStatus(): LeadStatus {
  const fonts = typeof document !== 'undefined' ? document.fonts : undefined;
  return {
    visibility: document.visibilityState === 'hidden' ? 'hidden' : 'visible',
    fontsReady: fonts ? fonts.status === 'loaded' : true,
  };
}

function preloadFonts(): Promise<unknown> {
  const fonts = document.fonts;
  if (!fonts || typeof fonts.load !== 'function') return Promise.resolve();
  return Promise.all(FONT_FACES.map((f) => fonts.load(f).catch(() => []))).catch(() => undefined);
}

/** Qualquer erro de desenho vira a tela neutra; o proximo retrato tenta de novo. */
class LeadErrorBoundary extends Component<{ resetKey: number; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(prev: { resetKey: number }) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    return this.state.failed ? <LeadFallback /> : this.props.children;
  }
}

export function LeadWindowApp() {
  const sessionId = useMemo(readSessionId, []);
  const [applied, setApplied] = useState<StateMessage | null>(() => (sessionId ? readCache(sessionId) : null));
  const appliedRef = useRef(applied);
  appliedRef.current = applied;
  const [cursorHidden, setCursorHidden] = useState(false);

  useEffect(() => {
    document.title = LEAD_WINDOW_TITLE;
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    const transport = createLeadTransport(sessionId, currentStatus);
    const cached = appliedRef.current;
    if (cached) transport.restore(cached);
    const snapshot = transport.readSnapshot();
    if (snapshot && transport.restore(snapshot)) {
      setApplied(snapshot);
      writeCache(sessionId, snapshot);
    }

    // Pede o estado ate o cockpit responder (e de novo se ele fechar ou recarregar).
    let waiting = true;
    const offState = transport.onState((msg) => {
      waiting = false;
      setApplied(msg);
      writeCache(sessionId, msg);
    });
    const offBye = transport.onCockpitBye(() => {
      waiting = true;
    });
    transport.hello();
    const helloTimer = window.setInterval(() => {
      if (waiting) transport.hello();
    }, HELLO_EVERY_MS);

    const onVisibility = () => transport.ack();
    const onPageHide = () => transport.close();
    const onPageShow = (e: PageTransitionEvent) => {
      // Voltou do cache do navegador com o canal fechado: recomeca limpo.
      if (e.persisted) window.location.reload();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    let alive = true;
    preloadFonts().then(() => {
      if (alive) transport.ack();
    });

    return () => {
      alive = false;
      offState();
      offBye();
      window.clearInterval(helloTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      transport.close();
    };
  }, [sessionId]);

  useEffect(() => {
    let timer = window.setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    const onMove = () => {
      setCursorHidden(false);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setCursorHidden(true), CURSOR_IDLE_MS);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mousedown', onMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onMove);
    };
  }, []);

  return (
    <div className={cursorHidden ? 'lead-surface lead-window lead-cursor-hidden' : 'lead-surface lead-window'}>
      <LeadErrorBoundary resetKey={applied?.seq ?? 0}>
        <LeadStage vm={applied?.vm ?? null} className="lead-fill-parent" />
      </LeadErrorBoundary>
    </div>
  );
}
