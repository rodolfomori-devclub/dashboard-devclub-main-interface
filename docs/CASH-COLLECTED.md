# Cash collected por plataforma

A partir de 2026-10-01, Guru e Hotmart contribuem com 100% do líquido de cada venda, na data da venda. O backend já calcula ou recebe esse líquido; a interface não aplica novamente taxas, percentuais ou comissões. É uma definição operacional do indicador, não a data do repasse bancário.

- Guru: mantém o cálculo existente do servidor (MDR, antecipação, processamento, transferência e afiliação).
- Hotmart: usa a comissão PRODUCER informada pela plataforma. Líquido ausente permanece desconhecido; não é substituído por bruto menos taxa estimada. Taxas variam por transação; não há dedução fixa de 6% no frontend.
- TMB: mantém 40% do bruto vendido, arredondado por venda.
- Asaas: somente a entrada confirmada de novos contratos. O extrato de faturas, inclusive quando traz vínculo com um contrato, fica separado dos cards principais e das metas. Nunca substitui uma entrada não informada.
- Boletex: o acumulado recebido de contratos não representa caixa do período; continua fora do indicador.
- Vendas manuais: mantêm o caixa declarado e a proteção contra duplicidade por conciliação. A regra específica da TMB permanece aplicável aos manuais dessa plataforma; manuais Asaas usam o caixa declarado da nova venda, sem somar o extrato.

Guru e Hotmart usam o mesmo valor líquido nos cards, filtros, snapshots de atribuição e ritmo das metas geral/produto/time/indivíduo. A data ISO é interpretada no calendário de São Paulo.

## Moedas e cobertura

Cada campo Hotmart tem moeda própria: compra (`currency`), produtor (`netCurrency`) e taxa (`feeCurrency`). Apenas os campos em BRL entram em totais denominados em reais. Valores em USD/EUR ou outras moedas permanecem no registro original, mas não são convertidos nem tratados como R$. A contagem de vendas permanece disponível, com cobertura parcial e notificação sobre moedas.

A API identifica o contrato como `financialSchemaVersion: 2`, informa cobertura por campo e renova somente snapshots antigos da Hotmart. No frontend, resumos legados que misturam moedas não geram saldos agregados fictícios. Falhas, líquido ausente, zero confirmado e consulta vazia continuam distinguíveis.

## Conferência real

Em 28/09/2026, uma venda DevClub de R$ 1.997,00 tinha taxa Hotmart de R$ 114,32 (5,6% + R$ 2,49) e comissão líquida PRODUCER de R$ 1.882,68. A taxa efetiva foi aproximadamente 5,72%. Outras vendas históricas apresentaram taxas diferentes e, em alguns casos, participação de afiliado ou add-on.

A conferência usou consultas somente leitura e relatórios sanitizados; nenhuma venda, meta ou atribuição foi criada para o teste.

A partir de 01/10/2026, o cash collected operacional representa somente novas vendas. Exemplo de regressão: Hotmart R$ 833,64 e faturas Asaas R$ 1.255,36 resultam em cash collected principal de R$ 833,64. As faturas permanecem no painel separado. A regra vale nos períodos e em todos os escopos das metas.
