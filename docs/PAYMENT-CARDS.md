# Carregamento e detalhamento por meio de pagamento

Os cards mostram skeleton e Carregando valor enquanto o valor do período é consultado. Atualizações do mesmo período preservam o dado anterior com Atualizando. Valores zero confirmados continuam zero; dados ausentes/erro não permanecem em um loading infinito.

Cartão e Boleto listam somente plataformas que possuem registros daquele meio no recorte atual. Guru/Hotmart podem aparecer em ambos quando existem vendas reais nos dois meios. Pix e meios desconhecidos continuam separados. Plataformas sem registros naquele meio não ganham linhas vazias, mas falhas de fontes ainda sinalizam a cobertura do total. Manuais são agrupados pela plataforma declarada e respeitam o meio informado.

Boleto exibe por plataforma:

- Valor bruto: bruto dos contratos/vendas selecionados.
- Cash collected: líquido integral Guru/Hotmart, 40% do bruto TMB, caixa manual declarado conforme as regras existentes. Asaas inclui somente a entrada de novos contratos; o extrato de faturas fica fora do card geral e das metas. Recebimento acumulado Boletex não vira caixa do período.
- Entrada recebida: só o campo confirmado do contrato Asaas legado, quando disponível. Dados ausentes ficam Não informado, sem estimar a partir do caixa ou entrada prevista.

Auditoria somente leitura do cache existente: 645 pedidos TMB têm valor_entrada mas não confirmação de recebimento desse valor; isConfirmed/data_efetivado não são prova de entrada paga. Em 1.550 contratos Boletex, entryValue inclui entrada e parcelas acumuladas, sem separar a entrada. Asaas em produção está sem checkout/contratos, disponibilizando apenas recebimentos do extrato. Guru, Hotmart e manuais também não informam entrada recebida separada.

O detalhamento usa os dados já carregados, sem novas chamadas. Totais principais de receita e caixa são preservados.
