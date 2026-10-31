import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData } from '../src/components/tv/tvData.js'
import { stalePublicTvModel, validPublicPresentation } from '../src/components/tv/publicTvData.js'

test('a stale public response preserves both amounts while marking every displayed metric partial', () => {
  const model = buildTvData({ year: 2026, month: 10, today: '2026-10-15', metric: 'cash',
    directory: { teams: [{ id: 'sales', name: 'Vendas' }], individuals: [{ id: 'ana', name: 'Ana', teamId: 'sales' }] },
    plans: [{ scope: 'team', scopeId: 'sales', metric: 'cash', target: 5000 }, { scope: 'product', scopeId: 'MBA', metric: 'cash', target: 5000 }],
    sales: { records: [{ id: 'tmb-1', sourceId: 'tmb', platform: 'TMB', kind: 'sale', quantity: 1,
      date: '2026-10-15T14:00:00Z', gross: 1000, payment: 'Boleto', family: 'MBA', sellerId: 'ana' }],
    sources: [{ id: 'tmb', kind: 'sale', status: 'ready' }] } })
  const stale = stalePublicTvModel(model)
  assert.equal(stale.overview.gross, 1000)
  assert.equal(stale.overview.cash, 400)
  assert.equal(stale.sellers[0].gross, 1000)
  assert.equal(stale.sellers[0].cash, 400)
  for (const row of [stale.totals, stale.overview, stale.pace, stale.daily, ...stale.daily.hours,
    ...stale.daily.payments, ...stale.daily.sellers, stale.daily.unassignedSeller,
    ...stale.teamGoals, ...stale.productGoals, ...stale.sellers, ...stale.products, ...stale.payments, ...Object.values(stale.unassigned)]) {
    assert.equal(row.grossPartial, true)
    assert.equal(row.cashPartial, true)
  }
  assert.equal(model.totals.grossPartial, false, 'original cached response is not mutated')
  assert.equal(model.totals.cashPartial, false)
  assert.equal(stalePublicTvModel(null), null)
})

test('public daily scenes accept their own projected fields without requiring unrelated scenes', () => {
  const required = { daily: { hours: [] }, 'daily-cash': { hours: [] }, 'daily-payments': { payments: [] }, 'daily-sellers': { sellers: [], unassignedSeller: {} } }
  for (const [id, daily] of Object.entries(required)) {
    const value = { revision: 0, settings: { version: 1, mode: 'fixed', metric: 'gross', theme: 'dark', fixedPanel: id,
      panels: [{ id, enabled: true, durationSeconds: 20 }] }, model: { totals: {}, unit: 'currency', daily } }
    assert.equal(validPublicPresentation(value), true, `${id}: accepts sparse daily projection`)
    assert.equal(validPublicPresentation({ ...value, model: { ...value.model, daily: {} } }), false, `${id}: rejects missing required data`)
    const stale = stalePublicTvModel(value.model)
    assert.deepEqual(Object.keys(stale.daily).filter(key => ['hours', 'payments', 'sellers', 'unassignedSeller'].includes(key)), Object.keys(daily), 'stale marking preserves sparse projection')
  }
})


test('public weekly scenes validate and mark stale only their own projected aggregate fields', () => {
  const metrics = { gross: 1200, cash: 480, grossPartial: false, cashPartial: false, partial: false }
  const required = { weekly: { days: [{ date: '2026-10-26', ...metrics }] }, 'weekly-cash': { days: [{ date: '2026-10-26', ...metrics }] }, 'weekly-payments': { payments: [{ id: 'boleto', ...metrics }] }, 'weekly-sellers': { sellers: [{ id: 'ana', ...metrics }], unassignedSeller: metrics } }
  for (const [id, fields] of Object.entries(required)) {
    const weekly = { startDate: '2026-10-26', endDate: '2026-10-27', ...metrics, ...fields }
    const value = { revision: 1, settings: { version: 1, mode: 'fixed', metric: 'gross', theme: 'dark', fixedPanel: id,
      panels: [{ id, enabled: true, durationSeconds: 20 }] }, model: { totals: {}, unit: 'currency', weekly } }
    assert.equal(validPublicPresentation(value), true, `${id}: accepts sparse weekly projection`)
    assert.equal(validPublicPresentation({ ...value, model: { ...value.model, weekly: {} } }), false, `${id}: rejects missing required data`)
    const stale = stalePublicTvModel(value.model)
    assert.equal(stale.weekly.gross, 1200)
    assert.equal(stale.weekly.cash, 480)
    assert.equal(stale.weekly.startDate, '2026-10-26')
    assert.equal(stale.weekly.endDate, '2026-10-27')
    assert.deepEqual(Object.keys(stale.weekly).filter(key => ['days', 'payments', 'sellers', 'unassignedSeller'].includes(key)), Object.keys(fields))
    for (const row of [stale.weekly, ...(stale.weekly.days || []), ...(stale.weekly.payments || []), ...(stale.weekly.sellers || []), ...(stale.weekly.unassignedSeller ? [stale.weekly.unassignedSeller] : [])]) {
      assert.equal(row.grossPartial, true)
      assert.equal(row.cashPartial, true)
      assert.equal(row.partial, true)
    }
    assert.equal(weekly.grossPartial, false, 'cached response is not mutated')
  }
})
