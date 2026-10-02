import type { CaminhoVM } from '@/lib/diagnostic/presentation';
import { ArrowIcon, Eyebrow } from '../parts';

/** Ponte personalizada: so com permissao, nunca para quem esta cursando. */
export function CaminhoScene({ scene }: { scene: CaminhoVM }) {
  if (scene.view === 'programa' && scene.program) {
    return (
      <div key="programa" className="lead-view lead-reveal">
        <Eyebrow>Se quiser ir além</Eyebrow>
        <h2 className="lead-title">O programa</h2>
        <p className="lead-card lead-text">{scene.program}</p>
      </div>
    );
  }
  if (scene.view === 'pares' && scene.pairs) {
    return (
      <div key="pares" className="lead-view">
        <Eyebrow>Sua trava e como a pós resolve</Eyebrow>
        <ul className="lead-stack">
          {scene.pairs.map((p) => (
            <li key={p.label} className="lead-card lead-pair lead-reveal">
              <div className="lead-stack-tight">
                <p className="lead-label">{p.caption}</p>
                <p className="lead-pair-label">{p.label}</p>
              </div>
              <span className="lead-pair-arrow">
                <ArrowIcon />
              </span>
              <div className="lead-stack-tight">
                <p className="lead-label">Como a pós resolve</p>
                <p className="lead-pair-text">{p.resolves}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div key="trilha" className="lead-view lead-reveal">
      <div className="lead-stack">
        <Eyebrow>Se quiser ir além</Eyebrow>
        <h2 className="lead-title">Trilha de desenvolvimento de 12 meses</h2>
        {scene.goal && <p className="lead-text">Objetivo: {scene.goal}</p>}
      </div>
      <ol className="lead-grid-4">
        {scene.quarters.map((q) => (
          <li key={q.period} className="lead-card lead-quarter">
            <p className="lead-label">{q.period}</p>
            <h3 className="lead-quarter-title">{q.title}</h3>
            <p className="lead-quarter-text">{q.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
