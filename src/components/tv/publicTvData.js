import { TV_PANELS } from './tvConfig.js'

export const isPublicTvToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{16}$/.test(token)
export function validPublicPresentation(value) {
  const settings = value?.settings
  if (!settings || settings.version !== 1 || !['fixed', 'rotate'].includes(settings.mode)
    || !['cash', 'gross', 'count'].includes(settings.metric) || !['light', 'dark', 'system'].includes(settings.theme)
    || !Array.isArray(settings.panels) || !settings.panels.length || settings.panels.length > TV_PANELS.length
    || new Set(settings.panels.map(panel => panel.id)).size !== settings.panels.length
    || settings.panels.some(panel => !TV_PANELS.some(item => item.id === panel.id) || panel.enabled !== true || !Number.isInteger(panel.durationSeconds) || panel.durationSeconds < 10 || panel.durationSeconds > 120)
    || (settings.mode === 'fixed' && (settings.panels.length !== 1 || settings.panels[0].id !== settings.fixedPanel))
    || !Number.isInteger(value.revision) || value.revision < 0) return false
  if (value.model === null) return value.loading === true || typeof value.error === 'string'
  const model = value.model
  if (!model || typeof model !== 'object' || !model.totals || !['currency', 'count'].includes(model.unit)) return false
  return settings.panels.every(({ id }) => {
    if (id === 'monthly-goal') return Array.isArray(model.overview?.rows)
    if (id === 'pace') return Array.isArray(model.pace?.rows)
    if (id === 'daily') return Array.isArray(model.daily?.hours)
    if (id === 'team-goals') return Array.isArray(model.teamGoals)
    if (id === 'product-goals') return Array.isArray(model.productGoals)
    if (id === 'sellers') return Array.isArray(model.sellers) && Boolean(model.unassigned)
    if (id === 'products') return Array.isArray(model.products) && Boolean(model.unassigned)
    return Array.isArray(model.payments)
  })
}

// A stale TV can retain its last known amounts, but cannot claim a current pace.
export function stalePublicTvModel(model) {
  if (!model) return model
  const financials = item => item ? { ...item, grossPartial: true, cashPartial: true } : item
  const pace = item => item ? { ...financials(item), definitive: false, sourceIncomplete: true } : item
  return { ...model, totals: { ...financials(model.totals), partial: true }, overview: pace(model.overview), pace: pace(model.pace),
    daily: model.daily ? { ...financials(model.daily), partial: true, hours: (model.daily.hours || []).map(financials) } : undefined,
    unassigned: model.unassigned ? Object.fromEntries(Object.entries(model.unassigned).map(([key, row]) => [key, { ...financials(row), partial: true }])) : undefined,
    ...Object.fromEntries(['teamGoals', 'productGoals'].filter(key => model[key]).map(key => [key, model[key].map(row => ({ ...financials(row), pace: pace(row.pace) }))])),
    ...Object.fromEntries(['sellers', 'products', 'payments'].filter(key => model[key]).map(key => [key, model[key].map(row => ({ ...financials(row), partial: true }))])),
  }
}
