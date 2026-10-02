import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeHubSaleValue, hubNetSaleValue, summarizeHubSaleValues, formatHubFinancial, hubFinancialNote } from '../src/hub/lib/saleValuePolicy.ts'
import { rankingAmounts } from '../src/hub/lib/rankingAmounts.ts'
import { getCashCollected, getPendingValue } from '../src/hub/lib/utils.ts'

test('Hub reports, sales totals, ranking and cash use the authorized net without another fee deduction', () => {
  for (const platform of ['Guru', 'Hotmart', ' HOTMART ']) {
    const raw = { platform, dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true,
      dashboard_gross: 1877.18, dashboard_value: 1997, total_sale_value: 2397.24,
      amount: 1997, cash_collected: 1997, real_collected_this_month: 1997,
      pending_future_value: 500, future_outstanding_value: 300 }
    const sale = normalizeHubSaleValue(raw)
    for (const field of ['amount', 'total_sale_value', 'dashboard_value', 'dashboard_gross', 'cash_collected', 'real_collected_this_month']) assert.equal(sale[field], 1877.18)
    assert.equal(getCashCollected(sale), 1877.18)
    assert.equal(getPendingValue(sale), 0)
    assert.deepEqual(rankingAmounts([sale]), { gross: 1877.18, cash: 1877.18, grossPartial: false, cashPartial: false })
    assert.deepEqual(normalizeHubSaleValue(sale), sale, 'reapplying the rule never subtracts another fee')
    assert.equal(raw.total_sale_value, 2397.24, 'raw input is not mutated')
  }
})

test('stale platform gross and unknown net never become a valid Hub sale value', () => {
  for (const extra of [{}, { dashboard_financial_policy: 'net_after_fees', dashboard_net_known: false },
    { dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true, dashboard_gross: null }]) {
    const sale = normalizeHubSaleValue({ platform: 'Hotmart', dashboard_ledger_id: 'old-mirror',
      dashboard_gross: 2397.24, total_sale_value: 2397.24, amount: 1997, cash_collected: 1997, ...extra })
    assert.equal(hubNetSaleValue(sale), null)
    assert.equal(sale.total_sale_value, null)
    assert.equal(sale.amount, null)
    assert.equal(sale.dashboard_cash_known, false)
    assert.deepEqual(rankingAmounts([sale]), { gross: null, cash: null, grossPartial: true, cashPartial: true })
  }
})

test('known zero stays zero and other platform contracts/cash remain unchanged', () => {
  const zero = normalizeHubSaleValue({ platform: 'Guru', dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true, dashboard_gross: 0, amount: 1997 })
  assert.equal(zero.amount, 0)
  assert.equal(zero.dashboard_net_known, true)
  const tmb = { platform: 'TMB', total_sale_value: 3000, amount: 1200, cash_collected: 1200 }
  assert.equal(normalizeHubSaleValue(tmb), tmb)
  assert.deepEqual(rankingAmounts([tmb]), { gross: 3000, cash: 1200, grossPartial: false, cashPartial: false })
})

test('legacy reports retain known subtotal and visibly mark missing digital net as partial', () => {
  const rows = [{ platform: 'Hotmart', dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true, dashboard_gross: 1877.18, amount: 1997 },
    { platform: 'Guru', amount: 1997 }, { platform: 'Asaas', amount: 200, total_sale_value: 2000 }]
  const summary = summarizeHubSaleValues(rows)
  assert.ok(Math.abs(summary.value - 2077.18) < .00001)
  assert.deepEqual([summary.knownCount, summary.unknownNetCount, summary.partial], [2, 1, true])
  assert.equal(formatHubFinancial(summary.value, summary, value => value.toFixed(2)), '2077.18 · Parcial')
  assert.match(hubFinancialNote(summary), /1 venda de Guru\/Hotmart sem líquido informado/)
})

test('fully unknown report is not displayed as zero while explicit digital zero and empty report remain valid', () => {
  const unknown = summarizeHubSaleValues([{ platform: 'Guru', amount: 1997 }, { platform: 'Hotmart', amount: 1997 }])
  assert.equal(unknown.value, null)
  assert.equal(formatHubFinancial(unknown.subtotal, unknown, String), 'Não informado')
  const zero = summarizeHubSaleValues([{ platform: 'Guru', dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true, dashboard_gross: 0 }])
  assert.deepEqual(zero, { subtotal: 0, value: 0, knownCount: 1, unknownNetCount: 0, partial: false })
  assert.equal(formatHubFinancial(zero.value, zero, String), '0')
  assert.deepEqual(summarizeHubSaleValues([]), { subtotal: 0, value: 0, knownCount: 0, unknownNetCount: 0, partial: false })
})

test('report-specific other-platform calculation is preserved and cannot replace authoritative digital net', () => {
  const visited = []
  const summary = summarizeHubSaleValues([{ platform: 'TMB', amount: 1200, total_sale_value: 3000 },
    { platform: 'Hotmart', dashboard_financial_policy: 'net_after_fees', dashboard_net_known: true, dashboard_gross: 1877.18, total_sale_value: 1997 }], sale => {
    visited.push(sale.platform)
    return sale.total_sale_value * .4
  })
  assert.deepEqual(visited, ['TMB'])
  assert.ok(Math.abs(summary.value - 3077.18) < .00001)
  assert.equal(summary.partial, false)
})
