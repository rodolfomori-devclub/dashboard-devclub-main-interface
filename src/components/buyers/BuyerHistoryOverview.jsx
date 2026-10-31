/* eslint-disable react/prop-types -- Display components accept the validated aggregate overview only. */
import { count, dateLabel, percentage } from './buyerIntelligence'

const importStatus = { COMPLETED: 'Concluída', FAILED: 'Não concluída', RUNNING: 'Em andamento', PENDING: 'Aguardando' }
const signals = [
  { field: 'approvedWithPriorHistoricalInteraction', label: 'Interação histórica', note: 'Inscrição, pesquisa respondida ou engajamento registrado.' },
  { field: 'approvedWithPriorHistoricalSurvey', label: 'Pesquisa respondida', note: 'Ao menos uma resposta registrada antes do pedido.' },
  { field: 'approvedWithPriorHistoricalUtm', label: 'UTM histórica', note: 'Origem observada no histórico; não comprova atribuição.' },
  { field: 'approvedWithPriorHistoricalCampaignMembership', label: 'Em lista de campanha', note: 'Estar numa lista não comprova inscrição, presença ou interação.' },
]

export function BuyerHistoryOverview({ data }) {
  const coverage = data.historicalCoverage
  return <section className="surface-panel buyers-history" aria-label="Histórico recuperado">
    <header><h2>Histórico recuperado</h2><p>Inscrições, pesquisas e interações recuperadas das fontes históricas. A cobertura abaixo considera toda a base importada, independentemente do período dos pedidos.</p></header>
    {!coverage ? <p className="buyers-empty">A cobertura histórica ainda não está disponível nesta consulta.</p> : <>
      <dl className="buyers-history-totals">
        <div><dt>Registros recuperados</dt><dd>{count(coverage.records)}</dd><small>{count(coverage.linked)} vinculados a perfis ativos · {percentage(coverage.linked, coverage.records)}</small></div>
        <div><dt>Respostas de pesquisa</dt><dd>{count(coverage.surveys)}</dd><small>Registros, não respondentes únicos.</small></div>
        <div><dt>Engajamentos registrados</dt><dd>{count(coverage.engagements)}</dd><small>Envios de mensagens não contam como interação.</small></div>
        <div><dt>Sem data na fonte</dt><dd>{count(coverage.undated)}</dd><small>Não entram nas métricas anteriores à compra.</small></div>
      </dl>
      {coverage.sources.length > 0 ? <table className="data-table buyers-history-table"><caption>Cobertura por fonte histórica · toda a base importada</caption><thead><tr><th scope="col">Fonte</th><th scope="col">Registros</th><th scope="col">Vinculados</th><th scope="col">Sem data</th></tr></thead><tbody>{coverage.sources.map(row => <tr key={row.source}><th scope="row">{row.source}</th><td>{count(row.records)}</td><td>{count(row.linked)}</td><td>{count(row.undated)}</td></tr>)}</tbody></table> : <p className="buyers-empty">Nenhum histórico recuperado registrado na base.</p>}
      <div className="buyers-history-signals"><h3>Sinais históricos anteriores à compra</h3><p>Recorte dos pedidos selecionados: base de {count(data.approvedLinkedPurchases)} pedidos aprovados com perfil. As categorias podem se sobrepor e não devem ser somadas às inscrições acima.</p><div className="buyers-metric-grid">{signals.map(signal => <article className="buyers-metric" key={signal.field}><h4>{signal.label}</h4><strong>{percentage(data[signal.field], data.approvedLinkedPurchases)}</strong><p>{count(data[signal.field])} de {count(data.approvedLinkedPurchases)} pedidos</p><small>{signal.note}</small></article>)}</div><p className="buyers-denominator">Só registros com data demonstravelmente anterior ao pedido entram nessa leitura. Observações sem horário contam apenas quando seu dia já havia terminado antes da compra.</p></div>
    </>}
    <p className="buyers-denominator">{data.lastHistoricalImport ? `Última recuperação: ${dateLabel(data.lastHistoricalImport.completedAt, true)} · ${importStatus[data.lastHistoricalImport.status] || data.lastHistoricalImport.status}` : 'Nenhuma importação de histórico recuperado registrada.'}</p>
  </section>
}

export function BuyerProductOverview({ data }) {
  const rows = data.productDistribution, catalog = data.productCatalog
  return <section className="surface-panel buyers-catalog" aria-label="Produtos nos pedidos aprovados"><header><h2>Produtos nos pedidos aprovados</h2><p>Produtos identificados no catálogo comum das plataformas integradas. Formações podem ter ofertas anuais, vitalícias, renovações ou upgrades; os detalhes originais ficam preservados nas fichas.</p></header>
    {!rows || !catalog ? <p className="buyers-empty">O catálogo de produtos ainda não está disponível nesta consulta.</p> : <>
      <p className="buyers-catalog-coverage"><strong>{percentage(catalog.approvedMapped, data.approvedPurchases)}</strong><span>{count(catalog.approvedMapped)} de {count(data.approvedPurchases)} pedidos aprovados com produto identificado no período.</span></p>
      {rows.length > 0 ? <table className="data-table buyers-product-table"><caption>Distribuição por produto · período dos pedidos selecionado</caption><thead><tr><th scope="col">Produto</th><th scope="col">Pedidos</th><th scope="col">Perfis</th><th scope="col">Da base</th></tr></thead><tbody>{rows.map(row => <tr key={`${row.classification}:${row.code || ''}`} className={row.classification === 'MAPPED' ? undefined : 'buyers-product-pending'}><th scope="row">{row.classification === 'MAPPED' ? row.name : row.classification === 'REVIEW_REQUIRED' ? 'Produto em revisão' : 'Produto não mapeado'}{row.classification !== 'MAPPED' && <small>{row.classification === 'REVIEW_REQUIRED' ? 'A oferta exige confirmação da formação.' : 'Sem correspondência aprovada no catálogo.'}</small>}</th><td>{count(row.purchases)}</td><td>{count(row.profiles)}</td><td>{percentage(row.purchases, data.approvedPurchases)}</td></tr>)}</tbody></table> : <p className="buyers-empty">Nenhum pedido aprovado neste período para distribuir por produto.</p>}
      <p className="buyers-denominator">Base de comparação: {count(data.approvedPurchases)} pedidos aprovados, incluindo os sem perfil. Um mesmo perfil pode aparecer em vários produtos. Os pedidos entre plataformas podem conter duplicidades; esta tabela não consolida receita.</p>
    </>}
  </section>
}
