import type { EncerramentoVM } from '@/lib/diagnostic/presentation';
import { Eyebrow } from '../parts';

/** Proximo passo claro, comprando ou nao. */
export function EncerramentoScene({ scene }: { scene: EncerramentoVM }) {
  return (
    <div className="lead-view">
      <Eyebrow>Combinado</Eyebrow>
      {scene.commitment && (
        <div className="lead-pact">
          <p className="lead-label">Seu compromisso</p>
          <p className="lead-pact-text">{scene.commitment.text}</p>
          {scene.commitment.due && <p className="lead-text lead-muted">Até {scene.commitment.due}.</p>}
        </div>
      )}
      <p className="lead-text">{scene.delivery}</p>
      {scene.consultant && (
        <div className="lead-card lead-contact">
          <span className="lead-label">Seu consultor</span>
          <span className="lead-strong">{scene.consultant.name}</span>
          {scene.consultant.whatsapp && <span className="lead-muted">WhatsApp {scene.consultant.whatsapp}</span>}
        </div>
      )}
    </div>
  );
}
