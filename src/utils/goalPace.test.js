import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateGoalPace, monthBounds } from './goalPace.js'

const sources = [{ kind: 'sale', status: 'ready', id: 'guru' }]
const plan = { product: 'all', metric: 'operational', target: 30000, superTarget: 35000, ultraTarget: 40000, paceBasis: 'calendar' }
const records = [{ kind: 'sale', family: 'DevClub', date: '2026-06-01T15:00:00Z', revenue: 4000, gross: 4500, net: 4000, quantity: 1 }, { kind: 'sale', family: 'MBA', date: '2026-06-10T15:00:00Z', revenue: 8000, gross: 8500, net: null, quantity: 2 }]
const run = (options = {}) => calculateGoalPace({ year: 2026, month: 6, plan, records, sources, today: '2026-06-15', ...options })

test('pace calendário calcula esperado, diferença, projeção e necessário por dia', () => {
  const result = run()
  assert.equal(result.actual, 12000)
  assert.equal(result.expected, 15000)
  assert.equal(result.pacePercent, 80)
  assert.equal(result.delta, -3000)
  assert.equal(result.projection, 24000)
  assert.equal(result.requiredPerDay, 1200)
  assert.equal(result.attainment, 40)
  assert.equal(result.definitive, true)
})

test('meses futuros não apresentam zero pace nem projeção', () => {
  const result = run({ today: '2026-05-31' })
  assert.equal(result.future, true)
  assert.equal(result.expected, 0)
  assert.equal(result.pacePercent, null)
  assert.equal(result.projection, null)
  assert.ok(result.rows.every((row) => row.actual === null))
})

test('mês encerrado usa realizado final e não divide por zero dias restantes', () => {
  const result = run({ today: '2026-07-01' })
  assert.equal(result.ended, true)
  assert.equal(result.expected, 30000)
  assert.equal(result.remainingDays, 0)
  assert.equal(result.projection, 12000)
  assert.equal(result.requiredPerDay, null)
})

test('meta zero e meta ausente não inventam percentuais', () => {
  for (const target of [0, null, undefined]) {
    const result = run({ plan: { ...plan, target } })
    assert.equal(result.validTarget, false)
    assert.equal(result.pacePercent, null)
    assert.equal(result.attainment, null)
    assert.equal(result.expected, null)
  }
})

test('dias úteis são seg-sex, com curva planejada estável no fim de semana', () => {
  const result = run({ plan: { ...plan, paceBasis: 'business' }, today: '2026-06-07' })
  assert.equal(result.totalDays, 22)
  assert.equal(result.elapsedDays, 5)
  assert.equal(result.rows[5].planned, result.rows[4].planned)
  assert.equal(result.rows[6].dailyTarget, 0)
})

test('meta por família inclui somente o produto selecionado', () => {
  const result = run({ plan: { ...plan, product: 'MBA' } })
  assert.equal(result.actual, 8000)
  assert.equal(result.rows[9].actual, 8000)
})

test('campo financeiro ausente e fonte indisponível tornam pace parcial', () => {
  const missingNet = run({ plan: { ...plan, metric: 'net' } })
  assert.equal(missingNet.actual, 4000)
  assert.equal(missingNet.missingRecords, 1)
  assert.equal(missingNet.definitive, false)
  assert.equal(run({ sources: [...sources, { kind: 'sale', status: 'unavailable' }] }).definitive, false)
  assert.equal(run({ sources: [{ kind: 'sale', status: 'unavailable' }] }).actual, null)
})

test('caixa não usa automaticamente bruto ou líquido como recebido', () => {
  const result = run({ plan: { ...plan, metric: 'cash' } })
  assert.equal(result.actual, null)
  assert.equal(result.pacePercent, null)
  assert.equal(result.missingRecords, 2)
})

test('curva futura permanece ausente e gráfico não distribui vendas sem data', () => {
  const result = run({ records: [...records, { kind: 'sale', revenue: 500, quantity: 1, date: null }] })
  assert.equal(result.actual, 12500)
  assert.equal(result.rows[14].actual, 12000)
  assert.equal(result.unallocated, 500)
  assert.equal(result.unallocatedRecords, 1)
  assert.equal(result.rows[15].actual, null)
})

test('vendas futuras e reembolsos não entram no realizado', () => {
  const result = run({ records: [...records, { kind: 'sale', date: '2026-06-30T15:00:00Z', revenue: 1000 }, { kind: 'refund', date: '2026-06-02', revenue: 500 }] })
  assert.equal(result.actual, 12000)
})

test('quantidade usa contagem da fonte e fevereiro bissexto tem 29 dias', () => {
  assert.equal(run({ plan: { ...plan, metric: 'count', target: 20 } }).actual, 3)
  assert.equal(monthBounds(2028, 2).days, 29)
  assert.throws(() => monthBounds(2026, 13))
})

test('ledger vazio disponível não mascara indisponibilidade de todos os provedores', () => {
  const result = run({ sources: [{ kind: 'sale', status: 'unavailable', id: 'guru' }, { kind: 'sale', status: 'ready', id: 'manual' }], records: [] })
  assert.equal(result.actual, null)
  assert.equal(result.definitive, false)
})
