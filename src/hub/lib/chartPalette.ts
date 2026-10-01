// Shared with the Masi-inspired Workspace charts in both themes.
export const CHART_PALETTE = [
  'var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)',
  'var(--chart-5)', '#7b93ad', 'var(--error-text)', '#a3aebe',
] as const;
export const chartColor = (i:number):string => CHART_PALETTE[i % CHART_PALETTE.length];
export const TOOLTIP_STYLE = {backgroundColor:'var(--surface)',border:'1px solid var(--border)',borderRadius:'12px',color:'var(--text)'} as const;
export const AXIS_COLOR = 'var(--muted)';
export const GRID_COLOR = 'var(--border)';
export const INK_LIGHT = '#ffffff';
export const INK_DARK = '#152331';
export const FUNNEL_RAMP = [
 {fill:'#354357',ink:INK_LIGHT}, {fill:'#536b82',ink:INK_LIGHT},
 {fill:'#106574',ink:INK_LIGHT}, {fill:'#6fc3c5',ink:INK_DARK}, {fill:'#5acbbb',ink:INK_DARK},
] as const;
export const funnelStep = (i:number,n:number) => FUNNEL_RAMP[n<=1 ? FUNNEL_RAMP.length-1 : Math.round((i/(n-1))*(FUNNEL_RAMP.length-1))];
