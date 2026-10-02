import type { PlanoVM } from '@/lib/diagnostic/presentation';
import { Eyebrow, NumberedItem } from '../parts';

/** Reciprocidade e compromisso: o plano e dele, com ou sem a pos. */
export function PlanoScene({ scene }: { scene: PlanoVM }) {
  if (scene.view === 'compromisso' && scene.commitment) {
    return (
      <div key="compromisso" className="lead-view lead-reveal">
        <Eyebrow>Seu compromisso</Eyebrow>
        <div className="lead-pact">
          <p className="lead-pact-text">{scene.commitment.text}</p>
          <p className="lead-text lead-muted">{scene.commitment.contactLine}</p>
        </div>
      </div>
    );
  }
  if (scene.view === 'material' && scene.gift) {
    return (
      <div key="material" className="lead-view lead-reveal">
        <div className="lead-stack">
          <Eyebrow>Seu material de presente</Eyebrow>
          <h2 className="lead-title">{scene.gift.title}</h2>
          {scene.gift.detail && <p className="lead-lede">{scene.gift.detail}</p>}
        </div>
        {scene.gift.items.length > 0 && (
          <ol className="lead-grid-3">
            {scene.gift.items.map((item, i) => (
              <li key={item} className="lead-card lead-list-item">
                <span className="lead-num">{i + 1}</span>
                <span className="lead-text lead-strong">{item}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    );
  }
  return (
    <div key="movimentos" className="lead-view">
      <Eyebrow>Seu plano de 90 dias</Eyebrow>
      <ol className="lead-moves">
        {scene.movements.map((m, i) => (
          <NumberedItem key={m} n={i + 1}>
            {m}
          </NumberedItem>
        ))}
      </ol>
      {scene.ownLine && <p className="lead-text lead-muted lead-reveal">{scene.ownLine}</p>}
    </div>
  );
}
