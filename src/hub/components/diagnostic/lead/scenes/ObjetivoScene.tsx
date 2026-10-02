import type { ObjetivoVM } from '@/lib/diagnostic/presentation';
import { ChosenTag, Eyebrow } from '../parts';

/** Visao de futuro. A escolha dele define o primeiro diferencial. */
export function ObjetivoScene({ scene }: { scene: ObjetivoVM }) {
  return (
    <div className="lead-view">
      <Eyebrow>Onde você quer chegar</Eyebrow>
      <h2 className="lead-goal">{scene.goal}</h2>
      {scene.quote && <p className="lead-quote lead-text">“{scene.quote}”</p>}
      {scene.priorities && (
        <section className="lead-stack lead-reveal">
          <p className="lead-label">O que pesa mais para você</p>
          <div className="lead-grid-3">
            {scene.priorities.map((p) => (
              <div key={p.label} className={p.chosen ? 'lead-card lead-option lead-chosen' : 'lead-card lead-option'}>
                {p.chosen && <ChosenTag />}
                <p className="lead-text lead-strong">{p.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
