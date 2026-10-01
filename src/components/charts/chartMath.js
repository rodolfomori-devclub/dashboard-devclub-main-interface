const DAY_MS = 86_400_000;

/** Category identity, not ranking, decides its color across sorting/filtering. */
export function categoryColorIndex(label) {
  const key = String(label ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const identities = { entraram: 1, "boas-vindas": 3, agendaram: 4, participaram: 2, concluiram: 0, usaram: 5, "ate 7 dias": 5, "8–30 dias": 2, "31–90 dias": 1, "apos 90 dias": 4 };
  if (Object.hasOwn(identities, key)) return identities[key];
  let hash = 0;
  for (const char of key) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  return hash % 6;
}

/** Keep endpoint badges separate; connector lines preserve the real y position. */
export function positionEndLabels(items, top, bottom, gap = 27) {
  if (!items.length || (items.length - 1) * gap > bottom - top) return [];
  const sorted = [...items].sort((a, b) => a.y - b.y);
  const positioned = sorted.map(item => ({ ...item, labelY: Math.max(top, Math.min(bottom, item.y)) }));
  for (let index = 1; index < positioned.length; index++) positioned[index].labelY = Math.max(positioned[index].labelY, positioned[index - 1].labelY + gap);
  positioned.at(-1).labelY = Math.min(bottom, positioned.at(-1).labelY);
  for (let index = positioned.length - 2; index >= 0; index--) positioned[index].labelY = Math.min(positioned[index].labelY, positioned[index + 1].labelY - gap);
  return positioned;
}

export function tickPrecision(step) {
  if (!Number.isFinite(step) || step <= 0) return 0;
  for (let precision = 0; precision <= 8; precision++) {
    if (Math.abs(step - Number(step.toFixed(precision))) <= Math.abs(step) * 1e-9) return precision;
  }
  return 8;
}

export function finiteNumber(value) {
  if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function niceScale(values, { ticks = 5, integer = false } = {}) {
  const numbers = values.map(finiteNumber).filter(value => value !== null);
  const low = Math.min(0, ...numbers);
  const high = Math.max(0, ...numbers);
  if (low === 0 && high === 0) return { min: 0, max: 1, step: 1, ticks: [0, 1] };
  const rough = (high - low) / Math.max(2, ticks - 1);
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const multiplier = [1, 2, 2.5, 5, 10].find(candidate => candidate >= fraction) || 10;
  let step = multiplier * power;
  if (integer) step = Math.max(1, Math.ceil(step));
  const min = Math.floor(low / step) * step;
  const max = Math.ceil(high / step) * step;
  const precision = Math.max(0, Math.min(12, -Math.floor(Math.log10(step)) + 1));
  const count = Math.min(20, Math.round((max - min) / step));
  return { min, max, step, ticks: Array.from({ length: count + 1 }, (_, index) => Number((min + step * index).toFixed(precision))) };
}

export function dateTimestamp(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

/** Daily rows use real date spacing. Missing dates are gaps, never zero facts. */
export function timeGeometry(rows, left, right, mode = "line") {
  const timestamps = rows.map(row => dateTimestamp(row.date));
  const dated = timestamps.every(timestamp => timestamp !== null);
  const minimum = dated && rows.length ? Math.min(...timestamps) : 0;
  const maximum = dated && rows.length ? Math.max(...timestamps) : Math.max(0, rows.length - 1);
  const span = maximum - minimum;
  const count = dated ? Math.round(span / DAY_MS) + 1 : rows.length;
  const step = (right - left) / Math.max(1, mode === "bar" ? count : count - 1);
  const padding = mode === "bar" ? step / 2 : 0;
  const position = (timestampOrIndex) => span === 0 ? (left + right) / 2 : left + padding + (timestampOrIndex - minimum) / span * (right - left - padding * 2);
  return {
    count, step, dated, minimum, maximum,
    x: index => position(dated ? timestamps[index] : index),
    tickX: index => count <= 1 ? (left + right) / 2 : left + padding + index / (count - 1) * (right - left - padding * 2),
    tickLabel: index => dated ? new Date(minimum + index * DAY_MS).toISOString().slice(0, 10) : String(rows[index]?.date ?? ""),
  };
}

export function chooseTickIndices(count, width, minGap = 90) {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const tickCount = Math.max(2, Math.min(count, Math.floor(width / minGap) + 1));
  return [...new Set(Array.from({ length: tickCount }, (_, index) => Math.round(index / (tickCount - 1) * (count - 1))))];
}

export function nearestIndex(position, positions) {
  if (!positions.length || !Number.isFinite(position)) return null;
  let nearest = 0;
  for (let index = 1; index < positions.length; index++) {
    if (Math.abs(positions[index] - position) < Math.abs(positions[nearest] - position)) nearest = index;
  }
  return nearest;
}

export function keyboardIndex(key, current, length) {
  if (!length) return null;
  if (key === "Escape") return null;
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return current == null ? 0 : Math.min(length - 1, current + 1);
  if (key === "ArrowLeft" || key === "ArrowUp") return current == null ? length - 1 : Math.max(0, current - 1);
  return current;
}

/**
 * C1 cubic Hermite interpolation with a minmod tangent limiter.
 * Each tangent has the neighboring secants' sign and no greater magnitude.
 * Consequently, both Bezier controls stay ordered inside each pair's range:
 * the curve passes through every observation and cannot invent a new extreme.
 */
export function monotoneCurve(points) {
  const linear = () => ({ path: points.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" "), segments: [] });
  if (points.length < 3) return linear();
  const widths = points.slice(1).map((point, index) => point.x - points[index].x);
  // Coincident/unsorted x coordinates cannot define a single-valued curve.
  if (widths.some(width => !Number.isFinite(width) || width <= 0)) return linear();
  const slopes = widths.map((width, index) => (points[index + 1].y - points[index].y) / width);
  const tangents = points.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === points.length - 1) return slopes.at(-1);
    const before = slopes[index - 1], after = slopes[index];
    return Math.sign(before) === Math.sign(after) ? Math.sign(before) * Math.min(Math.abs(before), Math.abs(after)) : 0;
  });
  const segments = widths.map((width, index) => ({
    from: points[index], to: points[index + 1],
    first: { x: points[index].x + width / 3, y: points[index].y + tangents[index] * width / 3 },
    second: { x: points[index + 1].x - width / 3, y: points[index + 1].y - tangents[index + 1] * width / 3 },
  }));
  return { path: `M${points[0].x},${points[0].y} ${segments.map(({ first, second, to }) => `C${first.x},${first.y} ${second.x},${second.y} ${to.x},${to.y}`).join(" ")}`, segments };
}

export function segmentedPaths(rows, key, x, y, baseline, daily = true) {
  const groups = [];
  let group = [];
  let previousDate = null;
  const flush = () => { if (group.length) groups.push(group); group = []; };
  rows.forEach((row, index) => {
    const value = finiteNumber(row[key]);
    const date = daily ? dateTimestamp(row.date) : null;
    if (value === null) { flush(); previousDate = null; return; }
    if (date !== null && previousDate !== null && date - previousDate > DAY_MS) flush();
    group.push({ x: x(index), y: y(value), index, value });
    previousDate = date;
  });
  flush();
  return groups.map(points => {
    const { path: line } = monotoneCurve(points);
    return { points, line, area: points.length > 1 ? `${line} L${points.at(-1).x},${baseline} L${points[0].x},${baseline} Z` : "" };
  });
}
