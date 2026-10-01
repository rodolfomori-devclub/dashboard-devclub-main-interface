export const GOAL_SCOPES = { overall: 'Geral', team: 'Time', product: 'Produto', individual: 'Indivíduo' }

// Old plans continue to address the same general/product target.
export function goalScope(plan = {}) {
  const scope = plan.scope || (plan.product && plan.product !== 'all' ? 'product' : 'overall')
  const scopeId = scope === 'overall' ? '' : plan.scopeId || (scope === 'product' ? plan.product : '') || ''
  return { scope, scopeId }
}
export function goalScopeKey(plan) {
  const { scope, scopeId } = goalScope(plan)
  return JSON.stringify([scope, scopeId])
}
export function goalScopeName(plan = {}) {
  const { scope, scopeId } = goalScope(plan)
  return scope === 'overall' ? 'Meta geral' : plan.scopeName || scopeId || GOAL_SCOPES[scope]
}
export function recordMatchesGoal(row, plan) {
  const { scope, scopeId } = goalScope(plan)
  if (scope === 'product') return row.family === scopeId
  if (scope === 'team') return Boolean(scopeId) && row.teamId === scopeId
  if (scope === 'individual') return Boolean(scopeId) && row.sellerId === scopeId
  return true
}
export function recordUnallocatedForGoal(row, plan) {
  const { scope } = goalScope(plan)
  if (scope === 'product') return !row.family || row.family === 'Não informado'
  if (scope === 'individual') return !row.sellerId
  if (scope === 'team') return !row.teamId
  return false
}
