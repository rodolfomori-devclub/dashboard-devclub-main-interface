import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGoalPayload, emptyGoalBreakdown, goalBreakdownPreview, goalBreakdownTotals, goalDraft, goalPlanKey, goalProductPreview, goalScopeTargets, normalizeGoalPlan } from '../src/components/goals/goalConfig.js'
import { normalizeSource, PRODUCT_FAMILIES } from '../src/utils/salesData.js'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'

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
  for (const [scope, scopeId] of [['overall', ''], ['product', 'Seu segundo salário com IA'], ['product', 'Operação 50K'], ['team', uuid], ['individual', uuid]]) {
    for (const metric of ['gross', 'cash']) assert.deepEqual(buildGoalPayload({ scope, scopeId, metric, draft }), {
      scope, scopeId, product: scope === 'product' ? scopeId : 'all', metric,
      target: 1000.25, superTarget: 2000, ultraTarget: 3000, paceBasis: 'business', notes: 'Plano mensal',
    })
  }
})

test('Operação 50K connects goal selection to its own gross and TMB cash pace', () => {
  const product = 'Operação 50K'
  assert.ok(PRODUCT_FAMILIES.includes(product))
  assert.ok(goalScopeTargets('product', {}).some(item => item.id === product && item.active))
  const records = normalizeSource('tmb', { data: [
    { value: 1000, product: 'DevClub - Operação 50K', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 1, valor_total: 1000 } },
    { value: 500, product: 'DevClub Full Stack', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 2, valor_total: 500 } },
  ] })
  const data = prepareGoalData({ records, sources: [{ id: 'tmb', kind: 'sale', status: 'ready' }] })
  for (const [metric, expected] of [['gross', 1000], ['cash', 400]]) {
    const plan = buildGoalPayload({ scope: 'product', scopeId: product, metric, draft })
    const pace = calculateGoalPace({ ...data, year: 2026, month: 10, plan, today: '2026-10-01' })
    assert.equal(pace.actual, expected)
    assert.equal(pace.rows[0].actual, expected)
    assert.equal(pace.rows[1].actual, null)
  }
})

test('Vitalício is selectable for goals without changing product families or their totals', () => {
  const product = 'Vitalício'
  assert.equal(PRODUCT_FAMILIES.includes(product), false)
  assert.ok(goalScopeTargets('product', {}).some(item => item.id === product && item.active))
  const records = normalizeSource('tmb', { data: [
    { value: 1000, product: 'DevClub Vitalício', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 1, valor_total: 1000 } },
    { value: 500, product: 'MBA VITALICIO', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 2, valor_total: 500 } },
    { value: 700, product: 'DevClub Full Stack', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 3, valor_total: 700 } },
    { value: 200, product: 'Vitalício', timestamp: '2026-10-01T15:00:00Z', raw: { pedido_id: 4, valor_total: 200 } },
  ] })
  assert.deepEqual(records.map(row => row.family), ['DevClub', 'MBA', 'DevClub', 'Outros'])
  const data = prepareGoalData({ records, sources: [{ id: 'tmb', kind: 'sale', status: 'ready' }] })
  for (const [metric, expected] of [['gross', 1700], ['cash', 680], ['count', 3]]) {
    const plan = buildGoalPayload({ scope: 'product', scopeId: product, metric, draft: { ...draft, target: '1000' } })
    assert.equal(plan.product, product)
    assert.equal(plan.scopeId, product)
    assert.equal(calculateGoalPace({ ...data, year: 2026, month: 10, plan, today: '2026-10-01' }).actual, expected)
  }
  for (const [family, expected] of [['DevClub', 1700], ['MBA', 500], ['Outros', 200]]) {
    const plan = buildGoalPayload({ scope: 'product', scopeId: family, metric: 'gross', draft })
    assert.equal(calculateGoalPace({ ...data, year: 2026, month: 10, plan, today: '2026-10-01' }).actual, expected)
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

test('overall totals are derived from Marketing and Vendas for independent gross and cash plans', () => {
  const breakdown = [
    { key: 'marketing', target: '400', superTarget: '500', ultraTarget: '600' },
    { key: 'sales', target: '600', superTarget: '800', ultraTarget: '1000' },
  ]
  for (const metric of ['gross', 'cash']) {
    const payload = buildGoalPayload({ scope: 'overall', scopeId: '', metric, draft: { ...draft, target: '999999', breakdown } })
    assert.deepEqual([payload.target, payload.superTarget, payload.ultraTarget], [1000, 1300, 1600])
    assert.equal(payload.breakdown[0].target, 400)
    assert.equal(payload.metric, metric)
    const copy = goalDraft(payload)
    copy.breakdown[0].target = 123
    assert.equal(payload.breakdown[0].target, 400, 'Editing a draft must not mutate the saved plan')
  }
  assert.equal(goalDraft({ target: 1500 }).breakdown, null, 'Existing totals are never silently allocated')
})

test('breakdown sums exact cents and previews distinguish blank components from zero', () => {
  const breakdown = [
    { key: 'marketing', target: .1, superTarget: 1.15, ultraTarget: 10.07 },
    { key: 'sales', target: .2, superTarget: 2.35, ultraTarget: 20.09 },
  ]
  assert.deepEqual(goalBreakdownTotals(breakdown, 'cash'), { target: .3, superTarget: 3.5, ultraTarget: 30.16 })
  const incomplete = emptyGoalBreakdown()
  assert.equal(goalBreakdownPreview(incomplete, 'gross').target, null)
  incomplete[0].target = '0'; incomplete[1].target = '0'
  assert.deepEqual(goalBreakdownPreview(incomplete, 'gross'), { target: 0, superTarget: null, ultraTarget: null })
  assert.throws(() => goalBreakdownTotals(incomplete, 'gross'), /Marketing/)
})

test('split goals reject invalid parts, cross-scope use, fractional counts and excessive totals', () => {
  const breakdown = [
    { key: 'marketing', target: 100, superTarget: 200, ultraTarget: 300 },
    { key: 'sales', target: 100, superTarget: 200, ultraTarget: 300 },
  ]
  const input = { scope: 'overall', scopeId: '', metric: 'gross', draft: { ...draft, breakdown } }
  assert.throws(() => buildGoalPayload({ ...input, scope: 'product', scopeId: 'DevClub' }), /somente a meta geral/)
  for (const parts of [breakdown.slice(0, 1), [breakdown[0], breakdown[0]], [breakdown[0], { ...breakdown[1], key: 'other' }]]) assert.throws(() => buildGoalPayload({ ...input, draft: { ...draft, breakdown: parts } }), /Marketing e Vendas/)
  for (const target of ['', null, false, -1, Infinity, .001, 201]) assert.throws(() => buildGoalPayload({ ...input, draft: { ...draft, breakdown: [{ ...breakdown[0], target }, breakdown[1]] } }))
  assert.throws(() => buildGoalPayload({ ...input, metric: 'count', draft: { ...draft, breakdown: [{ ...breakdown[0], target: .5 }, breakdown[1]] } }), /inteiras/)
  assert.throws(() => goalBreakdownTotals(breakdown.map(part => ({ ...part, target: 600000000000, superTarget: 600000000000, ultraTarget: 600000000000 })), 'gross'), /limite/)
})

test('product prefilling sums exact tiers only for product plans of the selected metric, including Vitalício', () => {
  const product = (scopeId, target, superTarget, ultraTarget, metric = 'gross') => ({ scope: 'product', scopeId, metric, target, superTarget, ultraTarget })
  const plans = [product('DevClub', .1, 1.15, 10.07), product('Vitalício', .2, 2.35, 20.09), product('MBA', 100, 200, 300, 'cash'),
    { ...product('', 1000, 2000, 3000), scope: 'overall' }, { ...product(uuid, 1000, 2000, 3000), scope: 'team' }, { ...product(uuid, 1000, 2000, 3000), scope: 'individual' }]
  const original = structuredClone(plans)
  const preview = goalProductPreview(plans, 'gross')
  assert.deepEqual(preview.products.map(plan => plan.scopeId), ['DevClub', 'Vitalício'])
  assert.deepEqual(preview.totals, { target: .3, superTarget: 3.5, ultraTarget: 30.16 })
  assert.deepEqual(goalProductPreview(plans, 'cash').totals, { target: 100, superTarget: 200, ultraTarget: 300 })
  assert.deepEqual(plans, original, 'A preview must not mutate the saved product plans')
})

test('product prefilling distinguishes missing and zero plans and rejects invalid amounts or overflowing totals', () => {
  const plan = { product: 'DevClub', metric: 'gross', target: 0, superTarget: 0, ultraTarget: 0 }
  assert.deepEqual(goalProductPreview([], 'gross'), { products: [], totals: null })
  assert.deepEqual(goalProductPreview([plan], 'gross').totals, { target: 0, superTarget: 0, ultraTarget: 0 })
  assert.deepEqual(goalProductPreview([{ ...plan, metric: 'count', target: 2, superTarget: 3, ultraTarget: 4 }], 'count').totals, { target: 2, superTarget: 3, ultraTarget: 4 })
  for (const target of ['', null, -1, Infinity, .001, 1]) assert.throws(() => goalProductPreview([{ ...plan, target }], 'gross'))
  assert.throws(() => goalProductPreview([{ ...plan, metric: 'count', target: .5, superTarget: 1, ultraTarget: 2 }], 'count'), /inteiras/)
  const large = { ...plan, target: 600000000000, superTarget: 600000000000, ultraTarget: 600000000000 }
  assert.throws(() => goalProductPreview([large, { ...large, product: 'MBA' }], 'gross'), /limite/)
})

test('only an explicit overall conversion sends clearBreakdown without altering ordinary write contracts', () => {
  const input = { scope: 'overall', scopeId: '', metric: 'gross', draft: { ...draft, breakdown: null } }
  assert.equal(Object.hasOwn(buildGoalPayload(input), 'clearBreakdown'), false)
  const payload = buildGoalPayload({ ...input, draft: { ...input.draft, clearBreakdown: true } })
  assert.equal(payload.clearBreakdown, true)
  assert.equal(Object.hasOwn(payload, 'breakdown'), false)
  assert.equal(payload.notes, draft.notes)
  assert.equal(payload.paceBasis, draft.paceBasis)
  assert.throws(() => buildGoalPayload({ ...input, scope: 'product', scopeId: 'DevClub', draft: { ...input.draft, clearBreakdown: true } }), /geral/)
  assert.throws(() => buildGoalPayload({ ...input, draft: { ...input.draft, clearBreakdown: true, breakdown: emptyGoalBreakdown() } }), /divisão/)
})
