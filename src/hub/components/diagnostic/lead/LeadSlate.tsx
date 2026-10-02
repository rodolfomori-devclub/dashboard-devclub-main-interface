/** Telas neutras da janela do lead: espera, pausa e a reserva de erro. Nunca em branco. */
import { LEAD_WINDOW_TITLE } from '@/lib/diagnostic/presentation';

export type SlateKind = 'standby' | 'curtain';

const SUBTITLE: Record<SlateKind, string> = {
  standby: 'Já vamos começar.',
  curtain: 'Voltamos em instantes.',
};

/** Dentro do palco (escala com ele). */
export function LeadSlate({ kind }: { kind: SlateKind }) {
  return (
    <div key={kind} className="lead-slate">
      <span className="lead-slate-mark" aria-hidden="true" />
      <h1 className="lead-slate-title">{LEAD_WINDOW_TITLE}</h1>
      <p className="lead-slate-sub">{SUBTITLE[kind]}</p>
    </div>
  );
}

/** Fora do palco: so CSS, para quando algo quebrar no meio da call. */
export function LeadFallback() {
  return (
    <div className="lead-surface lead-fallback">
      <p className="lead-fallback-title">{LEAD_WINDOW_TITLE}</p>
      <p className="lead-fallback-sub">{SUBTITLE.curtain}</p>
    </div>
  );
}
