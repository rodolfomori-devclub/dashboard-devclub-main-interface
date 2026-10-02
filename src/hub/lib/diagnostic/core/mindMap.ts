/**
 * Mapa mental do PDF: o objetivo no centro e os 5 pilares em volta. Port do
 * mapa() de 03_referencia_gerador.html (mesmas medidas, cores e textos).
 */
import type { DiagnosisModel, Level, PillarResult } from './types.ts';
import { escapeHtml } from './html.ts';

const W = 640;
const H = 390;
const R = 150;
const NODE_W = 156;
const NODE_H = 62;

const INK = '#131B26';
const INK_2 = '#4A5666';
const LINE = '#D5DCE4';
/** Pilar ainda sem nota (so aparece na previa, o PDF exige as 5 notas). */
const NEUTRAL = '#8A96A3';

const LEVEL_COLOR: Record<Level, string> = {
  trava: '#B3261E',
  em_construcao: '#B7791F',
  ponto_forte: '#2F6B3A',
};

const LEVEL_LABEL: Record<Level, string> = {
  trava: 'Trava',
  em_construcao: 'Em construção',
  ponto_forte: 'Ponto forte',
};

/** Linhas de ate `max` caracteres, quebrando nos espacos (wrap() do gerador). */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (`${line} ${word}`.trim().length > max) {
      if (line.trim()) out.push(line.trim());
      line = word;
    } else {
      line += ` ${word}`;
    }
  }
  if (line.trim()) out.push(line.trim());
  return out;
}

const n = (v: number): string => String(Math.round(v * 100) / 100);

function nodeSvg(result: PillarResult, x: number, y: number): string {
  const level = result.level;
  const color = level ? LEVEL_COLOR[level] : NEUTRAL;
  const x0 = x - NODE_W / 2;
  const y0 = y - NODE_H / 2;
  const score = typeof result.score === 'number' ? String(result.score) : '—';
  const label = level ? LEVEL_LABEL[level] : 'A avaliar';
  let hint = '';
  if (level === 'ponto_forte') hint = 'Manter e mostrar';
  else if (level) hint = `${wrap(result.pillar.movimento_90_dias ?? '', 29)[0] ?? ''}…`;

  let s = `<g data-pillar="${escapeHtml(result.pillar.id)}">`;
  s += `<rect x="${n(x0)}" y="${n(y0)}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="#FFFFFF" stroke="${color}" stroke-width="2"/>`;
  s += `<text x="${n(x0 + 10)}" y="${n(y0 + 18)}" font-family="IBM Plex Sans,sans-serif" font-weight="600" font-size="12" fill="${INK}">${escapeHtml(result.pillar.nome_curto)}</text>`;
  s += `<text x="${n(x0 + NODE_W - 10)}" y="${n(y0 + 18)}" text-anchor="end" font-family="IBM Plex Mono,monospace" font-weight="600" font-size="12" fill="${color}">${escapeHtml(score)}/5</text>`;
  s += `<text x="${n(x0 + 10)}" y="${n(y0 + 36)}" font-family="IBM Plex Sans,sans-serif" font-size="10.5" fill="${INK_2}">${escapeHtml(label)}</text>`;
  if (hint) {
    s += `<text x="${n(x0 + 10)}" y="${n(y0 + 51)}" font-family="IBM Plex Sans,sans-serif" font-size="10" fill="${INK_2}">${escapeHtml(hint)}</text>`;
  }
  return `${s}</g>`;
}

/** SVG do mapa (viewBox 640x390). Todo texto vai escapado. */
export function mindMapSvg(model: DiagnosisModel): string {
  const cx = W / 2;
  const cy = H / 2;
  const pillars = model.pillars ?? [];
  const count = Math.max(pillars.length, 1);
  const points = pillars.map((result, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return { result, x: cx + R * 1.45 * Math.cos(a), y: cy + R * 0.93 * Math.sin(a) };
  });
  const goal = typeof model.goal === 'string' && model.goal.trim() ? model.goal.trim() : '—';

  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Mapa mental do diagnóstico">`;
  for (const p of points) {
    s += `<line x1="${cx}" y1="${cy}" x2="${n(p.x)}" y2="${n(p.y)}" stroke="${LINE}" stroke-width="2"/>`;
  }
  s += `<rect x="${cx - 98}" y="${cy - 36}" width="196" height="72" rx="36" fill="${INK}"/>`;
  s += `<text x="${cx}" y="${cy - 10}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="10" fill="#C9D1DB" letter-spacing="1">OBJETIVO EM 12 MESES</text>`;
  wrap(goal, 26).forEach((line, i) => {
    s += `<text x="${cx}" y="${cy + 8 + i * 15}" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-weight="700" font-size="13.5" fill="#FFFFFF">${escapeHtml(line)}</text>`;
  });
  for (const p of points) s += nodeSvg(p.result, p.x, p.y);
  return `${s}</svg>`;
}
