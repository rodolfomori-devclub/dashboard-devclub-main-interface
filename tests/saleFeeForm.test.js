import test from 'node:test'
import assert from 'node:assert/strict'
import { changesPast, dayLabel, defaultPreviewRange, draftFromSchedule, moneyValue, percentInput, percentValue, placeSchedule, ruleLabel, scheduleFromDraft } from '../src/components/admin/saleFeeForm.js'

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
  const list = placeSchedule([schedule('2026-01-01'), schedule('2025-10-01')], { ...schedule('2026-01-01'), activeScenario: 'reneg' }, '2026-01-01').schedules
  assert.deepEqual(list.map(item => [item.effectiveFrom, item.activeScenario]), [['2025-10-01', 'atual'], ['2026-01-01', 'reneg']])
  assert.equal(ruleLabel('pagarme.card.12'), 'Pagar.me · cartão 12x')
  assert.equal(ruleLabel('legacy:installments'), 'Regra anterior · parcelas sem taxa na tabela')
})

test('editing a start date moves the schedule, and a date taken by another schedule is refused', () => {
  const moved = placeSchedule([schedule('2025-10-01'), schedule('2026-01-01')], schedule('2026-02-01'), '2026-01-01')
  assert.deepEqual(moved.schedules.map(item => item.effectiveFrom), ['2025-10-01', '2026-02-01'])
  assert.match(placeSchedule([schedule('2025-10-01'), schedule('2026-01-01')], schedule('2025-10-01'), '2026-01-01').error, /01\/10\/2025/)
  assert.match(placeSchedule([schedule('2025-10-01')], schedule('2025-10-01')).error, /01\/10\/2025/, 'a new schedule never replaces one silently')
})

test('saving asks for confirmation only when some day before today would be priced differently', () => {
  const today = '2026-11-25'
  const reordered = ({ effectiveFrom, activeScenario, scenarios, tmb }) => ({ tmb, scenarios, activeScenario, effectiveFrom })
  assert.equal(changesPast([], [schedule('2025-10-01')], today), true, 'adding a past schedule')
  assert.equal(changesPast([schedule('2026-11-01')], [], today), true, 'removing a past schedule or emptying the table')
  assert.equal(changesPast([schedule('2025-10-01')], [{ ...schedule('2025-10-01'), activeScenario: 'reneg' }], today), true, 'changing a schedule in force before today')
  assert.equal(changesPast([schedule('2025-10-01')], [schedule('2025-11-01')], today), true, 'moving a start date in the past')
  assert.equal(changesPast([schedule('2025-10-01')], [schedule('2025-10-01'), schedule('2026-12-01')], today), false, 'adding only a future schedule')
  assert.equal(changesPast([schedule('2025-10-01'), schedule('2026-12-01')], [schedule('2025-10-01'), { ...schedule('2026-12-01'), tmb: { cashRate: 0.35 } }], today), false, 'changing only a future schedule')
  assert.equal(changesPast([schedule('2025-10-01')], [reordered(schedule('2025-10-01'))], today), false, 'the same terms rebuilt by the editor')
  assert.equal(changesPast([], [schedule(today)], today), false, 'a schedule from today changes no day before today')
  const reneg = { id: 'reneg', label: 'RENEG', pagarme: { card: [0.0311, 0.1198], pix: { rate: 0.005, fixed: 0.44 }, boleto: { rate: 0, fixed: 2.99 } } }
  const both = (rate = 0.1198) => ({ ...schedule('2025-10-01'), scenarios: [schedule().scenarios[0], { ...reneg, pagarme: { ...reneg.pagarme, card: [0.0311, rate] } }] })
  assert.equal(changesPast([both()], [both(0.121)], today), false, 'an inactive scenario prices no sale')
  assert.equal(changesPast([both()], [{ ...both(), activeScenario: 'reneg' }], today), true, 'switching the active scenario does')
})

test('the default impact preview fits the 366 days the API accepts and dates show the Brasília day', () => {
  assert.deepEqual(defaultPreviewRange('2026-11-25'), { startDate: '2025-12-01', endDate: '2026-11-25' })
  assert.deepEqual(defaultPreviewRange('2026-01-31'), { startDate: '2025-02-01', endDate: '2026-01-31' })
  for (const today of ['2026-11-25', '2028-12-31', '2026-03-01', '2027-02-28', '2026-12-31']) {
    const { startDate, endDate } = defaultPreviewRange(today)
    assert.ok((Date.parse(endDate) - Date.parse(startDate)) / 86400000 <= 366, today)
  }
  assert.equal(dayLabel('2026-11-26T01:30:00.000Z'), '25/11/2026', 'a save at 22:30 in Brasília')
  assert.equal(dayLabel('2025-10-01'), '01/10/2025')
  assert.equal(dayLabel(null), '—')
})
