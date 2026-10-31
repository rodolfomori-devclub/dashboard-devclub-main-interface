import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTvData } from '../src/components/tv/tvData.js'
import { TV_CELEBRATION_LIMIT, TV_CELEBRATION_SOURCES } from '../src/components/tv/tvCelebrations.js'
import { normalizeSource } from '../src/utils/salesData.js'

const today = '2026-10-15'
const source = (id, extra = {}) => ({ id, kind: 'sale', status: 'ready',
  snapshots: [{ startDate: today, endDate: today, status: 'ready', salesAvailable: true, complete: true }], ...extra })
const sale = (externalId, extra = {}) => ({ id: `hotmart:display-${externalId}`, externalId, sourceId: 'hotmart', kind: 'sale',
  quantity: 1, date: `${today}T15:00:00Z`, gross: 300, net: 277.88, sellerId: 'ana', ...extra })
const directory = { teams: [], individuals: [{ id: 'ana', name: 'Ana' }, { id: 'excluded', name: 'Head', excludedFromRanking: true }] }
const run = (records, overrides = {}) => buildTvData({ year: 2026, month: 10, today, directory,
  sales: { records, sources: ['hotmart', 'guru', 'tmb', 'manual'].map(id => source(id)), operationsStatus: 'ready', ...overrides.sales },
  ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'sales')) }).celebrations
const group = (feed, id = 'hotmart') => feed.groups.find(item => item.source === id)

test('real sale feed uses stable provider identity, sales-value policy and only verified eligible seller names', () => {
  const records = [sale('first', { sellerName: 'Wrong raw name', buyerEmail: 'private@example.test', utm: { source: 'private' } }),
    sale('second', { sellerId: null, sellerName: 'Ana' }), sale('third', { sellerId: 'excluded' }),
    sale('fourth', { sellerId: 'missing', sellerName: 'Unverified' }),
    sale('tmb', { sourceId: 'tmb', gross: 1000, net: 900 })]
  const feed = run(records)
  assert.equal(feed.day, today)
  assert.equal(feed.groups.length, TV_CELEBRATION_SOURCES.length)
  assert.equal(group(feed).ready, true)
  assert.equal(group(feed).events.length, 4)
  const first = group(feed).events.find(event => event.id.includes('first'))
  assert.deepEqual(first, { id: '["hotmart","first"]', occurredAt: `${today}T15:00:00.000Z`, amount: 277.88, sellerName: 'Ana' })
  assert.ok(group(feed).events.filter(event => event !== first).every(event => !Object.hasOwn(event, 'sellerName')))
  assert.equal(group(feed, 'tmb').events[0].amount, 1000)
  const cashFeed = run(records, { metric: 'cash' })
  assert.deepEqual(cashFeed, feed, 'Changing the TV indicator cannot create or change sale identities/amounts')
  assert.equal(JSON.stringify(feed).includes('private@example.test'), false)
})

test('refunds, cancellations, invoices, aggregate residuals, unstable IDs and linked manuals never become sale events', () => {
  const records = [sale('valid'), sale('cancelled', { original: { status_pedido: 'Cancelado' } }),
    sale('refunded'), sale('refunded', { sourceId: 'hotmartRefunds', kind: 'refund' }),
    sale('invoice', { isReceipt: true }), sale('aggregate', { isAggregate: true, quantity: 3 }),
    sale(null), sale('unknown', { net: null }), sale('free', { net: 0 }), sale('negative', { net: -5 }),
    sale('two', { quantity: 2 }), sale('linked', { sourceId: 'manual', isManual: true, original: { linkedExternalId: 'valid' } })]
  const feed = run(records)
  assert.deepEqual(group(feed).events.map(event => event.id), ['["hotmart","valid"]'])
  assert.deepEqual(group(feed, 'manual').events, [])
})

test('current-day source health, directory and fresh ledger are mandatory, and recovery provides a fresh baseline', () => {
  const records = [sale('one')]
  for (const badSource of [source('hotmart', { status: 'unavailable' }),
    source('hotmart', { snapshots: [] }), source('hotmart', { salesAvailable: false }),
    source('hotmart', { snapshots: [{ startDate: '2026-10-01', endDate: '2026-10-14', status: 'ready' }] }),
    source('hotmart', { snapshots: [{ startDate: today, endDate: today, status: 'stale', salesAvailable: true }] }),
    source('hotmart', { snapshots: [{ startDate: today, endDate: today, status: 'ready', salesAvailable: false }] }),
  ]) assert.deepEqual(group(run(records, { sales: { sources: [badSource] } })), { source: 'hotmart', ready: false, refreshing: false, events: [] })
  for (const overrides of [{ directoryError: true }, { directory: {} }, { salesError: true }, { month: 9 },
    { sales: { operationsStatus: 'unavailable' } }, { sales: { operationsStatus: undefined } }]) {
    assert.ok(run(records, overrides).groups.every(item => !item.ready && item.events.length === 0))
  }
  const recovered = run([...records, sale('new')])
  assert.equal(group(recovered).ready, true)
  assert.equal(group(recovered).events.length, 2, 'Consumers baseline recovery, then compare later healthy snapshots')
  const partialHistory = run(records, { sales: { sources: [source('hotmart', { status: 'partial', snapshots: [
    { startDate: '2026-10-01', endDate: '2026-10-14', status: 'unavailable', salesAvailable: false, complete: false },
    ...source('hotmart').snapshots,
  ] })] } })
  assert.equal(group(partialHistory).ready, true, 'Unavailable history never silences a complete current-day slice')
  assert.equal(group(partialHistory).events.length, 1)
})

test('date-only/manual synthetic times are baseline-only, while exact timestamps use Brasília day boundaries', () => {
  const feed = run([sale('late', { date: '2026-10-16T02:59:59Z' }), sale('tomorrow', { date: '2026-10-16T03:00:00Z' }),
    sale('yesterday', { date: '2026-10-15T02:59:59Z' }), sale('date-only', { hasExactTime: false }),
    sale('original-date-only', { original: { orderDate: today } }),
    sale('manual', { sourceId: 'manual', isManual: true, original: { date: today } })])
  assert.equal(group(feed).events.length, 3)
  assert.equal(group(feed).events.filter(event => event.occurredAt === null).length, 2)
  assert.equal(group(feed).events.find(event => event.occurredAt)?.occurredAt, '2026-10-16T02:59:59.000Z')
  assert.equal(group(feed, 'manual').events[0].occurredAt, null)
})

test('feed deduplicates stable provider IDs and remains ready after a busy day, retaining only the newest bounded window', () => {
  const records = Array.from({ length: 240 }, (_, index) => sale(`sale-${index}`, {
    date: new Date(Date.parse(`${today}T12:00:00Z`) + index * 1000).toISOString() }))
  const feed = run([...records, { ...records.at(-1), id: 'changed-display-index' }])
  assert.equal(group(feed).ready, true)
  assert.equal(group(feed).events.length, TV_CELEBRATION_LIMIT)
  assert.equal(group(feed).events[0].id, '["hotmart","sale-40"]')
  assert.equal(group(feed).events.at(-1).id, '["hotmart","sale-239"]')
})

test('native TMB display IDs may change without changing celebration identity, and date-only raw snapshots stay silent', () => {
  const raw = { id: 'display-index-1', raw: { pedido_id: 123 }, product: 'MBA', value: 1000,
    timestamp: today, date: { original: today } }
  const records = normalizeSource('tmb', { success: true, data: [raw] })
  const first = group(run(records), 'tmb').events[0]
  const renamed = normalizeSource('tmb', { success: true, data: [{ ...raw, id: 'display-index-999' }] })
  assert.deepEqual(group(run(renamed), 'tmb').events[0], first)
  assert.equal(first.id, '["tmb","123"]')
  assert.equal(first.occurredAt, null)
})

test('a recent healthy TTL refresh preserves the baseline without emitting, while failures or old cached payloads reset it', () => {
  const initial = run([sale('old')])
  assert.equal(group(initial).ready, true)
  const snapshot = { startDate: today, endDate: today, status: 'stale', salesAvailable: true,
    complete: true, refreshing: true, error: null, fetchedAt: `${today}T15:00:00Z` }
  const refreshing = (changes = {}, overrides = {}) => run([sale('old')], { sales: { fetchedAt: Date.parse(`${today}T15:01:01Z`),
    sources: [source('hotmart', { status: 'partial', snapshots: [{ ...snapshot, ...changes }] })] }, ...overrides })
  assert.deepEqual(group(refreshing()), { source: 'hotmart', ready: false, refreshing: true, events: [] })
  for (const change of [{ error: 'provider_unavailable' }, { complete: false }, { refreshing: false }, { status: 'unavailable' },
    { fetchedAt: `${today}T14:00:00Z` }, { fetchedAt: null }]) {
    assert.equal(group(refreshing(change)).refreshing, false)
  }
  assert.equal(group(refreshing({}, { salesError: true })).refreshing, false)
  const fresh = run([sale('old'), sale('new', { date: `${today}T15:01:05Z` })])
  assert.equal(group(fresh).ready, true)
  assert.equal(group(fresh).refreshing, false)
  assert.equal(group(fresh).events.length, 2)
  assert.equal(group(fresh).events[0].id, group(initial).events[0].id)
})
