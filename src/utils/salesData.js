import { asaasCashOnly } from './sourceAvailability.js'
import { applyTmbCashRule } from './tmbCash.js'
// Pure adapters. Monetary amounts come from the API; fee rules stay on the server.
export const SOURCE_DEFINITIONS = [
  { id: 'guru', label: 'Guru', platform: 'Guru', kind: 'sale' },
  { id: 'tmb', label: 'TMB', platform: 'TMB', kind: 'sale' },
  { id: 'asaas', label: 'Asaas', platform: 'Asaas', kind: 'sale' },
  { id: 'boletex', label: 'Boletex', platform: 'Boletex', kind: 'sale' },
  { id: 'hotmart', label: 'Hotmart', platform: 'Hotmart', kind: 'sale' },
  { id: 'guruRefunds', label: 'Reembolsos Guru', platform: 'Guru', kind: 'refund' },
  { id: 'hotmartRefunds', label: 'Reembolsos Hotmart', platform: 'Hotmart', kind: 'refund' },
]

export const PRODUCT_FAMILIES = ['MBA', 'DevClub', 'IAClub', 'Seu segundo salário com IA', 'Operação 50K', 'Outros', 'Não informado']
export const UTM_FIELDS = ['source', 'medium', 'campaign', 'content', 'term']
export const EMPTY_FILTERS = { family: '', product: '', platform: '', payment: '', source: '', medium: '', campaign: '', content: '', term: '' }
export const UNKNOWN = '__not_informed__'

export function amount(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const fold = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
const text = (value) => typeof value === 'string' && value.trim() ? value.trim() : null

export function productFamily(name) {
  const value = fold(name)
  if (!value) return 'Não informado'
  if (/\boperacao[\s-]*50\s*k\b/.test(value)) return 'Operação 50K'
  if (value.includes('seu segundo salario com ia')) return 'Seu segundo salário com IA'
  if (/\bmba\b/.test(value)) return 'MBA'
  if (/ia\s*club|gestor de ia|formacao.*inteligencia artificial/.test(value)) return 'IAClub'
  if (/dev\s*club|full\s*stack/.test(value)) return 'DevClub'
  return 'Outros'
}

export function paymentLabel(value) {
  const key = fold(value).replace(/[ -]/g, '_')
  if (['credit_card', 'cartao', 'cartao_de_credito', 'creditcard'].includes(key)) return 'Cartão'
  if (['pix', 'instant_payment'].includes(key)) return 'Pix'
  if (['boleto', 'bank_slip', 'billet'].includes(key)) return 'Boleto'
  if (['boleto_parcelado', 'installment_billet'].includes(key)) return 'Boleto parcelado'
  return text(value) || 'Não informado'
}

export function parseSaleDate(value) {
  if (!value) return null
  const numeric = typeof value === 'number' || /^\d{10,13}$/.test(String(value)) ? Number(value) : null
  const date = new Date(numeric !== null ? (numeric < 1e12 ? numeric * 1000 : numeric) : value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function saleHour(value) {
  const date = parseSaleDate(value)
  return date ? Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23' }).format(new Date(date))) : null
}

function utms(raw) {
  const tracking = raw.trackings || raw.tracking || raw.utm || {}
  return Object.fromEntries(UTM_FIELDS.map((field) => [field, text(tracking[`utm_${field}`]) || text(tracking[field]) || text(raw[`utm_${field}`])]))
}

function record(source, raw, index, fields) {
  const product = text(fields.product)
  // TMB's display id contains an array index; the provider's pedido_id is stable.
  const providerId = source.id === 'tmb' ? raw.raw?.pedido_id : raw.hash || raw.transaction || raw.id
  const externalId = providerId === null || providerId === undefined ? null : String(providerId)
  return {
    id: `${source.id}:${raw.hash || raw.transaction || raw.id || index}`,
    sourceId: source.id, platform: source.platform, kind: source.kind,
    source: source.platform.toLowerCase(), externalId, canAttribute: Boolean(externalId) && source.kind === 'sale',
    buyerName: text(raw.contact?.name || raw.buyer || raw.customerName || raw.cliente),
    buyerEmail: text(raw.contact?.email || raw.buyerEmail || raw.customerEmail || raw.email),
    quantity: 1, gross: null, net: null, fees: null, affiliate: null,
    received: null, listPrice: null, pending: null, revenue: null,
    original: raw, ...fields, product, family: productFamily(product),
    payment: paymentLabel(fields.payment), date: parseSaleDate(fields.date), utm: utms(raw),
  }
}

// Some APIs return a consolidated amount without every transaction. Keep its
// unallocated balance visible instead of attributing it to an invented product.
function reconcile(records, source, summary) {
  const count = amount(summary.quantity)
  const differences = {}
  let hasDifference = count !== null && count !== records.length
  for (const key of ['revenue', 'gross', 'net', 'fees', 'received', 'listPrice', 'pending']) {
    const total = amount(summary[key])
    if (total === null) continue
    const detailed = records.reduce((sum, item) => sum + (item[key] ?? 0), 0)
    const difference = total - detailed
    if (Math.abs(difference) >= 0.005) hasDifference = true
    differences[key] = Math.abs(difference) < 0.005 ? 0 : difference
  }
  if (hasDifference) records.push(record(source, {}, 'unallocated', {
    ...differences, quantity: count === null ? 0 : count - records.length,
    product: null, payment: summary.payment, isAggregate: true,
  }))
  return records
}

export function normalizeSource(sourceId, payload) {
  const source = SOURCE_DEFINITIONS.find((item) => item.id === sourceId)
  if (!source) throw new Error('Fonte desconhecida')
  if (!payload || payload.success === false) throw new Error('Fonte indisponível')
  const data = payload.data
  if (sourceId === 'guru' || sourceId === 'guruRefunds') {
    if (!Array.isArray(data)) throw new Error('Formato de transações indisponível')
    return data.map((raw, i) => {
      const calculation = raw.calculation_details || {}
      const discounts = calculation.discounts
      const feeValues = discounts ? Object.values(discounts).map(amount) : []
      return record(source, raw, i, {
        product: raw.product?.name, payment: raw.payment?.method || calculation.payment_method,
        date: raw.dates?.created_at, revenue: amount(calculation.net_amount),
        gross: amount(calculation.total_amount ?? raw.payment?.total), net: amount(calculation.net_amount),
        fees: feeValues.length && feeValues.every((value) => value !== null) ? feeValues.reduce((sum, value) => sum + value, 0) : null,
        affiliate: amount(calculation.net_affiliate_value),
      })
    })
  }
  if (sourceId === 'tmb') {
    if (!Array.isArray(data)) throw new Error('Formato de boletos indisponível')
    return data.map((raw, i) => {
      const calendar = [raw.date?.original, raw.timestamp].find(value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
      return applyTmbCashRule(record(source, raw, i, {
        product: raw.product, payment: 'Boleto', date: calendar ? `${calendar}T12:00:00Z` : raw.timestamp,
        revenue: amount(raw.value), gross: amount(raw.value),
        ...(calendar ? { hasExactTime: false } : {}),
      }))
    })
  }
  if (!data || typeof data !== 'object') throw new Error('Consolidado indisponível')
  if (source.platform === 'Hotmart') {
    if (!Array.isArray(data.transactions) && amount(data.count) === null) throw new Error('Transações indisponíveis')
    const isRefund = source.kind === 'refund'
    const rows = (data.transactions || []).map((raw, i) => record(source, raw, i, {
      product: raw.product, payment: raw.paymentMethod, date: raw.orderDate,
      revenue: amount(isRefund ? raw.value : raw.netValue),
      gross: amount(isRefund ? raw.value : raw.grossValue),
      net: isRefund ? null : amount(raw.netValue), fees: isRefund ? null : amount(raw.fee),
    }))
    return reconcile(rows, source, {
      quantity: data.count, revenue: isRefund ? data.totalRefundAmount : data.totalNet,
      gross: isRefund ? data.totalRefundAmount : data.totalGross,
      net: isRefund ? null : data.totalNet, fees: isRefund ? null : data.totalFees,
    })
  }
  if (sourceId === 'asaas' && asaasCashOnly(data)) return []
  const sales = data.sales
  if (!sales || (!Array.isArray(sales.entries) && amount(sales.count) === null)) throw new Error('Vendas indisponíveis')
  const rows = (sales.entries || []).map((raw, i) => record(source, raw, i, {
    product: raw.productDescription, payment: 'Boleto parcelado', date: raw.createdAt,
    revenue: amount(raw.totalValue), gross: amount(raw.totalValue), received: amount(raw.entryValue),
    listPrice: amount(raw.listPrice), pending: amount(raw.pendingValue),
  }))
  return reconcile(rows, source, {
    quantity: sales.count, revenue: sales.totalValue, gross: sales.totalValue,
    received: sourceId === 'boletex' ? sales.confirmedValue : sales.entryValue,
    listPrice: sales.listPriceValue, pending: sales.pendingValue, payment: 'Boleto parcelado',
  })
}

export function filterSales(records, filters = {}) {
  return records.filter((row) => Object.entries(filters).every(([key, selected]) => {
    if (!selected) return true
    const value = UTM_FIELDS.includes(key) ? row.utm[key] : row[key]
    return selected === UNKNOWN ? !value || value === 'Não informado' : value === selected
  }))
}

export function filterOptions(records, key) {
  const values = [...new Set(records.map((row) => UTM_FIELDS.includes(key) ? row.utm[key] : row[key]).filter(Boolean))]
  return values.sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function sumAmount(records, key) {
  const known = records.filter((row) => amount(row[key]) !== null)
  return { value: known.reduce((sum, row) => sum + amount(row[key]), 0), known: known.length, missing: records.length - known.length }
}

export function summarizeSales(records) {
  return {
    count: records.reduce((sum, row) => sum + (amount(row.quantity) ?? 0), 0),
    ...Object.fromEntries(['revenue', 'gross', 'net', 'fees', 'affiliate', 'received', 'listPrice', 'pending'].map((key) => [key, sumAmount(records, key)])),
  }
}

export function groupSales(records, dimension) {
  const groups = new Map()
  for (const row of records) {
    const label = UTM_FIELDS.includes(dimension) ? row.utm[dimension] : row[dimension]
    const name = label || 'Não informado'
    if (!groups.has(name)) groups.set(name, [])
    groups.get(name).push(row)
  }
  return [...groups].map(([name, rows]) => ({ name, ...summarizeSales(rows) })).sort((a, b) => b.revenue.value - a.revenue.value)
}

export function hourlySales(records) {
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour: `${String(hour).padStart(2, '0')}h`, count: 0, value: 0, missingAmounts: 0 }))
  let unknown = 0
  let unknownRecords = 0
  for (const row of records) {
    // Manual entry captures a calendar date only, not a time of sale.
    const hour = row.isManual || row.hasExactTime === false ? null : saleHour(row.date)
    if (hour === null) { unknown += row.quantity; unknownRecords++; continue }
    hours[hour].count += row.quantity
    hours[hour].value += amount(row.revenue) ?? 0
    if (amount(row.revenue) === null) hours[hour].missingAmounts++
  }
  for (const hour of hours) if (hour.missingAmounts > 0) hour.value = null
  return { hours, unknown, unknownRecords }
}
