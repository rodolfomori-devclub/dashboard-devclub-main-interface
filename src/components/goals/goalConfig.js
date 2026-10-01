export const GOAL_PRODUCTS = ['MBA', 'DevClub', 'IAClub', 'Seu segundo salário com IA', 'Outros']
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

export function normalizeGoalPlan(plan) {
  const scope = plan.scope || (plan.product && plan.product !== 'all' ? 'product' : 'overall')
  return { ...plan, scope, scopeId: scope === 'overall' ? '' : plan.scopeId ?? (scope === 'product' ? plan.product : ''), product: scope === 'product' ? plan.scopeId || plan.product : 'all' }
}
export const goalPlanKey = plan => JSON.stringify([plan.scope, plan.scopeId, plan.metric])
export const goalDraft = plan => ({
  target: plan?.target ?? '', superTarget: plan?.superTarget ?? '', ultraTarget: plan?.ultraTarget ?? '',
  paceBasis: plan?.paceBasis || 'calendar', notes: plan?.notes || '',
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
  const values = Object.fromEntries(['target', 'superTarget', 'ultraTarget'].map(field => {
    const input = draft[field], value = Number(input)
    if (!['number', 'string'].includes(typeof input) || String(input).trim() === '' || !Number.isFinite(value) || value < 0 || value > 999999999999 || (metric === 'count' && !Number.isInteger(value))) throw new Error(metric === 'count' ? 'Preencha as três faixas com quantidades inteiras, maiores ou iguais a zero.' : 'Preencha as três faixas com valores maiores ou iguais a zero.')
    return [field, value]
  }))
  if (values.superTarget < values.target || values.ultraTarget < values.superTarget) throw new Error('A supermeta deve ser maior ou igual à meta base, e a ultrameta deve ser maior ou igual à supermeta.')
  if (!['calendar', 'business'].includes(draft.paceBasis)) throw new Error('Escolha como distribuir o ritmo da meta.')
  return { scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric, ...values, paceBasis: draft.paceBasis, notes: String(draft.notes || '').slice(0, 2000) }
}
