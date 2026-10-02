import type { ProximoVM } from '@/lib/diagnostic/presentation';
import { ChosenTag, Eyebrow } from '../parts';

/** Escolha com permissao. Bolsas limitadas so com numero confirmado. */
export function ProximoScene({ scene }: { scene: ProximoVM }) {
  if (scene.single) {
    return (
      <div className="lead-view">
        <Eyebrow>Próximo passo</Eyebrow>
        <div className="lead-center">
          <p className="lead-single">{scene.single}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="lead-view">
      <div className="lead-stack">
        <Eyebrow>Próximo passo</Eyebrow>
        <h2 className="lead-title">Como você prefere seguir?</h2>
      </div>
      <div className="lead-grid-2">
        {scene.options.map((o) => (
          <div key={o.label} className={o.chosen ? 'lead-card lead-option lead-chosen' : 'lead-card lead-option'}>
            {o.chosen && (
              <span>
                <ChosenTag />
              </span>
            )}
            <p className="lead-option-label">{o.label}</p>
          </div>
        ))}
      </div>
      {scene.seatsLine && <p className="lead-small lead-muted">{scene.seatsLine}</p>}
    </div>
  );
}
