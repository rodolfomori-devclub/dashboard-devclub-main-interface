import test from 'node:test'
import assert from 'node:assert/strict'
import { rankingAmounts, rankingCash, rankingGross } from '../src/hub/lib/rankingAmounts.ts'

test('ranking separates contract gross from confirmed cash, including an explicit zero', () => {
  const rows = [{ amount: 500, total_sale_value: 1200, real_collected_this_month: 200, cash_collected: 250 },
    { amount: 300, total_sale_value: 700, real_collected_this_month: 0, cash_collected: 300 }]
  assert.deepEqual(rankingAmounts(rows), { gross: 1900, cash: 200, grossPartial: false, cashPartial: false })
  assert.equal(rankingCash({ amount: 300, cash_collected: 0 }), 0)
  assert.equal(rankingCash({ amount: null, cash_collected: null }), null)
  assert.equal(rows[0].amount, 500, 'Displaying both amounts does not rewrite the existing goal basis')
})

test('unknown mirrored cash remains pending instead of turning its legacy zero into collected cash', () => {
  const mirror = { dashboard_ledger_id: 'mirror', dashboard_gross: 1200, dashboard_value: 900, total_sale_value: 900, amount: 0, cash_collected: 0, real_collected_this_month: 0, dashboard_cash_known: false }
  assert.deepEqual(rankingAmounts([mirror]), { gross: 1200, cash: null, grossPartial: false, cashPartial: true })
  assert.deepEqual(rankingAmounts([mirror, { amount: 500, total_sale_value: 1000, cash_collected: 200 }]), { gross: 2200, cash: 200, grossPartial: false, cashPartial: true })
  assert.equal(rankingGross({ ...mirror, dashboard_gross: 0, amount: 500 }), 0)
})

test('mirrors never substitute a historical net value for an unavailable original gross', () => {
  const mirror = { dashboard_ledger_id: 'mirror', dashboard_value: 900, total_sale_value: 900, amount: 500, cash_collected: 500 }
  assert.deepEqual(rankingAmounts([mirror]), { gross: null, cash: 500, grossPartial: true, cashPartial: false })
  assert.equal(rankingGross({ ...mirror, dashboard_gross: 1200 }), 1200)
  assert.equal(rankingGross({ ...mirror, dashboard_gross: null }), null)
  assert.equal(rankingGross({ ...mirror, dashboard_gross: -1 }), null)
  assert.equal(rankingGross({ dashboard_value: 900, total_sale_value: 900 }), null)
})

test('historical gross fallback and empty totals retain established meaning without rounding away cents', () => {
  assert.equal(rankingGross({ total_sale_value: 0, amount: 500.25, future_outstanding_value: 200.10 }), 700.35)
  assert.deepEqual(rankingAmounts([]), { gross: 0, cash: 0, grossPartial: false, cashPartial: false })
  assert.deepEqual(rankingAmounts([{ total_sale_value: 0.1, real_collected_this_month: 0.1 }, { total_sale_value: 0.2, real_collected_this_month: 0.2 }]), { gross: 0.3, cash: 0.3, grossPartial: false, cashPartial: false })
})
