import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoalPayload, goalDraft, goalPlanKey, goalScopeTargets, normalizeGoalPlan } from '../src/components/goals/goalConfig.js'

const uuid = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const draft = { target: '1000.25', superTarget: '2000', ultraTarget: '3000', paceBasis: 'business', notes: 'Plano mensal', id: 'ignored', updatedAt: 'ignored', scopeName: 'Ignored' }

test('legacy goal identities remain separate from new team/individual plans', () => {
  const overall = normalizeGoalPlan({ product: 'all', metric: 'gross' })
  const product = normalizeGoalPlan({ product: 'DevClub', metric: 'gross' })
  const team = normalizeGoalPlan({ scope: 'team', scopeId: uuid, product: 'all', metric: 'gross' })
  assert.equal(overall.scope, 'overall'); assert.equal(overall.scopeId, '')
  assert.equal(product.scope, 'product'); assert.equal(product.scopeId, 'DevClub')
  assert.equal(new Set([overall, product, team].map(goalPlanKey)).size, 3)
})

test('each scope emits only the scoped write contract for both financial metrics', () => {
  for (const [scope, scopeId] of [['overall', ''], ['product', 'Seu segundo salário com IA'], ['team', uuid], ['individual', uuid]]) {
    for (const metric of ['gross', 'cash']) assert.deepEqual(buildGoalPayload({ scope, scopeId, metric, draft }), {
      scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric,
      target: 1000.25, superTarget: 2000, ultraTarget: 3000, paceBasis: 'business', notes: 'Plano mensal',
    })
  }
})

test('unconfigured values remain blank while an explicit zero remains a valid plan', () => {
  assert.equal(goalDraft().target, '')
  assert.equal(goalDraft({ target: 0 }).target, 0)
  for (const target of ['', null, undefined, NaN, false, [], -1, Infinity]) assert.throws(() => buildGoalPayload({ scope: 'overall', scopeId: '', metric: 'gross', draft: { ...draft, target } }))
  assert.equal(buildGoalPayload({ scope: 'overall', scopeId: '', metric: 'gross', draft: { ...draft, target: 0 } }).target, 0)
})

test('invalid tier ordering, fractional quantities and scope IDs fail before write', () => {
  const input = { scope: 'overall', scopeId: '', metric: 'gross', draft }
  assert.throws(() => buildGoalPayload({ ...input, draft: { ...draft, target: 2001 } }), /supermeta/)
  assert.throws(() => buildGoalPayload({ ...input, draft: { ...draft, ultraTarget: 1999 } }), /ultrameta/)
  assert.throws(() => buildGoalPayload({ ...input, metric: 'count' }), /inteiras/)
  assert.throws(() => buildGoalPayload({ ...input, scope: 'team', scopeId: 'all' }), /cadastro/)
  assert.throws(() => buildGoalPayload({ ...input, scope: 'product', scopeId: 'mba' }), /família/)
  assert.throws(() => buildGoalPayload({ ...input, scopeId: uuid }), /geral/)
})

test('historical inactive destinations remain identifiable without becoming editable', () => {
  const options = { teams: [{ id: uuid, name: 'Time A', active: true }, { id: 'archived', name: 'Time B', active: true, archived: true }] }
  const result = goalScopeTargets('team', options, [{ scope: 'team', scopeId: 'missing', scopeName: 'Time anterior' }])
  assert.deepEqual(result.map(({ id, active }) => ({ id, active })), [{ id: uuid, active: true }, { id: 'missing', active: false }, { id: 'archived', active: false }])
  assert.equal(result[1].name, 'Time anterior')
  assert.equal(goalScopeTargets('individual', {}, []).length, 0)
})
