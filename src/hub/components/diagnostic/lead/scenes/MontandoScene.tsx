import type { MontandoVM } from '@/lib/diagnostic/presentation';
import { CheckIcon, DotIcon, Eyebrow } from '../parts';

/** Antecipacao: progresso da conversa, nunca uma nota. */
export function MontandoScene({ scene }: { scene: MontandoVM }) {
  return (
    <div className="lead-view">
      <div className="lead-stack">
        <Eyebrow>Montando seu diagnóstico</Eyebrow>
        <h2 className="lead-title">Cada parte da conversa completa um ponto</h2>
      </div>
      <ul className="lead-stack">
        {scene.pillars.map((p) => (
          <li key={p.name} className="lead-card lead-pillar-row">
            <span key={p.done ? 'ok' : 'wait'} className={p.done ? 'lead-check lead-reveal' : 'lead-check lead-check-pending'}>
              {p.done ? <CheckIcon /> : <DotIcon />}
            </span>
            <span className="lead-pillar-name">{p.name}</span>
            <span className="lead-pillar-state">{p.done ? 'Já conversamos' : 'Ainda vamos conversar'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
