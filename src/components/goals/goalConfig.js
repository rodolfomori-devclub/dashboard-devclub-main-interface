export const GOAL_PRODUCTS = ['MBA', 'DevClub', 'IAClub', 'Seu segundo salário com IA', 'Operação 50K', 'Outros']
export const GOAL_SCOPES = [
  { id: 'overall', label: 'Geral', description: 'Resultado de toda a operação' },
  { id: 'product', label: 'Produto', description: 'Resultado de uma família de produtos' },
  { id: 'team', label: 'Time', description: 'Resultado de uma equipe' },
  { id: 'individual', label: 'Indivíduo', description: 'Resultado de uma pessoa' },
]
export const GOAL_METRICS = {
  gross: { label: 'Bruto', description: 'Valor total da venda antes de taxas.', unit: 'currency' },
  cash: { label: 'Cash collected', description: 'TMB: 40% do bruto vendido. Asaas: recebimentos antes das taxas, incluindo parcelas anteriores. Demais lançamentos: caixa declarado.', unit: 'currency' },
  operational: { label: 'Valor operacional', description: 'Preserva o critério atual de cálculo de cada plataforma.', unit: 'currency' },
  net: { label: 'Valor líquido', description: 'Valor líquido informado pela fonte, separado do caixa já recebido.', unit: 'currency' },
  count: { label: 'Quantidade de vendas', description: 'Número de vendas registradas no período.', unit: 'count' },
}
export const GOAL_AREAS = [{ key: 'marketing', label: 'Marketing' }, { key: 'sales', label: 'Vendas' }]
export const GOAL_TIERS = [['target', 'Meta base'], ['superTarget', 'Supermeta'], ['ultraTarget', 'Ultrameta']]
const MAX_GOAL = 999999999999
export const emptyGoalBreakdown = () => GOAL_AREAS.map(({ key }) => ({ key, target: '', superTarget: '', ultraTarget: '' }))

function goalAmount(input, metric, strictCents = false) {
  const value = Number(input)
  if (!['number', 'string'].includes(typeof input) || String(input).trim() === '' || !Number.isFinite(value) || value < 0 || value > MAX_GOAL || (metric === 'count' && !Number.isInteger(value))) throw new Error(metric === 'count' ? 'Preencha as três faixas com quantidades inteiras, maiores ou iguais a zero.' : 'Preencha as três faixas com valores maiores ou iguais a zero.')
  if (strictCents && metric !== 'count' && Number(value.toFixed(2)) !== value) throw new Error('Use no máximo duas casas decimais nos valores de Marketing e Vendas.')
  return value
}

function tierValues(input, metric, strictCents = false) {
  const values = Object.fromEntries(GOAL_TIERS.map(([field]) => [field, goalAmount(input[field], metric, strictCents)]))
  if (values.superTarget < values.target || values.ultraTarget < values.superTarget) throw new Error('A supermeta deve ser maior ou igual à meta base, e a ultrameta deve ser maior ou igual à supermeta.')
  return values
}

export function normalizeGoalBreakdown(input, metric) {
  if (!Array.isArray(input) || input.length !== GOAL_AREAS.length || GOAL_AREAS.some(({ key }) => input.filter(item => item?.key === key).length !== 1)) throw new Error('Informe as metas de Marketing e Vendas.')
  return GOAL_AREAS.map(({ key, label }) => {
    try { return { key, ...tierValues(input.find(item => item.key === key), metric, true) } }
    catch (failure) { throw new Error(`${label}: ${failure.message}`) }
  })
}

// Sum integer cents. Empty/unknown components must never become zero in previews.
export function goalBreakdownTotals(input, metric) {
  const parts = normalizeGoalBreakdown(input, metric)
  const scale = metric === 'count' ? 1 : 100
  const totals = Object.fromEntries(GOAL_TIERS.map(([field]) => [field, parts.reduce((sum, part) => sum + Math.round(part[field] * scale), 0) / scale]))
  if (GOAL_TIERS.some(([field]) => totals[field] > MAX_GOAL)) throw new Error('A soma de Marketing e Vendas ultrapassa o limite permitido para a meta geral.')
  return totals
}

export function goalBreakdownPreview(input, metric) {
  const scale = metric === 'count' ? 1 : 100
  return Object.fromEntries(GOAL_TIERS.map(([field]) => {
    try {
      const values = GOAL_AREAS.map(({ key }) => goalAmount(input?.find(part => part.key === key)?.[field], metric, true))
      const total = values.reduce((sum, value) => sum + Math.round(value * scale), 0) / scale
      return [field, total <= MAX_GOAL ? total : null]
    } catch { return [field, null] }
  }))
}

export function normalizeGoalPlan(plan) {
  const scope = plan.scope || (plan.product && plan.product !== 'all' ? 'product' : 'overall')
  return { ...plan, scope, scopeId: scope === 'overall' ? '' : plan.scopeId ?? (scope === 'product' ? plan.product : ''), product: scope === 'product' ? plan.scopeId || plan.product : 'all' }
}
export const goalPlanKey = plan => JSON.stringify([plan.scope, plan.scopeId, plan.metric])
export const goalDraft = plan => ({
  target: plan?.target ?? '', superTarget: plan?.superTarget ?? '', ultraTarget: plan?.ultraTarget ?? '',
  paceBasis: plan?.paceBasis || 'calendar', notes: plan?.notes || '',
  breakdown: Array.isArray(plan?.breakdown) ? plan.breakdown.map(part => ({ ...part })) : null,
})

export function goalScopeTargets(scope, options, plans = []) {
  if (scope === 'overall') return [{ id: '', name: 'Meta geral', active: true }]
  if (scope === 'product') return GOAL_PRODUCTS.map(name => ({ id: name, name, active: true }))
  const current = (scope === 'team' ? options.teams : options.individuals) || []
  const byId = new Map(current.map(item => [item.id, { ...item, active: item.active !== false && !item.archived }]))
  for (const plan of plans.filter(item => item.scope === scope)) if (!byId.has(plan.scopeId)) byId.set(plan.scopeId, { id: plan.scopeId, name: plan.scopeName || 'Cadastro indisponível', active: false, archived: true })
  return [...byId.values()].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'pt-BR'))
}

export function buildGoalPayload({ scope, scopeId, metric, draft }) {
  if (!GOAL_SCOPES.some(item => item.id === scope) || !Object.hasOwn(GOAL_METRICS, metric)) throw new Error('Escolha um escopo e um indicador válidos.')
  if (scope === 'overall' && scopeId !== '') throw new Error('A meta geral não possui um time, produto ou indivíduo.')
  if (scope === 'product' && !GOAL_PRODUCTS.includes(scopeId)) throw new Error('Escolha uma família de produtos válida.')
  if (['team', 'individual'].includes(scope) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(scopeId)) throw new Error('Selecione um cadastro válido.')
  const divided = draft.breakdown !== null && draft.breakdown !== undefined
  if (divided && scope !== 'overall') throw new Error('Marketing e Vendas compõem somente a meta geral.')
  const breakdown = divided ? normalizeGoalBreakdown(draft.breakdown, metric) : null
  const values = divided ? goalBreakdownTotals(breakdown, metric) : tierValues(draft, metric)
  if (!['calendar', 'business'].includes(draft.paceBasis)) throw new Error('Escolha como distribuir o ritmo da meta.')
  return { scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric, ...values, ...(divided ? { breakdown } : {}), paceBasis: draft.paceBasis, notes: String(draft.notes || '').slice(0, 2000) }
}
