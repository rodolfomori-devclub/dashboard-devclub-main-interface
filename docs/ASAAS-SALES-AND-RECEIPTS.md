# Asaas: vendas e recebimentos

O painel separa contratos confirmados criados no período, suas entradas e dinheiro recebido por faturas. O cash collected principal e as metas incluem somente as entradas confirmadas de novos contratos; o extrato de faturas não entra nessa soma, independentemente de conter vínculos de origem. Um pagamento de parcela não aumenta as vendas; as entradas não são somadas novamente ao extrato.

O extrato é detalhado em recebimentos vinculados a vendas do período, vendas anteriores e origem não identificada. A comparação acontece no período final selecionado, depois de juntar os snapshots. Uma venda dia 1 recebida dia 2 é anterior no diário do dia 2 e pertence ao mês quando o mês inteiro é selecionado.

O backend entrega fatos em `cashReceiptOrigins.rows` com receiptDate, saleDate, received e count. Não utilizamos criação ou vencimento da cobrança como data de venda. Snapshots antigos sem esses fatos mantêm o dinheiro em origem não identificada. Nenhum valor ausente é transformado em zero confirmado.

O calendário dos contratos nativos é o da consulta de origem; a interface não filtra novamente um timestamp convertido para outro fuso. Lançamentos manuais respeitam o período e continuam fora do extrato para evitar duplicidade. A seleção por produto/pagamento/UTM não rateia recebimentos sem atribuição.

Diário, Global e Mensal mostram o painel com os dados já carregados. O Anual conserva a consulta de recebimentos sob demanda e sua limitação de duas chamadas simultâneas. As origens de cada intervalo são reunidas e classificadas em relação ao ano, sem somar categorias previamente classificadas por semana. Contratos anuais Asaas permanecem não consultados nessa visão; esses recebimentos não alteram os indicadores operacionais anuais.

Na configuração atual de produção, o banco de checkout legado está desativado. O extrato permanece disponível, mas suas vendas e vínculos não podem ser comprovados: aparecem como não informados/origem não identificada. A classificação passa a usar os vínculos quando forem disponibilizados pela integração. Não há consulta externa extra, migração nem recarga em massa do histórico.
