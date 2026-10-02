export const TV_PANELS = [
  { id: 'monthly-goal', title: 'Meta do mês', description: 'Resultado acumulado, objetivo e quanto falta para chegar lá.' },
  { id: 'pace', title: 'Ritmo da meta', description: 'Curva diária do realizado e do planejado, em tela ampla.' },
  { id: 'team-goals', title: 'Metas dos times', description: 'Avanço de cada time em relação ao seu próprio objetivo.' },
  { id: 'product-goals', title: 'Metas dos produtos', description: 'Realizado e meta de cada operação.' },
  { id: 'sellers', title: 'Top vendedores', description: 'Ranking de vendas atribuídas aos vendedores.' },
  { id: 'products', title: 'Top produtos', description: 'Os produtos com maior resultado no mês.' },
  { id: 'daily', title: 'Vendas do dia', description: 'Resultado de hoje e distribuição por hora, no horário de Brasília.' },
  { id: 'payment-mix', title: 'Meios de pagamento', description: 'Participação de cartão, boleto, Pix e outros meios.' },
]
export const TV_METRICS = { gross: 'Valor das vendas', cash: 'Cash collected · novas vendas', count: 'Quantidade de vendas' }
export function defaultTvSettings() {
  return { version: 1, mode: 'rotate', fixedPanel: 'monthly-goal', metric: 'gross', monthMode: 'current', month: '', theme: 'system', paceScope: 'overall', paceScopeId: '',
    panels: TV_PANELS.map((panel, index) => ({ id: panel.id, enabled: index < 6, durationSeconds: 20 })) }
}
export function activeTvPanels(settings) {
  const enabled = settings.panels.filter(panel => panel.enabled && TV_PANELS.some(item => item.id === panel.id))
  return settings.mode === 'fixed' ? enabled.filter(panel => panel.id === settings.fixedPanel) : enabled
}
export function tvMonthLabel(month) {
  return /^\d{4}-\d{2}$/.test(month || '') ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-15T12:00:00Z`)) : 'Mês atual'
}
