import type { DevolutivaVM } from '@/lib/diagnostic/presentation';
import { LEVEL_LABEL } from '../format';
import { Eyebrow, LevelChip } from '../parts';
import { MindMap } from './MindMap';

/**
 * Revelacao na ordem do roteiro: frases dele, ponto forte e o que pesa, causa
 * e travas, depois Indice, barras e mapa. Sem contagem animada.
 */
export function DevolutivaScene({ scene }: { scene: DevolutivaVM }) {
  return (
    <div key={scene.view} className="lead-view lead-reveal">
      <DevolutivaView scene={scene} />
    </div>
  );
}

function DevolutivaView({ scene }: { scene: DevolutivaVM }) {
  switch (scene.view) {
    case 'frases':
      return (
        <>
          <Eyebrow>Seu ponto de partida</Eyebrow>
          <ul className="lead-quotes">
            {(scene.quotes ?? []).map((q, i) => (
              <li key={`${i}-${q}`} className="lead-quote">
                “{q}”
              </li>
            ))}
          </ul>
        </>
      );
    case 'forte':
      return (
        <>
          <Eyebrow>Onde você está</Eyebrow>
          <div className="lead-grid-2">
            {scene.strong && (
              <div className="lead-card lead-stack">
                <p className="lead-label">Seu ponto forte</p>
                <p className="lead-pillar-big">{scene.strong}</p>
              </div>
            )}
            {scene.weighs && (
              <div className="lead-card lead-stack">
                <p className="lead-label">O que mais pesa hoje</p>
                <p className="lead-pillar-big">{scene.weighs}</p>
              </div>
            )}
          </div>
        </>
      );
    case 'travando':
      return (
        <>
          <Eyebrow>O que está te travando</Eyebrow>
          <h2 className="lead-cause-lead">A causa não é falta de esforço.</h2>
          {scene.rootCause && <p className="lead-text">{scene.rootCause}</p>}
          {scene.blockers && scene.blockers.length > 0 && (
            <ul className="lead-blockers">
              {scene.blockers.map((b) => (
                <li key={b.name}>
                  <span className="lead-strong">{b.name}:</span> {b.text}
                </li>
              ))}
            </ul>
          )}
        </>
      );
    case 'indice':
      return (
        <>
          <Eyebrow>Seu Índice de Carreira com IA</Eyebrow>
          <p className="lead-index">
            <span className="lead-index-number">{scene.total}</span>
            <span className="lead-index-of">de 25</span>
          </p>
          <ul className="lead-bars">
            {(scene.bars ?? []).map((b) => (
              <li key={b.name} className="lead-bar-row">
                <span className="lead-bar-name">{b.name}</span>
                <span className="lead-track">
                  <span className={`lead-fill lead-fill-${b.level}`} style={{ width: `${b.score * 20}%` }} />
                </span>
                <span className={`lead-bar-score lead-ink-${b.level}`}>{b.score}/5</span>
                <span>
                  <LevelChip level={b.level} />
                </span>
              </li>
            ))}
          </ul>
        </>
      );
    case 'mapa':
      return (
        <>
          <Eyebrow>Seu mapa</Eyebrow>
          {scene.map && (
            <div className="lead-map">
              <MindMap goal={scene.map.goal} nodes={scene.map.nodes} />
            </div>
          )}
        </>
      );
    case 'retrato':
      return (
        <div className="lead-center lead-center-x">
          <h2 className="lead-title-xl">Faz sentido esse retrato?</h2>
          {scene.total != null && <p className="lead-lede">Seu Índice: {scene.total} de 25</p>}
          {scene.bars && (
            <ul className="lead-recap">
              {scene.bars.map((b) => (
                <li key={b.short} className="lead-recap-item">
                  <span>{b.short}</span>
                  <span className={`lead-lv lead-lv-${b.level}`}>{LEVEL_LABEL[b.level]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      );
    default:
      return null;
  }
}
