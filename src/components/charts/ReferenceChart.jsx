/* eslint-disable react/prop-types -- Shared React 19 chart with explicit data props. */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
/* Visual adapted from the user's Masi RevOps reference; sales data stays in Dashboard. */
import { formatDate, formatValue } from './chartFormatters.js';
import './referenceChart.css';
import { finiteNumber, niceScale, segmentedPaths, positionEndLabels, chooseTickIndices } from './chartMath.js';

const REFERENCE_COLORS = ['var(--chart-1, #e64b63)', 'var(--chart-2, #8064d8)', 'var(--chart-3, #cd7a27)', 'var(--chart-4, #2589b8)', 'var(--chart-5, #159b82)', 'var(--chart-6, #b89a22)'];
export function ReferenceChart({ rows = [], series = [], title, height = 380, mode = 'line', rotateDates = false, showLegend = true, pointLabels = false, daily = true, maxEndLabels = 4 }) {
  const ref = useRef(null), id = useId();
  const [width, setWidth] = useState(800), [hidden, setHidden] = useState([]), [active, setActive] = useState(null);
  useEffect(() => {
    const node = ref.current; if (!node) return;
    const resize = () => setWidth(Math.max(220, node.getBoundingClientRect().width || 800)); resize();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(resize); observer.observe(node); return () => observer.disconnect();
  }, []);
  const colored = useMemo(() => series.map((s, index) => ({ ...s, color: s.color || REFERENCE_COLORS[index % REFERENCE_COLORS.length] })), [series]);
  const visible = useMemo(() => colored.filter(s => !hidden.includes(s.key)), [colored, hidden]);
  const scaleSeries = visible.length ? visible : colored;
  const units = useMemo(() => [...new Set(scaleSeries.map(s => s.unit || 'count'))], [scaleSeries]);
  const axes = useMemo(() => Object.fromEntries((units.length ? units : ['count']).map(unit => [unit, niceScale(rows.flatMap(row => scaleSeries.filter(s => (s.unit || 'count') === unit).map(s => row[s.key])), { ticks: 5, integer: unit === 'count' })])), [rows, scaleSeries, units]);
  const left = width < 400 ? 42 : 52, right = width - (units.length > 1 ? 52 : width < 400 ? 22 : 42), top = 34, bottom = height - (rotateDates ? 54 : 34);
  const barWidth = Math.min(38, Math.max(1, (right - left) / Math.max(rows.length, 1) * .6 / Math.max(visible.length, 1)));
  const barPadding = mode === 'bar' ? Math.min((right - left) / 2, visible.length * barWidth / 2 + 1) : 0;
  const annotatePoints = pointLabels && visible.length === 1 && (right - left) / Math.max(1, rows.length - 1) >= 36;
  const dates = rows.map(row => Date.parse(row.date));
  const timeAxis = dates.length > 1 && dates.every(Number.isFinite) && dates.at(-1) > dates[0];
  const x = index => rows.length <= 1 ? (left + right) / 2 : left + barPadding + (timeAxis ? (dates[index] - dates[0]) / (dates.at(-1) - dates[0]) : index / (rows.length - 1)) * (right - left - barPadding * 2);
  const y = (value, unit = 'count') => { const a = axes[unit]; return a ? bottom - (value - a.min) / (a.max - a.min || 1) * (bottom - top) : bottom; };
  // Escala do painel de referência: 20.0M / 15.0K / 600, com ponto decimal.
  const axisLabel = (value, unit) => {
    const n = Math.abs(value);
    const text = n >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(value / 1e3).toFixed(1)}K`
      : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);
    return `${text}${unit === 'percent' ? '%' : ''}`;
  };
  const endpoints = visible.map(s => { let index = rows.length - 1; while (index >= 0 && finiteNumber(rows[index][s.key]) === null) index--; return { ...s, index, value: finiteNumber(rows[index]?.[s.key]) }; }).filter(s => s.value !== null);
  const endLabels = positionEndLabels(endpoints.map(s => ({ ...s, y: y(s.value, s.unit), x: x(s.index) })), top + 8, bottom - 8, 24);
  const hasData = rows.some(row => visible.some(s => finiteNumber(row[s.key]) !== null));
  const selectPointer = event => { const rect = ref.current?.getBoundingClientRect(); if (!rect || !rows.length) return; const pointer = event.clientX - rect.left; setActive(rows.reduce((closest, _, index) => Math.abs(x(index) - pointer) < Math.abs(x(closest) - pointer) ? index : closest, 0)); };
  const selected = active == null ? null : rows[active];
  const tickIndices = new Set(chooseTickIndices(rows.length, right - left, rotateDates && width > 650 ? 22 : width < 400 ? 65 : 80));
  return <div className="rr-chart" data-mode={mode}>
    {showLegend && <div className="rr-chart-legend" aria-label={`Séries de ${title}`}>{colored.map(s => <button key={s.key} aria-pressed={!hidden.includes(s.key)} onClick={() => setHidden(old => old.includes(s.key) ? old.filter(k => k !== s.key) : [...old, s.key])}><i style={{ background: s.color, color: s.color }}/>{s.label}</button>)}</div>}
    <div className="rr-chart-plot" ref={ref} style={{ height }} tabIndex={0} role="group" aria-label={`Explorar ${title}`} onPointerMove={selectPointer} onPointerDown={selectPointer} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(e.key)) { e.preventDefault(); setActive(e.key === 'Escape' ? null : e.key === 'Home' ? 0 : e.key === 'End' ? rows.length - 1 : Math.max(0, Math.min(rows.length - 1, (active ?? 0) + (e.key === 'ArrowRight' ? 1 : -1)))); } }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label={title}>
        <defs>{colored.map((s, index) => <linearGradient key={s.key} id={`${id}-area-${index}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".22"/><stop offset="100%" stopColor={s.color} stopOpacity=".015"/></linearGradient>)}<clipPath id={`${id}-clip`}><rect x={left - 5} y={top - 9} width={right - left + 10} height={bottom - top + 18}/></clipPath></defs>
        {units.slice(0, 2).map((unit, index) => <text key={`unit-${unit}`} className="rr-graph-unit" x={index === 0 ? left : right} y="15" textAnchor={index === 0 ? 'start' : 'end'}>{unit === 'currency' ? 'R$' : unit === 'percent' ? '%' : 'Quantidade'}</text>)}
        {(units.length ? units : ['count']).slice(0, 2).map((unit, i) => (axes[unit] || niceScale([0, 1], { ticks: 5 })).ticks.map(tick => <g key={`${unit}-${tick}`} className="rr-graph-grid">{i === 0 && <line x1={left} x2={right} y1={y(tick, unit)} y2={y(tick, unit)}/>}<text x={i === 0 ? left - 9 : width - 8} y={y(tick, unit) + 3} textAnchor="end">{axisLabel(tick, unit)}</text></g>))}
        {rows.map((row, index) => { return !tickIndices.has(index) ? null : <text key={row.date || index} className="rr-graph-date" transform={rotateDates ? `translate(${x(index)},${bottom + 18}) rotate(-48)` : undefined} x={rotateDates ? undefined : x(index)} y={rotateDates ? undefined : bottom + 22} textAnchor={rotateDates ? 'end' : 'middle'}>{row.label || formatDate(row.date)}</text>; })}
        <g clipPath={`url(#${id}-clip)`}>{visible.map((s, i) => {
          const sy = value => y(value, s.unit), paths = segmentedPaths(rows, s.key, x, sy, sy(0), daily);
          return <g key={s.key} style={{ color: s.color }}>{mode === 'bar' ? rows.map((row, index) => { const value = finiteNumber(row[s.key]); return value === null ? null : <g key={index}><rect x={x(index) + (i - visible.length / 2) * barWidth} y={Math.min(sy(value), sy(0))} height={Math.abs(sy(value) - sy(0))} width={Math.max(.5, barWidth - 1)} rx="3" fill="currentColor"/>{annotatePoints && <text className="rr-graph-value" x={x(index) + (i - visible.length / 2) * barWidth + (barWidth - 1) / 2} y={Math.min(sy(value), sy(0)) - 6} textAnchor="middle" fill="currentColor">{axisLabel(value, s.unit)}</text>}</g>; }) : paths.map((segment, p) => <g key={p}>{(mode === 'area' || s.fill === true) && s.fill !== false && !s.dash && segment.area && <path d={segment.area} fill={`url(#${id}-area-${colored.findIndex(item => item.key === s.key)})`} stroke="none"/>}{segment.line && <><path className="rr-line-glow" d={segment.line} fill="none" stroke="currentColor" strokeWidth="6"/><path d={segment.line} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeDasharray={s.dash}/></>}{segment.points.filter(() => rows.length <= 12 || segment.points.length === 1).map(point => <g key={point.index}><circle cx={point.x} cy={point.y} r="2.7" fill="currentColor"/>{annotatePoints && point.index !== rows.length - 1 && <text className="rr-graph-value" x={point.x} y={Math.max(top + 10, point.y - 10)} textAnchor={point.index === 0 ? "start" : "middle"} fill="currentColor">{axisLabel(point.value ?? rows[point.index][s.key], s.unit)}</text>}</g>)}</g>)}</g>;
        })}{selected && <g><line x1={x(active)} x2={x(active)} y1={top} y2={bottom} stroke="var(--muted)" opacity=".65" strokeDasharray="3 4"/>{mode !== 'bar' && visible.filter(s => finiteNumber(selected[s.key]) !== null).map(s => <g key={s.key}><circle cx={x(active)} cy={y(selected[s.key], s.unit)} r="7" fill={s.color} opacity=".16"/><circle cx={x(active)} cy={y(selected[s.key], s.unit)} r="3.8" fill={s.color} stroke="var(--surface)" strokeWidth="2"/></g>)}</g>}</g>
        {mode !== 'bar' && !selected && endLabels.length <= maxEndLabels && endLabels.map(s => { const label = formatValue(s.value, s.unit, true), labelWidth = Math.min(114, Math.max(54, label.length * 6.2 + 14)); const lx = Math.min(width - labelWidth - 5, Math.max(left, s.x - labelWidth / 2)); return <g key={s.key} style={{ color: s.color }}><circle cx={s.x} cy={s.y} r="2.8" fill="currentColor"/><rect x={lx} y={s.labelY - 23} rx="5" width={labelWidth} height="21" fill="var(--surface, #fff)" stroke="currentColor" strokeWidth=".8"/><text x={lx + labelWidth / 2} y={s.labelY - 9} fill="currentColor" textAnchor="middle" fontSize="12" fontWeight="600">{label}</text></g>; })}
      </svg>
      {!hasData && <div className="rr-chart-empty">{visible.length ? 'Sem dados observados neste período' : 'Selecione uma série na legenda'}</div>}
      {selected && <div className="rr-chart-tooltip" style={{ left: Math.max(4, Math.min(width - 234, Math.max(8, x(active) + 14))), top: 20 }}><strong>{selected.label || formatDate(selected.date, { year: 'numeric' })}</strong>{visible.map(s => <div key={s.key}><span><i style={{ background: s.color }}/>{s.label}</span><b>{formatValue(selected[s.key], s.unit)}</b></div>)}</div>}
    </div>
    <span className="rv-sr-only" aria-live="polite">{selected && `${selected.label || formatDate(selected.date)}. ${visible.map(s => `${s.label}: ${formatValue(selected[s.key], s.unit)}`).join('. ')}`}</span>
  </div>;
}
