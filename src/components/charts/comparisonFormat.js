// How a comparison reads, shared by the Comparativo and the agent. No JSX, so both
// the screens and their unit tests can import it.
export const COMPARISON_COLORS = { a: '#335cff', b: '#8a72ba' }
export const dateLabel = value => value.split('-').reverse().join('/')
export const rangeLabel = range => range.startDate === range.endDate ? dateLabel(range.startDate) : `${dateLabel(range.startDate)} a ${dateLabel(range.endDate)}`
export const format = (value, unit = 'currency') => value == null ? '—' : new Intl.NumberFormat('pt-BR', unit === 'currency' ? { style: 'currency', currency: 'BRL' } : { maximumFractionDigits: 1 }).format(value)
const signed = (value, unit) => value == null ? '—' : `${value > 0 ? '+' : ''}${format(value, unit)}`
export const sourceStatus = value => ({ ready: 'Disponível', partial: 'Parcial', unavailable: 'Indisponível' })[value] || 'Indisponível'
/** A variation is suspended, never estimated, when a side is missing or partial. */
export function deltaParts(delta, unit = 'currency') {
  if (delta?.absolute == null) return { suspended: delta?.reason === 'partial' ? 'Dados parciais' : 'Sem dados comparáveis' }
  return { value: signed(delta.absolute, unit), detail: delta.percent === null ? 'Base B igual a zero · % indisponível' : `${delta.percent > 0 ? '+' : ''}${format(delta.percent, 'count')}%` }
}
export const PRIMARY_METRICS = [
  ['revenue', 'Receita operacional', 'currency'], ['count', 'Vendas', 'count'], ['ticket', 'Ticket médio', 'currency'],
  ['gross', 'Valor das vendas', 'currency'], ['net', 'Líquido informado', 'currency'], ['received', 'Recebimentos das vendas', 'currency'],
]
export const DETAIL_METRICS = [
  ['digital', 'Receita digital (Guru + Hotmart + Hubla)', 'currency'], ['digitalCount', 'Vendas digitais', 'count'],
  ['boleto', 'Receita de boleto (TMB, Asaas e Boletex)', 'currency'], ['boletoCount', 'Vendas de boleto', 'count'],
  ['commercial', 'Receita do comercial identificado', 'currency'], ['commercialCount', 'Vendas do comercial identificado', 'count'],
  ['affiliate', 'Afiliação informada', 'currency'], ['fees', 'Taxas informadas', 'currency'],
  ['listPrice', 'Preço de tabela · demais plataformas', 'currency'], ['pending', 'Pendente informado', 'currency'],
  ['dailyRevenue', 'Receita média por dia', 'currency'], ['dailyCount', 'Vendas médias por dia', 'count'],
  ['dailyBoleto', 'Receita de boleto média por dia', 'currency'], ['dailyBoletoCount', 'Vendas de boleto médias por dia', 'count'],
]
