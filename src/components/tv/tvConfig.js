export const TV_PANELS = [
  { id: 'monthly-goal', title: 'Meta do mês', description: 'Resultado acumulado, objetivo e quanto falta para chegar lá.' },
  { id: 'pace', title: 'Ritmo da meta', description: 'Curva diária do realizado e do planejado, em tela ampla.' },
  { id: 'team-goals', title: 'Metas dos times', description: 'Avanço de cada time em relação ao seu próprio objetivo.' },
  { id: 'product-goals', title: 'Metas dos produtos', description: 'Realizado e meta de cada operação.' },
  { id: 'sellers', title: 'Top vendedores', description: 'Ranking de vendas atribuídas aos vendedores.' },
  { id: 'products', title: 'Top produtos', description: 'Os produtos com maior resultado no mês.' },
  { id: 'daily', title: 'Vendas do dia', description: 'Resultado de hoje e distribuição por hora, no horário de Brasília.' },
  { id: 'payment-mix', title: 'Meios de pagamento', description: 'Participação de cartão, boleto, Pix e outros meios.' },
  { id: 'daily-payments', title: 'Cartão vs. boleto do dia', description: 'Valor, quantidade e cash collected por meio de pagamento, somente hoje.' },
  { id: 'daily-cash', title: 'Cash collected do dia', description: 'Cash collected das novas vendas de hoje, com evolução por hora.' },
  { id: 'daily-sellers', title: 'Top vendedores do dia', description: 'Ranking dos vendedores considerando somente o resultado de hoje.' },
  { id: 'weekly', title: 'Vendas da semana', description: 'Resultado acumulado de segunda-feira até hoje e distribuição por dia, no horário de Brasília.' },
  { id: 'weekly-payments', title: 'Cartão vs. boleto da semana', description: 'Valor, quantidade e cash collected por meio de pagamento, de segunda-feira até hoje.' },
  { id: 'weekly-cash', title: 'Cash collected da semana', description: 'Cash collected das novas vendas de segunda-feira até hoje, com evolução por dia.' },
  { id: 'weekly-sellers', title: 'Top vendedores da semana', description: 'Ranking dos vendedores pelo resultado acumulado de segunda-feira até hoje.' },
]
export const DAILY_TV_PANELS = ['daily', 'daily-payments', 'daily-cash', 'daily-sellers']
export const WEEKLY_TV_PANELS = ['weekly', 'weekly-payments', 'weekly-cash', 'weekly-sellers']
export const TV_PRESETS = {
  'Modo diário': DAILY_TV_PANELS,
  'Modo semanal': WEEKLY_TV_PANELS,
  'Visão da operação': ['monthly-goal', 'pace', 'team-goals', 'product-goals', 'sellers', 'products'],
  'Comercial': ['daily', 'sellers', 'team-goals', 'monthly-goal'],
  'Metas': ['monthly-goal', 'pace', 'team-goals', 'product-goals'],
  'Produtos': ['products', 'product-goals', 'payment-mix'],
}
// Existing shared programs keep their order and selection as new scenes become available.
export function withAvailableTvPanels(settings) {
  const missing = TV_PANELS.filter(panel => !settings.panels.some(item => item.id === panel.id))
  return { ...settings, panels: [...settings.panels, ...missing.map(panel => ({ id: panel.id, enabled: false, durationSeconds: 20 }))] }
}
export function applyTvPreset(settings, name) {
  const ids = TV_PRESETS[name]
  if (!ids) return settings
  const currentPeriod = name === 'Modo diário' || name === 'Modo semanal'
  return { ...settings, fixedPanel: ids[0],
    ...(currentPeriod ? { mode: 'rotate', monthMode: 'current', month: '', metric: 'gross', paceScope: 'overall', paceScopeId: '' } : {}),
    panels: [...ids, ...TV_PANELS.map(panel => panel.id).filter(id => !ids.includes(id))].map(id => ({
      id, durationSeconds: currentPeriod ? 20 : settings.panels.find(panel => panel.id === id)?.durationSeconds || 20, enabled: ids.includes(id),
    })),
  }
}
export function isDailyTvProgram(settings) {
  const active = activeTvPanels(settings)
  return active.length > 0 && active.every(panel => DAILY_TV_PANELS.includes(panel.id))
}
export function isWeeklyTvProgram(settings) {
  const active = activeTvPanels(settings)
  return active.length > 0 && active.every(panel => WEEKLY_TV_PANELS.includes(panel.id))
}
export const TV_METRICS = { gross: 'Valor das vendas', cash: 'Cash collected · novas vendas', count: 'Quantidade de vendas' }
export function defaultTvSettings() {
  return { version: 1, mode: 'rotate', fixedPanel: 'monthly-goal', metric: 'gross', monthMode: 'current', month: '', theme: 'system', paceScope: 'overall', paceScopeId: '',
    panels: TV_PANELS.map((panel, index) => ({ id: panel.id, enabled: index < 6, durationSeconds: 20 })) }
}
export function activeTvPanels(settings) {
  const enabled = settings.panels.filter(panel => panel.enabled && TV_PANELS.some(item => item.id === panel.id))
  return settings.mode === 'fixed' ? enabled.filter(panel => panel.id === settings.fixedPanel) : enabled
}
export function tvMonthLabel(month) {
  return /^\d{4}-\d{2}$/.test(month || '') ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`)) : 'Mês atual'
}
export function tvDayLabel(day) {
  return /^\d{4}-\d{2}-\d{2}$/.test(day || '') ? `Hoje, ${new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))} · Brasília` : 'Hoje · horário de Brasília'
}
export function tvWeekLabel(startDate, endDate) {
  if (![startDate, endDate].every(day => /^\d{4}-\d{2}-\d{2}$/.test(day || ''))) return 'Semana atual · segunda até hoje · Brasília'
  const dates = [startDate, endDate].map(day => new Date(`${day}T12:00:00Z`))
  if (dates.some(date => !Number.isFinite(date.getTime()))) return 'Semana atual · segunda até hoje · Brasília'
  const format = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', ...(startDate.slice(0, 4) !== endDate.slice(0, 4) ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  return `Semana, ${format.format(dates[0])} a ${format.format(dates[1])} · Brasília`
}
