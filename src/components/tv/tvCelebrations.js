import { dateForRecord } from '../../utils/goalPace.js'
import { isRankingParticipant } from '../../utils/goalScopes.js'
import { amount, parseSaleDate } from '../../utils/salesData.js'

export const TV_CELEBRATION_SOURCES = Object.freeze(['guru', 'hotmart', 'hubla', 'tmb', 'asaas', 'boletex', 'manual'])
export const TV_CELEBRATION_LIMIT = 200
const dayOnly = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
const identity = value => ['string', 'number'].includes(typeof value) && String(value).trim() ? String(value).trim() : null
const sourceFor = row => String(row.sourceId || row.source || '').replace(/Refunds$/, '').toLowerCase()
const eventId = row => {
  const external = identity(row.externalId || (row.isManual && row.manualId))
  return external ? JSON.stringify([sourceFor(row), external]) : null
}
const blocked = row => {
  const raw = row.original || {}
  if (row.kind === 'refund' || row.isRefunded || row.isCancelled || row.isCanceled) return true
  return [row.status, row.attributionOriginalStatus, raw.status, raw.purchase?.status, raw.status_pedido,
    raw.status_financeiro, raw.raw?.status_pedido, raw.raw?.status_financeiro].some(value => {
    const status = typeof value === 'string' ? value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''
    return /cancel|refund|reembols|chargeback|chargedback|disput|protest|reject|recus/.test(status)
  })
}

function occurredAt(row) {
  const raw = row.original || {}
  const originalDate = row.isManual ? raw.date : sourceFor(row) === 'guru' ? raw.dates?.created_at
    : ['hotmart', 'hubla'].includes(sourceFor(row)) ? raw.orderDate : sourceFor(row) === 'tmb' ? raw.date?.original || raw.timestamp : raw.createdAt
  // Manual entries and date-only provider records can contain a fabricated
  // noon/midnight in their normalized date. They establish identity, not time.
  if (row.hasExactTime === false || dayOnly(originalDate) || dayOnly(row.date) || row.isManual) return null
  return parseSaleDate(row.date)
}

function sellerName(row, people) {
  const person = people.get(row.sellerId)
  if (!person || !isRankingParticipant(person) || !isRankingParticipant(row)) return null
  const name = typeof person.name === 'string' ? person.name.replace(/\s+/g, ' ').trim().slice(0, 80) : ''
  // Only the verified directory can supply a name. Raw seller labels, emails,
  // profile IDs and UTM strings never become presentation names.
  return !name || name === String(person.id) || /@|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(name) ? null : name
}

/** A bounded identity feed, separate from totals. Consumers baseline the first
 * healthy observation (and every recovery); null timestamps never trigger.
 * The API replaces private stable identities with opaque hashes.
 */
export function buildTvCelebrations({ records = [], sourceRecords = records, sources = [], directory = {},
  directoryError = false, salesError = false, operationsStatus, today, inSelectedMonth = true, observedAt } = {}) {
  const people = new Map((directory.individuals || []).map(person => [person.id, person]))
  const sharedReady = inSelectedMonth && !salesError && !directoryError && Array.isArray(directory.individuals)
    && Array.isArray(directory.teams) && operationsStatus === 'ready'
  const blockedIds = new Set(sourceRecords.filter(blocked).map(eventId).filter(Boolean))
  return { day: today, groups: TV_CELEBRATION_SOURCES.map(id => {
    const source = sources.find(item => item.id === id && item.kind === 'sale')
    const snapshots = (source?.snapshots || []).filter(snapshot => snapshot.startDate <= today && snapshot.endDate >= today)
    // Monthly history may be partial while today's independent provider slice
    // is healthy. Only that live slice decides whether native events can run.
    const ready = Boolean(sharedReady && source?.salesAvailable !== false
      && (id === 'manual' ? source?.status === 'ready' : ['ready', 'partial'].includes(source?.status)
        && snapshots.length > 0 && snapshots.every(snapshot => snapshot.status === 'ready'
          && snapshot.salesAvailable !== false && snapshot.complete === true && !snapshot.refreshing && !snapshot.error)))
    const observedTime = typeof observedAt === 'number' ? observedAt : Date.parse(observedAt)
    const routineRefresh = snapshot => {
      const age = observedTime - Date.parse(snapshot.fetchedAt)
      return snapshot.status === 'stale' && snapshot.refreshing === true && !snapshot.error && snapshot.complete === true
        && snapshot.salesAvailable !== false && Number.isFinite(age) && age >= -5000 && age <= 120_000
    }
    // Cache TTL refreshes expose the prior healthy payload briefly. Preserve
    // the consumer's baseline during that gap, but never process its events.
    const refreshing = Boolean(!ready && sharedReady && source?.salesAvailable !== false
      && ['ready', 'partial'].includes(source?.status) && snapshots.some(routineRefresh)
      && snapshots.every(snapshot => routineRefresh(snapshot) || (snapshot.status === 'ready' && snapshot.complete === true
        && snapshot.salesAvailable !== false && !snapshot.error)))
    if (!ready) return { source: id, ready: false, refreshing, events: [] }
    const byId = new Map()
    for (const row of records) {
      const key = eventId(row), value = amount(row.gross)
      if (sourceFor(row) !== id || row.kind !== 'sale' || row.isReceipt || row.isAggregate || blocked(row)
        || !key || blockedIds.has(key) || amount(row.quantity) !== 1 || value === null || value <= 0
        || (row.isManual && (row.linkedExternalId || row.original?.linkedExternalId)) || dateForRecord(row) !== today) continue
      const name = sellerName(row, people)
      byId.set(key, { id: key, occurredAt: occurredAt(row), amount: value, ...(name ? { sellerName: name } : {}) })
    }
    const all = [...byId.values()]
    const timestamped = all.filter(event => event.occurredAt).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id))
      .slice(-TV_CELEBRATION_LIMIT)
    const undated = all.filter(event => !event.occurredAt).sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, Math.min(20, TV_CELEBRATION_LIMIT - timestamped.length))
    return { source: id, ready: true, refreshing: false, events: [...undated, ...timestamped] }
  }) }
}
