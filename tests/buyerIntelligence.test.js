import test from 'node:test'
import assert from 'node:assert/strict'
import { count, percentage, validPeriod, oraculoBuyersUrl } from '../src/components/buyers/buyerIntelligence.js'

test('missing or empty denominators never manufacture a conversion percentage', () => {
  for (const denominator of [0, null, undefined, -1]) assert.equal(percentage(0, denominator), '—')
  assert.equal(percentage(2, 4), '50%')
  assert.equal(percentage(0, 4), '0%')
  assert.equal(percentage(5, 4), '—')
  assert.equal(count(null), '—')
  assert.equal(count(0), '0')
})
test('periods respect the available historical scope, real dates and the current cutoff', () => {
  assert.equal(validPeriod({ dateFrom: '2024-01-01', dateTo: '2026-10-23' }, '2026-10-23'), true)
  for (const period of [{ dateFrom: '2023-12-31', dateTo: '2026-10-23' }, { dateFrom: '2024-02-30', dateTo: '2026-10-23' }, { dateFrom: '2026-10-24', dateTo: '2026-10-23' }, { dateFrom: '2024-01-01', dateTo: '2026-10-24' }]) assert.equal(validPeriod(period, '2026-10-23'), false)
})
test('profile navigation contains only the public Oraculo destination, with no credentials', () => {
  assert.equal(oraculoBuyersUrl('https://oraculo.example.test/'), 'https://oraculo.example.test/compradores')
  for (const value of [null, '', 'javascript:alert(1)', 'http://oraculo.example.test', 'https://user:password@oraculo.example.test', 'https://oraculo.example.test/?token=secret']) assert.equal(oraculoBuyersUrl(value), null)
})
