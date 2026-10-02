/**
 * Mapa do diagnostico: mesma geometria do mapa() do gerador de referencia
 * (03_referencia_gerador.html): objetivo no centro, 5 pilares em volta na
 * ordem fixa. Os cartoes ficam um pouco maiores, para ler na tela da call.
 */
import type { MapNodeVM } from '@/lib/diagnostic/presentation';
import { wrapWords } from '@/lib/diagnostic/leadViewShared';
import { LEVEL_LABEL } from '../format';

const W = 640;
const H = 390;
const CX = W / 2;
const CY = H / 2;
const R = 150;
const NODE_W = 170;
const NODE_H = 68;

export function MindMap({ goal, nodes }: { goal: string; nodes: MapNodeVM[] }) {
  const pts = nodes.map((node, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / nodes.length;
    return { node, x: CX + R * 1.45 * Math.cos(a), y: CY + R * 0.93 * Math.sin(a) };
  });
  const goalLines = wrapWords(goal, 26).slice(0, 2);
  return (
    <svg viewBox="20 12 600 344" role="img" aria-label="Mapa do seu diagnóstico" preserveAspectRatio="xMidYMid meet">
      {pts.map(({ node, x, y }) => (
        <line key={`l-${node.short}`} className="lead-map-line" x1={CX} y1={CY} x2={x} y2={y} />
      ))}
      <rect className="lead-map-center" x={CX - 98} y={CY - 36} width={196} height={72} rx={36} />
      <text className="lead-map-center-label" x={CX} y={CY - 11} textAnchor="middle">
        OBJETIVO EM 12 MESES
      </text>
      {goalLines.map((line, i) => (
        <text key={line} className="lead-map-goal" x={CX} y={CY + 8 + i * 16} textAnchor="middle">
          {line}
        </text>
      ))}
      {pts.map(({ node, x, y }) => {
        const x0 = x - NODE_W / 2;
        const y0 = y - NODE_H / 2;
        return (
          <g key={node.short}>
            <rect className={`lead-map-node lead-lvs-${node.level}`} x={x0} y={y0} width={NODE_W} height={NODE_H} rx={8} />
            <text className="lead-map-name" x={x0 + 12} y={y0 + 21}>
              {node.short}
            </text>
            <text className={`lead-map-score lead-lvs-${node.level}`} x={x0 + NODE_W - 12} y={y0 + 21} textAnchor="end">
              {node.score}/5
            </text>
            <text className="lead-map-level" x={x0 + 12} y={y0 + 40}>
              {LEVEL_LABEL[node.level]}
            </text>
            <text className="lead-map-hint" x={x0 + 12} y={y0 + 57}>
              {node.hint}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
