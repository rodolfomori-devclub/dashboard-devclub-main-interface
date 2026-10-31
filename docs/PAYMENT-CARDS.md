# Carregamento e detalhamento por meio de pagamento

Os cards mostram skeleton e Carregando valor enquanto o valor do período é consultado. Atualizações do mesmo período preservam o dado anterior com Atualizando. Valores zero confirmados continuam zero; dados ausentes/erro não permanecem em um loading infinito.

Por instrução de Rodolfo, em todas as telas (Diário, mensal, anual, comparativos e TV), toda venda Guru/Hotmart entra em Cartão e toda venda TMB/Boletex entra em Boleto, independentemente do pagamento original, inclusive Pix, Apple Pay, outros ou não informado. Lançamentos manuais dessas plataformas seguem a mesma categoria. As demais fontes, inclusive Asaas, preservam o meio informado; não são excluídas.

`salesPaymentLabel` em `platformCash.js` centraliza a categoria usada por filtros, opções, gráficos, breakdowns e TV. O campo `payment` e o payload original permanecem intactos nos registros, detalhes e exportações. Quantidade e valor entram uma única vez. O líquido Guru/Hotmart e as demais regras financeiras não mudam. Plataformas sem registros naquela categoria não ganham linhas vazias; falhas de fontes continuam sinalizando cobertura incompleta.

Boleto exibe por plataforma:

- Valor bruto: bruto dos contratos/vendas selecionados.
- Cash collected: 40% do bruto TMB e caixa manual declarado conforme as regras existentes. Asaas inclui somente a entrada de novos contratos; o extrato de faturas fica fora do card geral e das metas. Recebimento acumulado Boletex não vira caixa do período.
- Entrada recebida: só o campo confirmado do contrato Asaas legado, quando disponível. Dados ausentes ficam Não informado, sem estimar a partir do caixa ou entrada prevista.

Auditoria somente leitura do cache existente: 645 pedidos TMB têm valor_entrada mas não confirmação de recebimento desse valor; isConfirmed/data_efetivado não são prova de entrada paga. Em 1.550 contratos Boletex, entryValue inclui entrada e parcelas acumuladas, sem separar a entrada. Asaas em produção está sem checkout/contratos, disponibilizando apenas recebimentos do extrato. Guru, Hotmart e manuais também não informam entrada recebida separada.

O detalhamento usa os dados já carregados, sem novas chamadas. Totais principais de receita e caixa são preservados.
