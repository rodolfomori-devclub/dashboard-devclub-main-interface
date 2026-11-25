import test from 'node:test'
import assert from 'node:assert/strict'
import { draftFromSchedule, moneyValue, percentInput, percentValue, ruleLabel, scheduleFromDraft, withSchedule } from '../src/components/admin/saleFeeForm.js'

const schedule = (effectiveFrom = '2025-10-01') => ({ effectiveFrom, activeScenario: 'atual', tmb: { cashRate: 0.4 },
  scenarios: [{ id: 'atual', label: 'ATUAL', pagarme: { card: [0.0322, 0.1222], pix: { rate: 0.005, fixed: 0.44 }, boleto: { rate: 0, fixed: 2.99 } } }] })

test('percentages and reais typed in pt-BR become exact API values and back', () => {
  assert.deepEqual(['12,22', '3,22', '0,5', '40', '12.22', '0,0001'].map(percentValue), [0.1222, 0.0322, 0.005, 0.4, 0.1222, 0.000001])
  assert.deepEqual(['', '100', '12,345678', 'abc', '-1', '1,2,3'].map(percentValue), [null, null, null, null, null, null])
  assert.deepEqual(['0,44', '2,99', '1000'].map(moneyValue), [0.44, 2.99, 1000])
  assert.deepEqual(['1000,01', '0,444', 'x'].map(moneyValue), [null, null, null])
  assert.deepEqual([0.1222, 0.4, 0.005, 0.000001].map(percentInput), ['12,22', '40', '0,5', '0,0001'])
})

test('a schedule survives the editor unchanged and invalid fields are named instead of guessed', () => {
  assert.deepEqual(scheduleFromDraft(draftFromSchedule(schedule())), { schedule: schedule() })
  const broken = draftFromSchedule(schedule())
  broken.scenarios[0].card[1] = '12,3456789'
  assert.match(scheduleFromDraft(broken).error, /2x/)
  assert.match(scheduleFromDraft({ ...draftFromSchedule(schedule()), tmbCashRate: '0' }).error, /TMB/)
  assert.match(scheduleFromDraft({ ...draftFromSchedule(schedule()), effectiveFrom: '' }).error, /data/)
})

test('one schedule per start date, kept in date order, with readable rule names', () => {
  const list = withSchedule([schedule('2026-01-01'), schedule('2025-10-01')], { ...schedule('2026-01-01'), activeScenario: 'reneg' })
  assert.deepEqual(list.map(item => [item.effectiveFrom, item.activeScenario]), [['2025-10-01', 'atual'], ['2026-01-01', 'reneg']])
  assert.equal(ruleLabel('pagarme.card.12'), 'Pagar.me · cartão 12x')
  assert.equal(ruleLabel('legacy:installments'), 'Regra anterior · parcelas sem taxa na tabela')
})
