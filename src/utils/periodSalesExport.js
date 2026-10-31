import * as XLSX from 'xlsx'
import { isCommercialSale, commercialSellerLabel, summarizeCommercialSales } from './commercialSales.js'
import { applyPlatformCashRule, salesPaymentLabel } from './platformCash.js'
import { amount, UNKNOWN, UTM_FIELDS } from './salesData.js'
import { sourceHasSales } from './sourceAvailability.js'

const MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00'
const DATE_FORMAT = 'dd/mm/yyyy'
const DATETIME_FORMAT = 'dd/mm/yyyy hh:mm:ss'
const moneyFields = ['revenue', 'gross', 'net', 'received']
const moneyLabels = ['Receita operacional', 'Valor das vendas', 'Líquido', 'Recebido']
const filterLabels = { family: 'Família', product: 'Produto', platform: 'Plataforma', payment: 'Pagamento', sellerId: 'Vendedor', source: 'UTM Source', medium: 'UTM Medium', campaign: 'UTM Campaign', content: 'UTM Content', term: 'UTM Term', offer: 'Oferta' }
const statusLabels = { ready: 'Disponível', partial: 'Parcial', unavailable: 'Indisponível', not_requested: 'Não consultada' }
const attributionLabels = { utm: 'Automática por UTM', manual: 'Manual', unassigned: 'Sem atribuição' }
const text = value => value == null ? null : String(value)

// Excel stores a calendar/time value without a timezone. Write the São Paulo
// wall clock as a serial so exports do not depend on the browser's timezone.
function excelDate(value, dateOnly = false) {
  if (!value) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const stamp = Date.parse(`${value}T00:00:00Z`)
    return Number.isFinite(stamp) ? { t: 'n', v: stamp / 86400000 + 25569, z: DATE_FORMAT } : null
  }
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).map(part => [part.type, part.value]))
  const stamp = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), dateOnly ? 0 : Number(parts.hour), dateOnly ? 0 : Number(parts.minute), dateOnly ? 0 : Number(parts.second))
  return { t: 'n', v: stamp / 86400000 + 25569, z: dateOnly ? DATE_FORMAT : DATETIME_FORMAT }
}

const summaryAmount = value => value.known || !value.missing ? value.value : null
function missingAmounts(summary) {
  const missing = moneyFields.flatMap((key, index) => summary[key].missing
    ? [`${['receita', 'valor das vendas', 'líquido', 'recebido'][index]} ${summary[key].missing}`] : [])
  return missing.length ? `Registros sem valor: ${missing.join('; ')}` : 'Valores disponíveis'
}

function filterDescription(filters, offer, records) {
  const describe = (key, value) => value === UNKNOWN ? 'Não informado'
    : key === 'sellerId' ? records.find(row => row.sellerId === value)?.sellerName || value : value
  return Object.entries({ ...filters, offer }).filter(([, value]) => value).map(([key, value]) => {
    // The global product filter selects several names, which may contain commas.
    const label = Array.isArray(value) ? value.map(item => describe(key, item)).join('; ') : describe(key, value)
    return `${filterLabels[key] || key}: ${label}`
  }).join(' · ') || 'Sem filtros adicionais'
}

function formatMoney(sheet, firstRow, lastRow, columns) {
  for (let row = firstRow; row <= lastRow; row++) {
    for (const column of columns) {
      const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })]
      if (cell?.t === 'n') cell.z = MONEY_FORMAT
    }
  }
}

export function buildPeriodSalesWorkbook(records, {
  startDate, endDate, filters = {}, offer = '', sources = [], operationsStatus,
  attributionMappingsStatus, availableSales, generatedAt = new Date(), scope = 'all',
} = {}) {
  const normalized = records.map(applyPlatformCashRule)
  const commercial = summarizeCommercialSales(normalized)
  const workbook = XLSX.utils.book_new()
  const salesSources = sources.filter(source => source.kind === 'sale')
  const salesAvailable = availableSales ?? (normalized.some(row => row.kind === 'sale')
    || salesSources.some(source => source.id !== 'manual' && sourceHasSales(source)))
  const mappingsUnavailable = operationsStatus === 'unavailable' || attributionMappingsStatus === 'unavailable'
  const commercialPartial = mappingsUnavailable || salesSources.some(source => source.status !== 'ready')
  const sourceStatus = sources.map(source => `${source.label || source.platform || source.id}: ${statusLabels[source.status] || 'Não informado'}`).join(' · ') || 'Não informadas'
  const sourceCoverage = sources.some(source => !['ready', 'not_requested'].includes(source.status))
    ? `Resultado parcial; os totais consideram os dados disponíveis. ${sourceStatus}` : sourceStatus
  const mappingStatus = mappingsUnavailable
    ? 'Indisponíveis — o resultado do Comercial pode estar incompleto e os vendedores podem estar sem identificação.'
    : operationsStatus === 'ready' ? 'Disponíveis' : 'Não informado'
  const summaryRow = (label, source, summary) => [label, source, summary.count, ...moneyFields.map(key => summaryAmount(summary[key])), missingAmounts(summary)]
  const totalRow = salesAvailable ? summaryRow('TOTAL DO COMERCIAL', null, commercial.total)
    : ['TOTAL DO COMERCIAL', null, null, null, null, null, null, 'Fontes de vendas indisponíveis']
  if (salesAvailable && commercialPartial) totalRow[7] = `Resultado parcial · ${totalRow[7]}`
  const commercialRows = [
    ['Resultado do Comercial'],
    ['De', excelDate(startDate, true), 'Até', excelDate(endDate, true)],
    ['Gerado em (Brasília)', excelDate(generatedAt)],
    ['Escopo', scope === 'commercial' ? 'Somente vendas do Comercial' : 'Todos os registros do período filtrado'],
    ['Filtros aplicados', filterDescription(filters, offer, normalized)],
    ['Fontes', sourceCoverage],
    ['Vínculos dos vendedores', mappingStatus],
    ['Critério', 'Vendas individuais com origem comercial/comercial-nome ou vínculo UTM cadastrado. O nome do vendedor vem da atribuição cadastrada.'],
    ['Valores', 'Guru, Hotmart e Hubla: líquido após taxas. Demais plataformas: regra do dashboard. Recebido não é somado ao valor da venda. Células vazias indicam valores não informados.'],
    [],
    ['Vendedor', 'UTM Source', 'Vendas', ...moneyLabels, 'Cobertura dos valores'],
    totalRow,
    ...commercial.groups.map(group => summaryRow(group.sellerName, group.utmSource || 'Não informada', group)),
  ]
  if (!commercial.groups.length) commercialRows.push([!salesAvailable
    ? 'Resultado do Comercial indisponível: nenhuma fonte de vendas disponível.'
    : commercialPartial ? 'Nenhuma venda do Comercial identificada nos dados disponíveis. Resultado parcial.'
      : 'Nenhuma venda do Comercial identificada neste recorte.'])
  const commercialSheet = XLSX.utils.aoa_to_sheet(commercialRows)
  commercialSheet['!cols'] = [32, 46, 14, 23, 23, 23, 23, 76].map(wch => ({ wch }))
  commercialSheet['!rows'] = commercialRows.map((_, index) => ({ hpt: [7, 8].includes(index) ? 30 : 22 }))
  commercialSheet['!merges'] = [0].map(r => ({ s: { r, c: 0 }, e: { r, c: 7 } }))
    .concat([3, 4, 5, 6, 7, 8].map(r => ({ s: { r, c: 1 }, e: { r, c: 7 } })))
  formatMoney(commercialSheet, 11, commercialRows.length - 1, [3, 4, 5, 6])
  XLSX.utils.book_append_sheet(workbook, commercialSheet, 'Comercial')

  const headers = ['Data (Brasília)', 'ID da venda', 'ID na plataforma', 'Fonte', 'Plataforma', 'Tipo', 'Quantidade', 'Registro agregado', 'Comercial', 'Vendedor', 'ID do vendedor', 'Atribuição', 'UTM vinculada', 'Cliente', 'Email', 'Produto', 'Família', 'Oferta', 'Categoria de pagamento', 'Pagamento original', 'Receita operacional', 'Valor das vendas', 'Líquido', 'Recebido', 'Pendente', ...UTM_FIELDS.map(field => `UTM ${field[0].toUpperCase()}${field.slice(1)}`)]
  const saleRows = normalized.map(row => [
    excelDate(row.date), text(row.id), text(row.externalId), text(row.sourceId || row.source), text(row.platform),
    row.kind === 'sale' ? 'Venda' : row.kind === 'refund' ? 'Reembolso' : text(row.kind), amount(row.quantity), row.isAggregate ? 'Sim' : 'Não',
    isCommercialSale(row) ? 'Sim' : 'Não', commercialSellerLabel(row), text(row.sellerId), attributionLabels[row.attributionMethod] || 'Sem atribuição', text(row.attributionUtmSource),
    text(row.buyerName), text(row.buyerEmail), text(row.product), text(row.family), text(row.offer), text(salesPaymentLabel(row)), text(row.payment),
    ...['revenue', 'gross', 'net', 'received', 'pending'].map(key => amount(row[key])),
    ...UTM_FIELDS.map(field => text(row.utm?.[field])),
  ])
  // aoa_to_sheet writes supplied strings as text cells, even when they begin
  // with =, +, -, or @. No source value is ever assigned as an Excel formula.
  const salesSheet = XLSX.utils.aoa_to_sheet([headers, ...saleRows])
  salesSheet['!cols'] = [23, 30, 26, 19, 18, 15, 12, 20, 14, 30, 30, 24, 36, 32, 38, 40, 23, 36, 25, 24, 23, 23, 23, 23, 23, 38, 30, 38, 38, 30].map(wch => ({ wch }))
  salesSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: saleRows.length, c: headers.length - 1 } }) }
  formatMoney(salesSheet, 1, saleRows.length, [20, 21, 22, 23, 24])
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Vendas')
  workbook.Props = { Title: 'Relatório de vendas e UTMs', Subject: `Período ${startDate || ''} a ${endDate || ''}`, Author: 'DevClub' }
  return workbook
}

export function exportPeriodSalesExcel(records, options = {}) {
  const workbook = buildPeriodSalesWorkbook(records, options)
  const prefix = options.scope === 'commercial' ? 'comercial' : 'vendas'
  const filename = `${prefix}-${options.startDate}-${options.endDate}.xlsx`
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx', compression: true })
}
