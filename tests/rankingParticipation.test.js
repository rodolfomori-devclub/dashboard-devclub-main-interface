import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareGoalData } from '../src/utils/goalData.js'
import { calculateGoalPace } from '../src/utils/goalPace.js'
import { goalScopeTargets } from '../src/components/goals/goalConfig.js'
import { buildTvData } from '../src/components/tv/tvData.js'
import { filterVisibleProfiles, filterVisibleSales } from '../src/hub/lib/hiddenUsers.ts'

const date = '2026-10-01'
const sources = ['guru', 'hotmart', 'tmb', 'asaas'].map(id => ({ id, kind: 'sale', status: 'ready' }))
const row = (id, extra = {}) => ({ id, kind: 'sale', sourceId: 'guru', sellerId: 'seller', family: 'MBA',
  date, gross: 100, net: 90, revenue: 90, quantity: 1, payment: 'Cartão', ...extra })
const records = [row('regular'), row('head-guru', { sellerId: 'head', gross: 1000, net: 900, revenue: 900 }),
  row('head-tmb', { sellerId: 'head', sourceId: 'tmb', gross: 2000, net: 1800, revenue: 2000, received: 9999, payment: 'Boleto' }),
  row('head-asaas', { sellerId: 'head', sourceId: 'asaas', gross: 3000, net: 2900, revenue: 3000, received: 150 }),
  row('receipt', { sellerId: 'head', kind: 'receipt', isReceipt: true, sourceId: 'asaas', gross: 9000, net: 9000, received: 9000 })]
const directory = { individuals: [{ id: 'seller', name: 'Vendedor', teamId: 'team' },
  { id: 'head', name: 'Head', teamId: 'team', excludedFromRanking: true }], teams: [{ id: 'team', name: 'Comercial' }] }
const prepare = (people = directory, sales = records) => prepareGoalData({ records: sales, sources }, people)
const pace = (scope, scopeId, metric, people = directory, sales = records) => calculateGoalPace({ year: 2026, month: 10, today: date,
  ...prepare(people, sales), plan: { scope, scopeId, metric, target: 10000 } })
const tv = (overrides = {}) => buildTvData({ year: 2026, month: 10, today: date, directory,
  sales: { records, sources }, plans: [
    { scope: 'individual', scopeId: 'head', metric: 'gross', target: 10000 },
    { scope: 'individual', scopeId: 'seller', metric: 'gross', target: 10000 },
    { scope: 'team', scopeId: 'team', metric: 'gross', target: 10000 },
  ], ...overrides })

test('excluding a person keeps company/product amounts across every metric and removes only people performance', () => {
  for (const [metric, total, participant] of [['gross', 6100, 100], ['cash', 1940, 90], ['net', 5690, 90], ['operational', 5990, 90], ['count', 4, 1]]) {
    for (const [scope, id] of [['overall', ''], ['product', 'MBA']]) assert.equal(pace(scope, id, metric).actual, total, `${scope}:${metric}`)
    for (const [scope, id] of [['team', 'team'], ['individual', 'seller']]) {
      const result = pace(scope, id, metric)
      assert.equal(result.actual, participant, `${scope}:${metric}`)
      assert.equal(result.unassignedRecords, 0)
      assert.equal(result.definitive, true)
    }
    const excluded = pace('individual', 'head', metric)
    assert.equal(excluded.actual, null)
    assert.equal(excluded.attainment, null)
    assert.equal(excluded.definitive, false)
    assert.equal(excluded.scopeExcluded, true)
    assert.ok(excluded.rows.every(row => row.actual === null))
  }
  const data = prepare()
  assert.equal(data.records.length, records.length)
  assert.equal(data.records.find(row => row.id === 'head-tmb').sellerId, 'head')
  assert.equal(data.records.find(row => row.id === 'head-tmb').teamId, 'team')
  assert.equal(data.records.find(row => row.id === 'head-tmb').received, 800)
})

test('excluded people without a team do not turn into unassigned sales; real unknown sellers remain explicit', () => {
  const people = { ...directory, individuals: directory.individuals.map(person => person.id === 'head' ? { ...person, teamId: null } : person) }
  const sales = [...records, row('unassigned', { sellerId: null, gross: 77 })]
  const result = pace('team', 'team', 'gross', people, sales)
  assert.equal(result.unassignedRecords, 1)
  assert.equal(result.unassignedValue, 77)
  const model = tv({ directory: people, sales: { records: sales, sources } })
  assert.equal(model.unassigned.team.value, 77)
  assert.equal(model.unassigned.seller.value, 77)
  assert.deepEqual(model.sellers.map(row => row.id), ['seller'])
  assert.equal(model.products[0].value, 6177)
})

test('TV rankings and historical goals follow dynamic participation, preserving all company panels', () => {
  const excluded = tv({ paceScope: 'individual', paceScopeId: 'head' })
  assert.deepEqual(excluded.sellers.map(row => row.id), ['seller'])
  assert.deepEqual(excluded.individualGoals.map(row => row.id), ['seller'])
  assert.deepEqual(excluded.directory.individuals.map(row => row.id), ['seller'])
  assert.equal(excluded.teamGoals[0].pace.actual, 100)
  assert.equal(excluded.pace.actual, null)
  assert.equal(excluded.pace.scopeExcluded, true)
  const reincluded = { ...directory, individuals: directory.individuals.map(person => ({ ...person, excludedFromRanking: false })) }
  const included = tv({ directory: reincluded, paceScope: 'individual', paceScopeId: 'head' })
  assert.equal(included.pace.actual, 6000)
  assert.equal(included.teamGoals[0].pace.actual, 6100)
  assert.deepEqual(included.sellers.map(row => row.id), ['head', 'seller'])
  assert.equal(included.individualGoals.length, 2)
  assert.deepEqual(included.totals, excluded.totals)
  assert.deepEqual(included.payments, excluded.payments)
  assert.deepEqual(included.daily, excluded.daily)
  assert.deepEqual(included.products, excluded.products)
})

test('goal configuration hides excluded new destinations but keeps existing history manageable', () => {
  const existing = [{ scope: 'individual', scopeId: 'head', metric: 'gross', target: 10000 }]
  assert.deepEqual(goalScopeTargets('individual', directory).map(person => person.id), ['seller'])
  const historical = goalScopeTargets('individual', directory, existing).find(person => person.id === 'head')
  assert.equal(historical.active, true)
  assert.equal(historical.excludedFromRanking, true)
  assert.equal(existing[0].target, 10000)
})

test('legacy profile/sales filters use settings, not a hardcoded identity or team substitution', () => {
  const previousHidden = '23465326-f6b5-4baf-8778-c10df7375028'
  const profiles = [{ id: previousHidden, excludedFromRanking: false }, { id: 'head', excludedFromRanking: true }, { id: 'seller' }]
  assert.deepEqual(filterVisibleProfiles(profiles).map(person => person.id), [previousHidden, 'seller'])
  const sales = [{ seller_id: previousHidden }, { seller_id: 'head' }, { seller_id: 'seller' }, { seller_id: null }]
  assert.deepEqual(filterVisibleSales(sales, profiles).map(sale => sale.seller_id), [previousHidden, 'seller', null])
  assert.equal(filterVisibleSales(sales, profiles.map(person => ({ ...person, excludedFromRanking: false }))).length, 4)
})
