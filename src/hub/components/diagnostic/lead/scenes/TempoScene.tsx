import type { TempoVM } from '@/lib/diagnostic/presentation';
import { fmtNumber } from '../format';
import { Eyebrow } from '../parts';

/** Problema em numero, com a conta visivel. Nenhuma promessa de economia. */
export function TempoScene({ scene }: { scene: TempoVM }) {
  const max = Math.max(1, ...scene.tasks.map((t) => t.hours));
  return (
    <div className="lead-view">
      <div className="lead-stack">
        <Eyebrow>Onde seu tempo vai</Eyebrow>
        <h2 className="lead-title">As tarefas que mais tomam a sua semana</h2>
        <p className="lead-small lead-muted">Horas por semana, pela sua estimativa.</p>
      </div>
      <div className="lead-tempo">
        <ul className={scene.tasks.length > 4 ? 'lead-tasks lead-tasks-dense' : 'lead-tasks'}>
          {scene.tasks.map((t, i) => (
            <li key={`${i}-${t.label}`} className="lead-task">
              <span className="lead-task-label">{t.label}</span>
              <span className="lead-task-hours">{fmtNumber(t.hours)} h/semana</span>
              <span className="lead-track">
                <span className="lead-fill" style={{ width: `${Math.round((t.hours / max) * 100)}%` }} />
              </span>
            </li>
          ))}
        </ul>
        {scene.weeklyHours != null && scene.yearlyHours != null && (
          <aside className="lead-card lead-stack lead-reveal">
            <p className="lead-label">Pela sua estimativa</p>
            <p className="lead-text">
              <span className="lead-strong">{fmtNumber(scene.weeklyHours)} h</span> por semana
            </p>
            <div>
              <p className="lead-small lead-muted">cerca de</p>
              <p className="lead-total">
                <span className="lead-total-number">{fmtNumber(scene.yearlyHours)}</span> horas por ano
              </p>
            </div>
            <p className="lead-small lead-muted">
              ({fmtNumber(scene.weeklyHours)} h × {scene.weeksPerYear} semanas)
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}
