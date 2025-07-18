# Gráfico de Faturamento por LF

## 📊 Descrição

O gráfico de faturamento por LF (Lançamento de Funil) exibe o faturamento total de cada lançamento, separado por método de pagamento (Cartão via GURU e Boleto via TMB).

## 🎯 Funcionalidades

### ✅ Recursos Implementados

- **Faturamento por LF**: Busca dados usando as datas de abertura e fechamento de cada lançamento
- **Integração com APIs**: 
  - **GURU**: Transações de cartão de crédito
  - **TMB**: Vendas via boleto
- **Visualização Flexível**: Alternância entre gráficos de barras e linhas
- **Dados Detalhados**: Separação por método de pagamento
- **Formatação Monetária**: Valores formatados em Real (R$)
- **Tooltips Informativos**: Exibição de valores detalhados no hover

### 📈 Tipos de Gráfico

1. **Gráfico de Barras Empilhadas**
   - Barras azuis: Faturamento via Cartão (GURU)
   - Barras amarelas: Faturamento via Boleto (TMB)
   - Total visualizado como altura da barra

2. **Gráfico de Linhas**
   - Linha azul: Faturamento via Cartão (GURU)
   - Linha amarela: Faturamento via Boleto (TMB)
   - Linha verde: Faturamento Total

## 🔧 Como Usar

### 1. Acessar a Página
- Navegue até a página de **Lead Scoring**
- O gráfico de faturamento aparece logo após o gráfico de faixa

### 2. Carregar Dados
- Clique no botão **"💰 Buscar Faturamento"**
- O sistema buscará automaticamente os dados para todos os lançamentos carregados
- O processo pode levar alguns minutos dependendo do número de lançamentos

### 3. Alternar Visualização
- Use o botão **"BARRAS/LINHAS"** para alternar entre os tipos de gráfico
- Barras: Melhor para comparação entre lançamentos
- Linhas: Melhor para visualizar tendências

## 📋 Estrutura de Dados

### Dados de Entrada (Planilha Principal)
```javascript
{
  'Lançamento': 'LF 123',
  'Início Captação': '2024-01-01',
  'Fim Captação': '2024-01-31',
  'Link Planilha': 'https://docs.google.com/spreadsheets/...'
}
```

### Dados de Saída (API)
```javascript
{
  launch: 'LF 123',
  openDate: '2024-01-01',
  closeDate: '2024-01-31',
  revenue: 50000.00,           // Faturamento total
  cardRevenue: 35000.00,       // Faturamento via cartão
  boletoRevenue: 15000.00,     // Faturamento via boleto
  totalSales: 25,              // Total de vendas
  cardSales: 18,               // Vendas via cartão
  boletoSales: 7,              // Vendas via boleto
  dailyData: [...],            // Dados diários
  period: { startDate, endDate }
}
```

## 🔌 Integração com APIs

### GURU (Cartão de Crédito)
- **Endpoint**: `/transactions`
- **Filtros**: `ordered_at_ini` e `ordered_at_end`
- **Dados**: Transações aprovadas com cálculo de valor líquido

### TMB (Boleto)
- **Fonte**: Google Sheets
- **Planilha ID**: `1jPCyVkRImt8yYPgMlBAeMZPqwdyQvy9P_KpWmo2PHBU`
- **Dados**: Vendas processadas via boleto

## 🎨 Cores e Estilo

### Cores dos Gráficos
- **Cartão (GURU)**: `#3B82F6` (Azul)
- **Boleto (TMB)**: `#F59E0B` (Amarelo/Laranja)
- **Total**: `#10B981` (Verde)

### Formatação de Valores
- **Eixo Y**: Valores em milhares (R$ 50k, R$ 100k)
- **Tooltips**: Valores completos formatados (R$ 50.000,00)
- **Legenda**: Métodos de pagamento claramente identificados

## ⚠️ Limitações e Considerações

### Limitações Atuais
1. **Dependência de Datas**: Requer datas de abertura e fechamento na planilha principal
2. **Tempo de Carregamento**: Pode ser lento para muitos lançamentos
3. **Cache**: Dados não são cacheados automaticamente

### Requisitos
1. **Planilha Principal**: Deve conter colunas "Início Captação" e "Fim Captação"
2. **APIs Ativas**: GURU e TMB devem estar funcionando
3. **Permissões**: Acesso às APIs e planilhas

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. "Datas não encontradas"
**Causa**: Colunas de data não existem na planilha principal
**Solução**: Verificar se as colunas "Início Captação" e "Fim Captação" existem

#### 2. "Erro ao buscar dados de faturamento"
**Causa**: Problema de conectividade com as APIs
**Solução**: Verificar se as APIs GURU e TMB estão funcionando

#### 3. "Nenhum dado encontrado"
**Causa**: Período sem vendas ou dados não processados
**Solução**: Verificar se há vendas no período especificado

### Scripts de Debug
Execute no console do navegador:

```javascript
// Verificar datas dos lançamentos
checkLaunchDates()

// Testar faturamento por período
testRevenueByPeriod()

// Testar faturamento por LF
testRevenueByLaunch()
```

## 📈 Métricas Disponíveis

### Por Lançamento
- **Faturamento Total**: Soma de cartão + boleto
- **Faturamento Cartão**: Apenas transações GURU
- **Faturamento Boleto**: Apenas vendas TMB
- **Total de Vendas**: Quantidade de transações
- **Vendas por Método**: Separação cartão/boleto

### Por Período
- **Dados Diários**: Faturamento dia a dia
- **Tendências**: Visualização de crescimento/queda
- **Comparação**: Entre diferentes lançamentos

## 🔄 Atualizações Futuras

### Melhorias Planejadas
1. **Cache Inteligente**: Cache automático dos dados de faturamento
2. **Filtros Avançados**: Por período, método de pagamento, etc.
3. **Exportação**: Download dos dados em CSV/Excel
4. **Alertas**: Notificações de faturamento baixo/alto
5. **Comparação**: Gráficos comparativos entre lançamentos

### Novos Recursos
1. **ROI por LF**: Cálculo de retorno sobre investimento
2. **Tendências**: Análise de crescimento ao longo do tempo
3. **Previsões**: Estimativas baseadas em dados históricos
4. **Dashboard Executivo**: Resumo para tomada de decisão 