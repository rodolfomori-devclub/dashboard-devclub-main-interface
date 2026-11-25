import * as XLSX from 'xlsx'
import { isCommercialSale, commercialSellerLabel, summarizeCommercialSales } from './commercialSales.js'
import { applyPlatformCashRule, salesPaymentLabel } from './platformCash.js'
import { amount, filterSales, productFamily, SOURCE_DEFINITIONS, UNKNOWN, UTM_FIELDS } from './salesData.js'
import { sourceHasSales } from './sourceAvailability.js'
import { refundStatusLabel } from './refundSummary.js'
import { netBasisLabel } from './netBasis.js'

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
  attributionMappingsStatus, availableSales, generatedAt = new Date(), scope = 'all', refundReview,
} = {}) {
  const normalized = records.map(applyPlatformCashRule)
  const pendingRequests = refundReview?.pendingRequests || []
  // Unlinked requests carry no safe seller, campaign, offer or sales-payment
  // category. Missing linkage must not qualify as an unknown-value filter.
  const unverifiedPendingFilters = scope === 'commercial' || Boolean(offer) || Object.entries(filters).some(([key, value]) => value && !['product', 'family', 'platform'].includes(key))
  const pendingRows = unverifiedPendingFilters ? [] : filterSales(pendingRequests.map(row => ({
    ...row, family: productFamily(row.product),
    platform: SOURCE_DEFINITIONS.find(source => source.id === String(row.platform || '').toLowerCase())?.platform || row.platform,
  })), filters).filter(row => (!startDate || row.purchasedAt >= startDate) && (!endDate || row.purchasedAt <= endDate))
  const omittedPending = pendingRequests.length - pendingRows.length
  const commercial = summarizeCommercialSales(normalized)
  const workbook = XLSX.utils.book_new()
  const salesSources = sources.filter(source => source.kind === 'sale')
  const salesAvailable = availableSales ?? (normalized.some(row => row.kind === 'sale')
    || salesSources.some(source => source.id !== 'manual' && sourceHasSales(source)))
  const mappingsUnavailable = operationsStatus === 'unavailable' || attributionMappingsStatus === 'unavailable'
  const commercialPartial = mappingsUnavailable || salesSources.some(source => source.status !== 'ready') || (refundReview && (refundReview.status !== 'ready' || refundReview.pendingRequests.length > 0))
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
    ['Valores', 'Guru: líquido estimado pela tabela de taxas ou, sem regra aplicável, pela regra anterior (veja Base do líquido e Regra de taxa). Hotmart e Hubla: líquido informado pela plataforma. Demais plataformas: regra do dashboard. Recebido não é somado ao valor da venda. Células vazias indicam valores não informados.'],
    omittedPending ? ['Pendências de reembolso', `${omittedPending} solicitações omitidas: fora do período/filtros ou sem vínculo seguro para confirmar os filtros. A cobertura dos totais permanece parcial.`] : [],
    ['Vendedor', 'UTM Source', 'Vendas', ...moneyLabels, 'Cobertura dos valores'],
    totalRow,
    ...commercial.groups.map(group => summaryRow(group.sellerName, group.utmSource || 'Não informada', group)),
  ]
  if (!commercial.groups.length) commercialRows.push([!salesAvailable
    ? 'Resultado do Comercial indisponível: nenhuma fonte de vendas disponível.'
    : commercialPartial ? 'Nenhuma venda do Comercial identificada nos dados disponíveis. Resultado parcial.'
      : 'Nenhuma venda do Comercial identificada neste recorte.'])
  const commercialSheet = XLSX.utils.aoa_to_sheet(commercialRows)
  commercialSheet['!exportHeaderRow'] = 10
  commercialSheet['!cols'] = [32, 46, 14, 23, 23, 23, 23, 76].map(wch => ({ wch }))
  commercialSheet['!rows'] = commercialRows.map((_, index) => ({ hpt: [7, 8, 9].includes(index) ? 30 : 22 }))
  commercialSheet['!merges'] = [0].map(r => ({ s: { r, c: 0 }, e: { r, c: 7 } }))
    .concat([3, 4, 5, 6, 7, 8, 9].map(r => ({ s: { r, c: 1 }, e: { r, c: 7 } })))
  formatMoney(commercialSheet, 11, commercialRows.length - 1, [3, 4, 5, 6])
  XLSX.utils.book_append_sheet(workbook, commercialSheet, 'Comercial')

  const headers = ['Data (Brasília)', 'ID da venda', 'ID na plataforma', 'Fonte', 'Plataforma', 'Tipo', 'Quantidade', 'Registro agregado', 'Comercial', 'Vendedor', 'ID do vendedor', 'Atribuição', 'UTM vinculada', 'Cliente', 'Email', 'Produto', 'Família', 'Oferta', 'Categoria de pagamento', 'Pagamento original', 'Receita operacional', 'Valor das vendas', 'Líquido', 'Recebido', 'Pendente', ...UTM_FIELDS.map(field => `UTM ${field[0].toUpperCase()}${field.slice(1)}`), 'Valor cobrado', 'Gateway', 'Parcelas', 'Base do líquido', 'Regra de taxa']
  const exportRows = row => [
    excelDate(row.date), text(row.id), text(row.externalId), text(row.sourceId || row.source), text(row.platform),
    row.kind === 'sale' ? 'Venda' : row.kind === 'refund' ? 'Reembolso' : text(row.kind), amount(row.quantity), row.isAggregate ? 'Sim' : 'Não',
    isCommercialSale(row) ? 'Sim' : 'Não', commercialSellerLabel(row), text(row.sellerId), attributionLabels[row.attributionMethod] || 'Sem atribuição', text(row.attributionUtmSource),
    text(row.buyerName), text(row.buyerEmail), text(row.product), text(row.family), text(row.offer), text(salesPaymentLabel(row)), text(row.payment),
    ...['revenue', 'gross', 'net', 'received', 'pending'].map(key => amount(row[key])),
    ...UTM_FIELDS.map(field => text(row.utm?.[field])),
    amount(row.charged), text(row.gateway), amount(row.installments), netBasisLabel(row), text(row.feeRule),
    ...(refundReview ? [refundStatusLabel(row.refundExclusion?.status || row.original?.status), excelDate(row.refundExclusion?.requestedAt, true)] : []),
  ]
  if (refundReview) headers.push('Status do reembolso', 'Solicitado em')
  const saleRows = normalized.filter(row => !refundReview || row.kind === 'sale').map(exportRows)
  // aoa_to_sheet writes supplied strings as text cells, even when they begin
  // with =, +, -, or @. No source value is ever assigned as an Excel formula.
  const salesSheet = XLSX.utils.aoa_to_sheet([headers, ...saleRows])
  salesSheet['!cols'] = [23, 30, 26, 19, 18, 15, 12, 20, 14, 30, 30, 24, 36, 32, 38, 40, 23, 36, 25, 24, 23, 23, 23, 23, 23, 38, 30, 38, 38, 30, 18, 14, 10, 30, 36].map(wch => ({ wch }))
  salesSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: saleRows.length, c: headers.length - 1 } }) }
  formatMoney(salesSheet, 1, saleRows.length, [20, 21, 22, 23, 24, 30])
  XLSX.utils.book_append_sheet(workbook, salesSheet, 'Vendas')
  if (refundReview) {
    const refundRows = normalized.filter(row => row.kind === 'refund').map(exportRows)
    const refundSheet = XLSX.utils.aoa_to_sheet([headers, ...refundRows])
    refundSheet['!cols'] = [...salesSheet['!cols'], { wch: 38 }, { wch: 20 }]
    refundSheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: refundRows.length, c: headers.length - 1 } }) }
    formatMoney(refundSheet, 1, refundRows.length, [20, 21, 22, 23, 24, 30])
    XLSX.utils.book_append_sheet(workbook, refundSheet, 'Reembolsos e chargebacks')
    if (pendingRows.length) {
      const pendingSheet = XLSX.utils.aoa_to_sheet([
        ['Solicitações sem vínculo seguro — vendas mantidas para conferência'],
        ['Cliente', 'E-mail', 'Produto', 'Compra', 'Solicitação', 'Status'],
        ...pendingRows.map(row => [text(row.name), text(row.email), text(row.product), excelDate(row.purchasedAt, true), excelDate(row.requestedAt, true), refundStatusLabel(row.status)]),
      ])
      pendingSheet['!exportHeaderRow'] = 1
      pendingSheet['!cols'] = [38, 38, 40, 20, 20, 38].map(wch => ({ wch }))
      XLSX.utils.book_append_sheet(workbook, pendingSheet, 'Solicitações a conferir')
    }
  }
  workbook.Props = { Title: 'Relatório de vendas e UTMs', Subject: `Período ${startDate || ''} a ${endDate || ''}`, Author: 'DevClub' }
  return workbook
}

export function exportPeriodSalesExcel(records, options = {}) {
  const workbook = buildPeriodSalesWorkbook(records, options)
  const prefix = options.scope === 'commercial' ? 'comercial' : 'vendas'
  const filename = `${prefix}-${options.startDate}-${options.endDate}.xlsx`
  XLSX.writeFile(workbook, filename, { bookType: 'xlsx', compression: true })
}

export async function exportPeriodSales(records, options, format) {
  const { exportWorkbook } = await import('./reportExport.js')
  const prefix = options.scope === 'commercial' ? 'comercial' : 'vendas'
  return exportWorkbook(buildPeriodSalesWorkbook(records, options), format, {
    filename: `${prefix}-${options.startDate}-${options.endDate}`,
    title: `Vendas · ${options.startDate} a ${options.endDate}`,
  })
}

const BUYER_HEADERS = ['Nome', 'E-mail', 'Telefone', 'Produto', 'Plataforma', 'Data (Brasília)']
const buyerText = value => value == null || String(value).trim() === '' ? 'Não informado' : String(value)
const buyerRows = block => block.rows.map(row => [
  ...['name', 'email', 'phone', 'product', 'platform'].map(key => buyerText(row[key])),
  excelDate(row.date) || 'Não informado',
])

export function buildBuyerContactsWorkbook(block) {
  const workbook = XLSX.utils.book_new()
  const rows = buyerRows(block)
  const sheet = XLSX.utils.aoa_to_sheet([BUYER_HEADERS, ...rows])
  sheet['!cols'] = [32, 38, 24, 40, 20, 24].map(wch => ({ wch }))
  sheet['!autofilter'] = { ref: `A1:F${rows.length + 1}` }
  XLSX.utils.book_append_sheet(workbook, sheet, 'Compradores')
  const context = XLSX.utils.aoa_to_sheet([
    ['Contatos dos compradores'],
    ['De', excelDate(block.period.startDate, true), 'Até', excelDate(block.period.endDate, true)],
    ['Filtros aplicados', filterDescription(block.filters || {}, '', [])],
    ['Cobertura', block.status === 'ready' ? 'Dados disponíveis' : block.status === 'pending' ? 'Ainda em coleta — resultado parcial' : 'Resultado parcial'],
    ['Registros exportados', rows.length],
    ['Registros encontrados', block.totalRows],
    ['Limite', block.truncated ? `Exportados ${rows.length} de ${block.totalRows} registros encontrados. Restrinja o período ou os filtros para consultar os demais.` : 'Todos os registros exibidos foram exportados.'],
    ['Registros agregados excluídos', block.omittedAggregateRows || 0],
    ['Critério', 'Uma linha por compra individual. Um comprador pode aparecer em mais de uma compra. Campos ausentes ficam como Não informado.'],
    ...(block.notices || []).map(notice => [notice.title, notice.message]),
  ])
  context['!cols'] = [32, 100, 10, 24].map(wch => ({ wch }))
  XLSX.utils.book_append_sheet(workbook, context, 'Contexto')
  workbook.Props = { Title: 'Contatos dos compradores', Subject: `Período ${block.period.startDate} a ${block.period.endDate}`, Author: 'DevClub' }
  return workbook
}

export function buildBuyerContactsCsv(block) {
  const cell = (value, column) => {
    let text = String(value)
    if (typeof value === 'object') {
      const date = new Date(Math.round((value.v - 25569) * 86400000))
      text = date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      if (value.z === DATETIME_FORMAT) text += ` ${date.toLocaleTimeString('pt-BR', { timeZone: 'UTC', hour12: false })}`
    }
    // CSV has no cell types. The apostrophe keeps phones as text in spreadsheet
    // apps and prevents source text from becoming a formula when the file opens.
    const first = [...text].find(character => character.trim() && character.charCodeAt(0) >= 32)
    if ((column === 2 && text !== 'Não informado') || ['=', '+', '-', '@'].includes(first)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const head = BUYER_HEADERS.map(value => cell(value, -1)).join(';')
  return `\uFEFF${[head, ...buyerRows(block).map(row => row.map(cell).join(';'))].join('\r\n')}\r\n`
}

export function exportBuyerContacts(block, format) {
  if (!['xlsx', 'csv'].includes(format)) throw new Error('Formato de exportação inválido.')
  const partial = block.status !== 'ready' || block.truncated
  const filename = `compradores-${block.period.startDate}-${block.period.endDate}${partial ? '-parcial' : ''}.${format}`
  if (format === 'xlsx') return XLSX.writeFile(buildBuyerContactsWorkbook(block), filename, { bookType: 'xlsx', compression: true })
  const url = URL.createObjectURL(new Blob([buildBuyerContactsCsv(block)], { type: 'text/csv;charset=utf-8;' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try { link.click() } finally { link.remove(); URL.revokeObjectURL(url) }
}
