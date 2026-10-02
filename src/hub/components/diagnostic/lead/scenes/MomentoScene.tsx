import type { MomentoVM } from '@/lib/diagnostic/presentation';
import { Eyebrow } from '../parts';

/** Espelho: so o que a pessoa respondeu, nas faixas em que respondeu. */
export function MomentoScene({ scene }: { scene: MomentoVM }) {
  const { facts, trigger, freePhrase, goal, decision } = scene;
  return (
    <div className="lead-view">
      <Eyebrow>Seu momento</Eyebrow>
      {facts.length > 0 && (
        <div className="lead-grid-auto">
          {facts.map((f) => (
            <div key={f.label} className="lead-card lead-tile">
              <p className="lead-label">{f.label}</p>
              <p className="lead-tile-value">{f.value}</p>
            </div>
          ))}
        </div>
      )}
      {(trigger || freePhrase) && (
        <div className="lead-card lead-tile">
          <p className="lead-label">O que te trouxe aqui</p>
          {trigger && <p className="lead-tile-quote">“{trigger}”</p>}
          {freePhrase && <p className="lead-tile-quote lead-muted">“{freePhrase}”</p>}
        </div>
      )}
      {(goal || decision != null) && (
        <div className="lead-grid-auto">
          {goal && (
            <div className="lead-card lead-tile">
              <p className="lead-label">Onde você quer estar em 12 meses</p>
              <p className="lead-tile-value">{goal}</p>
            </div>
          )}
          {decision != null && (
            <div className="lead-card lead-tile">
              <p className="lead-label">Sua decisão de mudar</p>
              <p className="lead-decision">
                {decision}
                <small>/10</small>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
