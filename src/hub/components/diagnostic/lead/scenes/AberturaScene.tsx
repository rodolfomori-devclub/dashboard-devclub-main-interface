import type { AberturaVM } from '@/lib/diagnostic/presentation';
import { CheckIcon, Eyebrow, NumberedItem } from '../parts';

/** Acordo de agenda: a pos e anunciada desde o inicio. */
export function AberturaScene({ scene }: { scene: AberturaVM }) {
  return (
    <div className="lead-view">
      <div className="lead-stack">
        <h1 className="lead-hello">{scene.greeting}</h1>
        {scene.consultantLine && <p className="lead-lede">{scene.consultantLine}</p>}
      </div>
      {(scene.agenda || scene.takeaways) && (
        <div className="lead-grid-2 lead-abertura-cards">
          {scene.agenda && (
            <section className="lead-card lead-stack lead-reveal">
              <Eyebrow>Como vai funcionar</Eyebrow>
              <ol className="lead-list lead-text">
                {scene.agenda.map((item, i) => (
                  <NumberedItem key={item} n={i + 1}>
                    {item}
                  </NumberedItem>
                ))}
              </ol>
            </section>
          )}
          {scene.takeaways && (
            <section className="lead-card lead-stack lead-reveal">
              <Eyebrow>O que você leva hoje</Eyebrow>
              <ul className="lead-list lead-text">
                {scene.takeaways.map((item) => (
                  <li key={item} className="lead-list-item">
                    <span className="lead-check">
                      <CheckIcon />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
