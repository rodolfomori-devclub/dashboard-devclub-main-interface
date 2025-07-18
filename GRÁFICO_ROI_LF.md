# Gráfico de Faturamento x Investimento em Tráfego (ROI & ROAS)

## 📊 Descrição

O gráfico de faturamento x investimento em tráfego por LF (Lançamento de Funil) exibe a comparação entre o faturamento gerado e o investimento em tráfego para cada lançamento, calculando automaticamente o ROI (Retorno sobre Investimento) e ROAS (Return on Ad Spend) de cada campanha.

## 🎯 Funcionalidades

### ✅ Recursos Implementados

- **Comparação Direta**: Mostra faturamento vs. investimento em tráfego
- **Cálculo de ROI**: Calcula automaticamente o retorno sobre investimento
- **Cálculo de ROAS**: Calcula automaticamente o retorno sobre gasto em anúncios
- **Visualização Flexível**: Alternância entre gráficos de barras e linhas
- **Resumo Estatístico**: ROI médio, ROAS médio, melhor ROI e lançamentos lucrativos
- **Formatação Monetária**: Valores formatados em reais (R$)
- **Tooltips Informativos**: Exibição de valores monetários no hover
- **Ordenação Cronológica**: Mais antigo à esquerda, mais novo à direita

### 📈 Tipos de Gráfico

1. **Gráfico de Barras Duplas**
   - Duas barras por lançamento (faturamento e investimento)
   - Faturamento em verde (#10B981)
   - Investimento em roxo (#8B5CF6)
   - Permite comparação visual direta

2. **Gráfico de Linhas**
   - Duas linhas mostrando evolução do faturamento e investimento
   - Permite visualizar tendências ao longo do tempo
   - Pontos destacados para cada lançamento

### 📊 Resumo de ROI e ROAS
- **ROI Médio**: Média de retorno sobre investimento de todos os lançamentos
- **ROAS Médio**: Média de retorno sobre gasto em anúncios
- **Melhor ROI**: Maior retorno sobre investimento alcançado
- **Lançamentos Lucrativos**: Quantidade de LFs com ROI positivo

## 🔧 Como Usar

### 1. Acessar a Página
- Navegue até a página de **Lead Scoring**
- O gráfico aparece após o gráfico de gasto em tráfego

### 2. Carregar Dados
- Clique em **"💰 Buscar Faturamento"** para carregar dados de faturamento
- Os dados de tráfego são carregados automaticamente

### 3. Visualizar Comparação
- O gráfico mostra faturamento (verde) vs. investimento (roxo)
- Barras mais altas = maiores valores
- ROI é calculado automaticamente

### 4. Alternar Visualização
- Use o botão **"BARRAS/LINHAS"** para alternar entre os tipos de gráfico
- Barras: Melhor para comparação entre lançamentos
- Linhas: Melhor para visualizar tendências

## 📋 Estrutura de Dados

### Dados de Entrada
```javascript
// Dados de faturamento (da API)
{
  launch: 'LF 15',
  revenue: 50000,
  cardRevenue: 30000,
  boletoRevenue: 20000
}

// Dados de tráfego (da planilha principal)
{
  name: 'LF 15',
  traffic: 20000,
  trafficFormatted: 'R$ 20.000,00'
}
```

### Dados de Saída (Processados)
```javascript
{
  name: 'LF 15',
  revenue: 50000,                    // Faturamento total
  traffic: 20000,                    // Investimento em tráfego
  roi: 150.0,                        // ROI em percentual
  roiFormatted: '+150.0%',           // ROI formatado
  roas: 2.5,                         // ROAS (faturamento/investimento)
  roasFormatted: '2.50x'             // ROAS formatado
}
```

## 🧮 Cálculo do ROI e ROAS

### Fórmulas
```
ROI = ((Faturamento - Investimento) / Investimento) × 100
ROAS = Faturamento / Investimento
```

### Exemplos
- **ROI Positivo**: Faturamento R$ 50.000, Investimento R$ 20.000 → ROI +150%, ROAS 2.50x
- **ROI Negativo**: Faturamento R$ 28.000, Investimento R$ 30.000 → ROI -6.7%, ROAS 0.93x
- **Break-even**: Faturamento R$ 20.000, Investimento R$ 20.000 → ROI 0%, ROAS 1.00x

### Diferença entre ROI e ROAS
- **ROI**: Mostra o percentual de lucro sobre o investimento
- **ROAS**: Mostra quantos reais de receita foram gerados para cada real investido

## 🎨 Cores e Estilo

### Cores dos Gráficos
- **Faturamento**: `#10B981` (Verde)
- **Investimento em Tráfego**: `#8B5CF6` (Roxo)
- **Grid**: `#374151` (Cinza escuro)
- **Eixos**: `#9CA3AF` (Cinza claro)

### Formatação de Valores
- **Eixo Y**: Valores em milhares (R$ 20k, R$ 50k, etc.)
- **Tooltips**: Valores completos formatados (R$ 20.000,00)
- **ROI**: Percentual com sinal (+150%, -6.7%)

## ⚠️ Limitações e Considerações

### Limitações Atuais
1. **Dependência de Dados**: Requer dados de faturamento e tráfego
2. **Lançamentos Completos**: Apenas LFs com ambos os dados são exibidos
3. **Cálculo Simples**: ROI básico, sem considerar outros custos

### Requisitos
1. **Dados de Faturamento**: Devem ser carregados via "Buscar Faturamento"
2. **Dados de Tráfego**: Devem estar na planilha principal
3. **Correspondência**: Nomes dos lançamentos devem coincidir

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. "Gráfico não aparece"
**Causa**: Dados de faturamento ou tráfego não carregados
**Solução**: Clique em "💰 Buscar Faturamento" e verifique dados de tráfego

#### 2. "Poucos lançamentos mostrados"
**Causa**: Falta correspondência entre dados de faturamento e tráfego
**Solução**: Verificar se nomes dos lançamentos coincidem

#### 3. "ROI incorreto"
**Causa**: Dados de faturamento ou investimento incorretos
**Solução**: Verificar valores nas APIs e planilha principal

### Scripts de Debug
Execute no console do navegador:

```javascript
// Verificar dados de ROI
checkROIData()

// Verificar renderização do gráfico
checkROIGraphRendering()

// Verificar dados de faturamento e tráfego
checkRevenueAndTrafficData()

// Executar todas as verificações
runAllROITests()
```

## 📈 Métricas Disponíveis

### Por Lançamento
- **Faturamento**: Valor total gerado
- **Investimento**: Valor gasto em tráfego
- **ROI**: Retorno sobre investimento em percentual
- **ROAS**: Retorno sobre gasto em anúncios (faturamento/investimento)
- **Lucratividade**: Se o lançamento foi lucrativo

### Análise Geral
- **ROI Médio**: Performance média de todos os lançamentos
- **ROAS Médio**: Eficiência média de conversão de investimento em receita
- **Melhor Performance**: Lançamento com maior ROI/ROAS
- **Taxa de Sucesso**: Percentual de lançamentos lucrativos

## 🔄 Atualizações Futuras

### Melhorias Planejadas
1. **ROI Detalhado**: Breakdown por fonte de tráfego
2. **Custo por Lead**: Calcular custo por lead gerado
3. **Análise de Tendências**: Previsões baseadas em dados históricos
4. **Filtros Avançados**: Filtrar por período, ROI mínimo, etc.
5. **Exportação**: Download dos dados em CSV/Excel

### Novos Recursos
1. **ROI Acumulado**: Evolução do ROI ao longo do tempo
2. **Comparação com Benchmarks**: ROI vs. média do mercado
3. **Alertas**: Notificações de ROI abaixo do esperado
4. **Dashboard Executivo**: Resumo de performance financeira
5. **Análise de Sazonalidade**: Variações de ROI por período

## 📊 Exemplo de Uso

### Cenário Típico
1. **Carregar Dados**: Clicar em "💰 Buscar Faturamento"
2. **Analisar Performance**: Ver qual lançamento teve melhor ROI
3. **Identificar Padrões**: Observar tendências de performance
4. **Tomar Decisões**: Ajustar estratégias baseado no ROI

### Insights Valiosos
- **ROI Alto**: Lançamentos com ROI > 100% são muito eficientes
- **ROI Baixo**: Lançamentos com ROI < 0% precisam de otimização
- **Consistência**: Lançamentos com ROI estável são mais previsíveis
- **Escalabilidade**: Lançamentos com bom ROI podem ser replicados

## 💡 Dicas de Análise

### Interpretação do ROI
- **ROI > 100%**: Excelente retorno (mais que dobra o investimento)
- **ROI 50-100%**: Bom retorno (lucro significativo)
- **ROI 0-50%**: Retorno positivo (mas pode ser otimizado)
- **ROI < 0%**: Prejuízo (precisa de revisão da estratégia)

### Interpretação do ROAS
- **ROAS > 3x**: Excelente eficiência (mais de 3 reais de receita por real investido)
- **ROAS 2-3x**: Boa eficiência (2-3 reais de receita por real investido)
- **ROAS 1-2x**: Eficiência aceitável (1-2 reais de receita por real investido)
- **ROAS < 1x**: Ineficiência (menos de 1 real de receita por real investido)

### Ações Baseadas no ROI e ROAS
- **ROI Alto + ROAS Alto**: Aumentar investimento, replicar estratégia
- **ROI Médio + ROAS Médio**: Otimizar campanhas, testar novas abordagens
- **ROI Baixo + ROAS Baixo**: Revisar estratégia, reduzir investimento
- **ROI Negativo + ROAS < 1x**: Pausar campanha, reestruturar completamente 