import { deltaParts, format } from './comparisonFormat'

export const metricDisplay = (metric, unit = 'currency') => <span className="tabular-nums">{format(metric?.value, unit)}{metric?.partial && <span className="block text-[11px] font-normal text-amber-700 dark:text-amber-300 mt-1">Parcial</span>}</span>
export const deltaView = (delta, unit = 'currency') => {
  const parts = deltaParts(delta, unit)
  if (parts.suspended) return <span className="text-xs text-slate-500 dark:text-slate-400">{parts.suspended}</span>
  return <span className="tabular-nums">{parts.value}<span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{parts.detail}</span></span>
}
