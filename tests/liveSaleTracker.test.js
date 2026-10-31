import test from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { createTvSaleTracker } from '../src/components/tv/celebration/liveSaleTracker.js'
import { tvLightCelebrationSource } from '../src/lib/tvLightBuild.js'

const opened = Date.parse('2026-10-19T15:00:00Z')
const sale = (id, delta = 1000, extra = {}) => ({ id, occurredAt: new Date(opened + delta).toISOString(), amount: 1297, sellerName: 'Ana', ...extra })
const feed = (events, extra = {}) => ({ day: '2026-10-19', groups: [{ source: 'guru', ready: true, events, ...extra }] })
const versions = [['React', createTvSaleTracker], ['Light', () => {
  const context = { window: {} }; runInNewContext(tvLightCelebrationSource(), context)
  return context.window.createTvSaleTracker()
}]]

for (const [name, create] of versions) {
  test(`${name}: a normal cache refresh preserves the baseline, while a prolonged refresh rebaselines`, () => {
    const tracker = create(); tracker.consume(feed([sale('old', -1000)]), { now: opened })
    assert.equal(tracker.consume(feed([], { ready: false, refreshing: true }), { now: opened + 60000 }).length, 0)
    assert.deepEqual(Array.from(tracker.consume(feed([sale('old', -1000), sale('fresh', 65000)]), { now: opened + 70000 }), row => row.id), ['fresh'])
    tracker.consume(feed([], { ready: false, refreshing: true }), { now: opened + 80000 })
    assert.equal(tracker.consume(feed([sale('during-outage', 205000)]), { now: opened + 210000 }).length, 0)
  })
  test(`${name}: baseline stays silent, unseen sales arrive in order, corrections and duplicates do not replay`, () => {
    const tracker = create()
    assert.equal(tracker.consume(feed([sale('old', -60000)]), { now: opened }).length, 0)
    const result = tracker.consume(feed([sale('b', 2000), sale('old', -60000), sale('a')]), { now: opened + 3000 })
    assert.deepEqual(Array.from(result, row => row.id), ['a', 'b'])
    assert.equal(result[0].sellerName, 'Ana')
    assert.equal(tracker.consume(feed([sale('a', 1000, { amount: 4000, sellerName: 'Outro' }), sale('b', 2000)]), { now: opened + 5000 }).length, 0)
  })
  test(`${name}: historical imports, date-only rows, far-future events, invalid values and stale day do not notify`, () => {
    const tracker = create(); tracker.consume(feed([]), { now: opened })
    const result = tracker.consume(feed([sale('old', -1), sale('day', 0, { occurredAt: null }), sale('date-only', 0, { occurredAt: '2026-10-19' }), sale('future', 120000), sale('zero', 1000, { amount: 0 }), sale('negative', 1000, { amount: -1 }), sale('infinite', 1000, { amount: Infinity }), sale('good', 1000, { sellerName: undefined })]), { now: opened + 5000 })
    assert.deepEqual(Array.from(result, row => row.id), ['good'])
    assert.equal(Object.hasOwn(result[0], 'sellerName'), false)
    assert.equal(tracker.consume({ ...feed([sale('yesterday')]), day: '2026-10-18' }, { now: opened + 10000 }).length, 0)
  })
  test(`${name}: partial sources, errors, hidden tabs and explicit resets rebaseline without catching up old sales`, () => {
    const tracker = create(); tracker.consume(feed([]), { now: opened })
    tracker.consume(feed([sale('missed')], { ready: false }), { now: opened + 2000 })
    assert.equal(tracker.consume(feed([sale('missed')]), { now: opened + 3000 }).length, 0)
    assert.deepEqual(Array.from(tracker.consume(feed([sale('missed'), sale('new', 4000)]), { now: opened + 5000 }), row => row.id), ['new'])
    for (const options of [{ healthy: false }, { active: false }]) {
      tracker.consume(feed([]), { now: opened + 10000, ...options })
      assert.equal(tracker.consume(feed([sale('gap', 9000)]), { now: opened + 11000 }).length, 0)
    }
    tracker.reset()
    assert.equal(tracker.consume(feed([sale('after-reset', 12000)]), { now: opened + 13000 }).length, 0)
  })
  test(`${name}: missing sources rebaseline independently and sales older than ten minutes never queue`, () => {
    const tracker = create(); tracker.consume(feed([]), { now: opened })
    tracker.consume({ day: '2026-10-19', groups: [] }, { now: opened + 1000 })
    assert.equal(tracker.consume(feed([sale('missing', 2000)]), { now: opened + 3000 }).length, 0)
    assert.equal(tracker.consume(feed([sale('late', 5000)]), { now: opened + 700000 }).length, 0)
    assert.equal(tracker.consume(feed([sale('late', 5000), sale('live', 701000)]), { now: opened + 702000 }).length, 1)
  })
}
