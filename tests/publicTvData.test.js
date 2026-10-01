import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData } from '../src/components/tv/tvData.js'
import { stalePublicTvModel } from '../src/components/tv/publicTvData.js'

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
    ...stale.teamGoals, ...stale.productGoals, ...stale.sellers, ...stale.products, ...stale.payments, ...Object.values(stale.unassigned)]) {
    assert.equal(row.grossPartial, true)
    assert.equal(row.cashPartial, true)
  }
  assert.equal(model.totals.grossPartial, false, 'original cached response is not mutated')
  assert.equal(model.totals.cashPartial, false)
  assert.equal(stalePublicTvModel(null), null)
})
