# Gráficos e composição dos dashboards

A referência é o RevenueReference do RevOps da Masi, criado a partir do Viver de IA. O componente de curva já compartilhava a linguagem da referência; a diferença principal estava na hierarquia, no espaço dado ao gráfico e nas análises visuais complementares.

## Direção visual

Para gestores e vendedores acompanhando a operação durante o dia, em monitores e celulares: preservar a escolha entre tema claro e escuro. Superfícies claras/brancas e escuro grafite, com coral para receita, cyan para volume, lilás para séries complementares, âmbar para planejado e teal para composição. A tipografia existente (Outfit para títulos, Plus Jakarta Sans para leitura) mantém continuidade com o sistema aprovado.

O gráfico principal ocupa a maior parte do painel, com resumo contextual lateral nos períodos e nas metas. Gráficos secundários respondem a perguntas distintas: quais produtos, quais pagamentos, quais origens, qual entrega diária e distância da meta. Controles e descrições ficam alinhados ao painel correspondente. Evitar repetir cartões idênticos ou acrescentar gráficos sem denominador confiável.

## Entrega

- Diário: valor por hora/acumulado e volume em escalas separadas; ranking de produtos; mix de pagamentos e barras de UTMs, com detalhes preservados.
- Global, mensal e anual: painel de receita com resumo lateral e leitura por período/acumulado; volume, pagamentos, famílias, fontes e ranking por agrupamento.
- Ritmo: painel de realizado e planejado, entrega diária, distância acumulada do plano e ranking de atingimento, sem somar escopos independentes.
- Curvas em área, eixos com unidade, legenda interativa, pontos de foco, tooltip acessível por teclado; categorias com proporções, valores e nomes explícitos.

## Dados e desempenho

Nenhum endpoint, autorização, carregador ou contrato financeiro foi alterado. As novas visualizações usam os dados que cada tela já carrega. Valores ausentes não viram zero; lacunas interrompem o acumulado; horas/dias futuros não recebem realizado. Ajustes negativos não são convertidos em fatias positivas. Indicadores financeiros de venda e caixa permanecem separados.

## Verificação

Os testes locais de UI usam dados sintéticos e bloqueiam a rede externa. `npm run test:ui` cobre telas existentes, filtros, permissões, estados de fontes e a apresentação nova em desktop/celular nos dois temas. `tests/ui/analytics-smoke.mjs` registra screenshots, verifica geometria finita, teclado, seleção do mix e ausência de chamadas adicionais ao explorar gráficos.
