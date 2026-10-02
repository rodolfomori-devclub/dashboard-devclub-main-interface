import { useEffect, useState } from 'react'
import { Database, RefreshCw } from 'lucide-react'
import { requestApi } from '../lib/api'
const SOURCES = [
  ['guru','Guru','Vendas, descontos, afiliados e reembolsos. Todos os indicadores de vendas usam o líquido após taxas, calculado pela integração existente.'],
  ['hotmart','Hotmart','Vendas e compras com status de reembolso, incluindo Seu segundo salário com IA. Todos os indicadores de vendas usam o líquido após taxas.'],
  ['tmb','TMB','Contratos de boleto parcelado. O valor contratado é separado do caixa. Cancelamento de pedido não comprova devolução de dinheiro.'],
  ['asaas','Asaas','Vendas com entrada paga, contratos e recebimentos. A entrada e as parcelas recebidas permanecem separadas do valor contratado.'],
  ['boletex','Boletex','Vendas com entrada confirmada e recebimentos. Boletos apenas emitidos não contam como vendas.'],
  ['hub','Operação comercial','Materiais, metas comerciais, comissões, equipe e histórico do Hub. As vendas manuais e atribuições têm registro de auditoria.'],
]
export default function DataSourcesPage() {
  const [status,setStatus] = useState(null), [error,setError] = useState(''), [loading,setLoading] = useState(false)
  const load = async () => { setLoading(true);setError('');try {setStatus(await requestApi('/data-sources'))}catch(err){setError(err.message)}finally{setLoading(false)} }
  useEffect(()=>{void load()},[])
  return <div className="hub-page"><header className="page-heading"><div><h1>Fontes de dados</h1><p>Entenda a origem e o significado dos valores exibidos na operação.</p></div><button className="button" disabled={loading} onClick={load}><RefreshCw size={16}/>{loading?'Verificando…':'Verificar configuração'}</button></header>{error&&<div className="notice notice-error" role="alert">{error}</div>}<div className="notice">O estado abaixo indica configuração na API. A disponibilidade real é informada em cada consulta, junto dos dados; uma credencial configurada ainda pode estar expirada ou sem acesso.</div><div className="grid grid-cols-1 xl:grid-cols-2 gap-5">{SOURCES.map(([key,name,description])=><section className="surface-panel" key={key}><div className="flex items-center justify-between gap-4"><h2 className="text-lg flex items-center gap-2"><Database size={18}/>{name}</h2><span className="text-xs text-muted-foreground">{status?status[key]?'Configuração presente':'Configuração pendente':'Não verificada'}</span></div><p className="text-sm text-muted-foreground mt-4 leading-relaxed">{description}</p></section>)}</div><section className="surface-panel space-y-3"><h2 className="text-lg">Como interpretar os números</h2><p className="text-sm text-muted-foreground">Valor das vendas: Guru e Hotmart sempre usam o líquido após taxas; as demais plataformas usam o valor contratado. O cash collected permanece separado. Nenhum valor líquido ausente é estimado a partir do preço da compra. Falha de consulta e informação ausente aparecem explicitamente.</p><p className="text-sm text-muted-foreground">Filtros por família mantêm o nome original do produto disponível. UTMs ausentes são identificadas como “Não informado”. No acompanhamento de metas, escolha a mesma base financeira usada ao configurar o objetivo.</p></section></div>
}
