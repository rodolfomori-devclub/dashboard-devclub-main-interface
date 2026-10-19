# Carregamento e detalhamento por meio de pagamento

Os cards mostram skeleton e Carregando valor enquanto o valor do período é consultado. Atualizações do mesmo período preservam o dado anterior com Atualizando. Valores zero confirmados continuam zero; dados ausentes/erro não permanecem em um loading infinito.

Desde 19/10/2026, Cartão é uma categoria comercial: reúne todas as vendas de Guru e Hotmart, independentemente de cartão, Pix, boleto, Apple Pay ou meio não informado. Os valores líquidos e quantidades entram uma única vez; esses registros não reaparecem em Boleto, Pix ou Outros. Manuais atribuídos a Guru/Hotmart seguem a mesma regra. As demais fontes mantêm a classificação pelo meio informado.

A regra é compartilhada pelos cards, gráficos, filtros e agrupamentos de Diário, Global, Mensal, Anual, Comparativos e TV autenticada/pública. O pagamento original permanece nos registros e no CSV. Fontes sem vendas não ganham linhas fictícias; fontes indisponíveis e valores ausentes continuam indicando cobertura parcial.

Boleto exibe por plataforma:

- Valor bruto: bruto dos contratos/vendas selecionados.
- Cash collected: líquido integral Guru/Hotmart, 40% do bruto TMB, caixa manual declarado conforme as regras existentes. Asaas inclui somente a entrada de novos contratos; o extrato de faturas fica fora do card geral e das metas. Recebimento acumulado Boletex não vira caixa do período.
- Entrada recebida: só o campo confirmado do contrato Asaas legado, quando disponível. Dados ausentes ficam Não informado, sem estimar a partir do caixa ou entrada prevista.

Auditoria somente leitura do cache existente: 645 pedidos TMB têm valor_entrada mas não confirmação de recebimento desse valor; isConfirmed/data_efetivado não são prova de entrada paga. Em 1.550 contratos Boletex, entryValue inclui entrada e parcelas acumuladas, sem separar a entrada. Asaas em produção está sem checkout/contratos, disponibilizando apenas recebimentos do extrato. Guru, Hotmart e manuais também não informam entrada recebida separada.

O detalhamento usa os dados já carregados, sem novas chamadas. Totais principais de receita e caixa são preservados.
