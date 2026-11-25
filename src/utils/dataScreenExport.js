import { dateLabel, percentage, validCount } from '../components/buyers/buyerIntelligence.js'
import { amount, UTM_FIELDS } from './salesData.js'
import { refundStatusLabel } from './refundSummary.js'

const coverageLabel = status => ({ ready: 'Disponível', available: 'Disponível', limited: 'Cobertura limitada', partial: 'Dados parciais', unavailable: 'Indisponível', not_requested: 'Não consultada' })[status] || 'Não informado'
const numericCount = value => validCount(value) ? value : null
const sourceSheet = sources => ({ name: 'Fontes', headers: ['Fonte', 'Cobertura', 'Observação'], rows: sources.map(source => [source.label || source.id, coverageLabel(source.status), source.message || source.error || null]) })

export function buildRefundsReport(rows, { period, result, filters = [] }) {
  const basis = { refund: 'Cancelamento / estorno', purchase: 'Compra / efetivação', request: 'Solicitação', unknown: 'Não informada' }
  return {
    title: 'Reembolsos', filename: `reembolsos-${period.startDate}-${period.endDate}`,
    context: [
      ['De', dateLabel(period.startDate)], ['Até', dateLabel(period.endDate)], ...filters,
      ['Registros exportados', rows.length], ['Cobertura', result?.incomplete ? 'Dados parciais: somente os registros recebidos.' : 'Registros disponíveis na consulta.'],
      ['Critério', 'O período considera cancelamento na Guru, compra/efetivação na Hotmart, Hubla e TMB, e abertura nas solicitações.'],
      ['Valores', 'O valor da venda não representa o valor efetivamente devolvido. Guru, Hotmart e Hubla: líquido após taxas; demais: valor contratado.'],
      ['Registros sem data para o período', result?.excludedUndated ?? null], ['Registros conciliados', result?.deduplication?.removed ?? null],
      ['Consulta (Brasília)', dateLabel(result?.generatedAt, true)],
    ],
    sheets: [{
      name: 'Registros',
      headers: ['ID do registro', 'Data de referência (Brasília)', 'Critério da data', 'Cliente', 'E-mail', 'Contato', 'Produto', 'Fontes', 'Plataforma', 'Status', 'ID da compra', 'Status na origem', 'Data da compra', 'Data da solicitação', 'Data do cancelamento ou estorno', 'Valor da venda', 'Valor efetivamente devolvido', 'Moeda da venda', 'Moeda do valor devolvido', 'Pagamento', 'Classificação', 'Motivo', 'Observação'],
      rows: rows.map(row => [row.id, dateLabel(row.referenceDate), basis[row.dateBasis] || 'Não informada', row.name, row.email, row.contact, row.product, row.sources?.join(' + '), row.platform, refundStatusLabel(row.status), row.transactionId, row.originalStatus, dateLabel(row.purchasedAt), dateLabel(row.requestedAt), dateLabel(row.refundedAt), amount(row.saleAmount), amount(row.refundAmount), row.currency, row.refundCurrency || row.currency, row.paymentMethod, row.classification, row.reason, row.note]),
    }, sourceSheet(result?.sources || [])],
  }
}

export function buildAttributionReport(rows, { period, filters = [], sources = [], warning = '' }) {
  const attributionLabel = method => ({ utm: 'Automática por UTM', manual: 'Atribuição manual', unassigned: 'Sem vendedor' })[method] || 'Sem vendedor'
  return {
    title: 'Atribuição e conciliação', filename: `atribuicao-${period.from}-${period.to}`,
    context: [
      ['De', dateLabel(period.from)], ['Até', dateLabel(period.to)], ...filters, ['Registros exportados', rows.length],
      ['Cobertura', warning || (sources.some(source => source.kind === 'sale' && source.status !== 'ready') ? 'Dados parciais: somente os registros recebidos.' : 'Registros disponíveis na consulta.')],
      ['Critério', 'Todos os registros da lista filtrada. Registros manuais vinculados à plataforma permanecem identificados para conferência e não devem ser somados novamente. Registros agregados ficam fora desta lista.'],
      ['Valores em BRL', 'Guru, Hotmart e Hubla: líquido após taxas; demais: valor contratado. O caixa recebido é apresentado separadamente. Campos vazios indicam valores não informados.'],
    ],
    sheets: [{
      name: 'Vendas para atribuição',
      headers: ['ID do registro', 'Data (Brasília)', 'Cliente', 'E-mail', 'Produto', 'Fonte', 'Plataforma', 'ID na plataforma', 'Valor da venda', 'Líquido', 'Caixa recebido', 'Vendedor', 'Identificação', 'Conferência', 'Sincronização pendente', 'Fora dos totais manuais', ...UTM_FIELDS.map(field => `UTM ${field[0].toUpperCase()}${field.slice(1)}`)],
      rows: rows.map(row => [row.id, dateLabel(row.date, true), row.buyerName, row.buyerEmail, row.product, row.source || row.sourceId, row.platform, row.externalId, amount(row.gross), amount(row.net), amount(row.received), row.sellerName, attributionLabel(row.attributionMethod), row.isLinkedManual ? 'Vinculada à plataforma' : row.status === 'reconciled' ? 'Conciliada' : 'Pendente', row.syncPending ? 'Sim' : 'Não', row.isLinkedManual ? 'Sim' : 'Não', ...UTM_FIELDS.map(field => row.utm?.[field])]),
    }, sourceSheet(sources)],
  }
}

export function buildBuyerIntelligenceReport(data, selected) {
  const period = { dateFrom: data.period?.dateFrom || selected.dateFrom, dateTo: data.period?.dateTo || selected.dateTo }
  const coverage = data.historicalCoverage
  const indicator = (label, value, denominator) => [label, numericCount(value), numericCount(denominator), denominator === undefined ? null : percentage(value, denominator)]
  return {
    title: 'Inteligência de compradores', filename: `compradores-${period.dateFrom}-${period.dateTo}`,
    context: [
      ['Pedidos de', dateLabel(period.dateFrom)], ['Pedidos até', dateLabel(period.dateTo)],
      ['Escopo', 'Indicadores e distribuições agregadas da consulta ao Oráculo. Esta tela não fornece uma lista individual de contatos.'],
      ['Histórico recuperado', coverage ? 'Toda a base importada, independentemente do período dos pedidos.' : 'Indisponível nesta consulta.'],
      ['Catálogo de produtos', data.productDistribution && data.productCatalog ? 'Período dos pedidos selecionado.' : 'Indisponível nesta consulta.'],
      ['Leitura', data.notice || 'Perfis agrupados por evidências, não pessoas únicas confirmadas.'],
      ['Inscrições e UTMs', 'Inscrição não comprova presença ou engajamento. UTM observada não comprova qual anúncio causou a compra. Nenhum observado não significa primeiro contato.'],
      ['Sinais históricos', 'Categorias podem se sobrepor. Somente registros com data demonstravelmente anterior ao pedido entram nos sinais; registros sem data não entram.'],
      ['Produtos', 'Um perfil pode aparecer em vários produtos; pedidos entre plataformas podem conter duplicidades. Esta tabela não consolida receita.'],
      ['Última importação (Brasília)', dateLabel(data.lastImport?.completedAt, true)],
      ['Última recuperação histórica (Brasília)', dateLabel(data.lastHistoricalImport?.completedAt, true)],
    ],
    sheets: [
      { name: 'Indicadores', headers: ['Indicador', 'Quantidade', 'Base de comparação', 'Percentual'], rows: [
        indicator('Pedidos', data.coverage?.totalPurchases), indicator('Pedidos ligados a um perfil', data.linkedPurchases, data.coverage?.totalPurchases),
        indicator('Pedidos aprovados', data.approvedPurchases), indicator('Aprovados com perfil', data.approvedLinkedPurchases),
        indicator('Pedidos sem vínculo ativo', data.unlinkedPurchases), indicator('Pendentes de revisão', data.reviewPending),
        indicator('Perfis com pedidos aprovados', data.profiles), indicator('Perfis com cadastro de lead', data.coverage?.withLeadProfiles),
        indicator('Indício de recompra', data.repeatBuyerProfiles, data.denominators?.repeatBuyerProfiles), indicator('Perfis em mais de uma plataforma', data.crossProviderProfiles),
        indicator('Inscrição anterior à compra', data.approvedWithPriorParticipation, data.approvedLinkedPurchases),
        indicator('UTM anterior observada', data.approvedWithPriorUtm, data.approvedLinkedPurchases),
        ...[['approvedWithPriorHistoricalInteraction', 'Interação histórica'], ['approvedWithPriorHistoricalSurvey', 'Pesquisa respondida'], ['approvedWithPriorHistoricalUtm', 'UTM histórica'], ['approvedWithPriorHistoricalCampaignMembership', 'Em lista de campanha']].map(([key, label]) => indicator(label, data[key], data.approvedLinkedPurchases)),
        indicator('Pedidos aprovados com produto identificado', data.productCatalog?.approvedMapped, data.approvedPurchases),
      ] },
      { name: 'Lançamentos anteriores', headers: ['Lançamentos observados', 'Pedidos', 'Base de comparação', 'Percentual'], rows: (data.launchCountBeforePurchaseDistribution || []).map(row => [row.launches === '0' ? 'Nenhum observado' : `${row.launches} lançamento(s)`, numericCount(row.purchases), numericCount(data.denominators?.launchDistribution), percentage(row.purchases, data.denominators?.launchDistribution)]) },
      { name: 'Origem da última inscrição', headers: ['Origem observada', 'Pedidos', 'Base de comparação', 'Percentual'], rows: (data.priorSourceDistribution || []).map(row => [row.source === '(sem utm_source)' ? 'Origem não informada' : row.source, numericCount(row.purchases), numericCount(data.denominators?.priorSourceDistribution), percentage(row.purchases, data.denominators?.priorSourceDistribution)]) },
      { name: 'Produtos', headers: ['Produto', 'Pedidos', 'Perfis', 'Base de pedidos aprovados', 'Percentual'], rows: (data.productDistribution || []).map(row => [row.classification === 'MAPPED' ? row.name : row.classification === 'REVIEW_REQUIRED' ? 'Produto em revisão' : 'Produto não mapeado', numericCount(row.purchases), numericCount(row.profiles), numericCount(data.approvedPurchases), percentage(row.purchases, data.approvedPurchases)]) },
      ...(coverage ? [
        { name: 'Histórico completo', headers: ['Toda a base importada', 'Quantidade'], rows: [['Registros recuperados', coverage.records], ['Vinculados a perfis ativos', coverage.linked], ['Respostas de pesquisa', coverage.surveys], ['Engajamentos registrados', coverage.engagements], ['Sem data na fonte', coverage.undated]].map(([label, value]) => [label, numericCount(value)]) },
        { name: 'Fontes históricas', headers: ['Fonte (toda a base importada)', 'Registros', 'Vinculados', 'Sem data'], rows: (coverage.sources || []).map(row => [row.source, numericCount(row.records), numericCount(row.linked), numericCount(row.undated)]) },
      ] : []),
    ],
  }
}
