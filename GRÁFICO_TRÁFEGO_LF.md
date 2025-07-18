# Gráfico de Gasto em Tráfego por LF

## 📊 Descrição

O gráfico de gasto em tráfego por LF (Lançamento de Funil) exibe os valores investidos em tráfego para cada lançamento, mostrando os gastos com anúncios e marketing digital.

## 🎯 Funcionalidades

### ✅ Recursos Implementados

- **Gasto em Tráfego**: Mostra o valor investido em tráfego por lançamento
- **Dados da Planilha Principal**: Busca dados da coluna "Tráfego" na planilha principal
- **Visualização Flexível**: Alternância entre gráficos de barras e linhas
- **Formatação Monetária**: Valores formatados em reais (R$)
- **Tooltips Informativos**: Exibição de valores monetários no hover
- **Ordenação Cronológica**: Mais antigo à esquerda, mais novo à direita

### 📈 Tipos de Gráfico

1. **Gráfico de Barras**
   - Cada barra representa um lançamento
   - Altura da barra = valor investido em tráfego
   - Cor roxa (#8B5CF6) para destaque

2. **Gráfico de Linhas**
   - Linha contínua mostrando evolução dos gastos
   - Permite visualizar tendências ao longo do tempo
   - Pontos destacados para cada lançamento

## 🔧 Como Usar

### 1. Acessar a Página
- Navegue até a página de **Lead Scoring**
- O gráfico de gasto em tráfego aparece após o gráfico de faturamento

### 2. Visualizar Dados
- Os dados são carregados automaticamente com os outros gráficos
- Não é necessário clicar em botões adicionais

### 3. Alternar Visualização
- Use o botão **"BARRAS/LINHAS"** para alternar entre os tipos de gráfico
- Barras: Melhor para comparação entre lançamentos
- Linhas: Melhor para visualizar tendências

## 📋 Estrutura de Dados

### Dados de Entrada (Planilha Principal)
```javascript
{
  'Lançamento': 'LF 15',
  'Tráfego': 'R$ 20.000,00'
}
```

### Dados de Saída (Processados)
```javascript
{
  name: 'LF 15',
  traffic: 20000,                    // Valor numérico
  trafficFormatted: 'R$ 20.000,00'   // Valor formatado
}
```

## 🔍 Fonte de Dados

### Planilha Principal
- **URL**: https://docs.google.com/spreadsheets/d/1kLgVsNcc8OmPMvxaTN7KM0cTB5hC0KtL02lSZMYRHBw/edit?gid=0#gid=0
- **Coluna**: "Tráfego" (coluna G)
- **Formato**: Valores monetários (R$ 20.000,00, R$ 25.000,00, etc.)

### Processamento
- **Conversão**: Valores monetários convertidos para números
- **Limpeza**: Remove R$, pontos, vírgulas e espaços
- **Validação**: Apenas valores positivos são processados

## 🎨 Cores e Estilo

### Cores dos Gráficos
- **Cor Principal**: `#8B5CF6` (Roxo)
- **Grid**: `#374151` (Cinza escuro)
- **Eixos**: `#9CA3AF` (Cinza claro)

### Formatação de Valores
- **Eixo Y**: Valores em milhares (R$ 20k, R$ 25k, etc.)
- **Tooltips**: Valores completos formatados (R$ 20.000,00)
- **Legenda**: "Gasto em Tráfego"

## ⚠️ Limitações e Considerações

### Limitações Atuais
1. **Dependência de Coluna**: Requer coluna "Tráfego" na planilha principal
2. **Formato Monetário**: Espera valores no formato brasileiro (R$ X.XXX,XX)
3. **Dados Únicos**: Apenas um valor por lançamento

### Requisitos
1. **Planilha Principal**: Deve conter coluna "Tráfego" com valores monetários
2. **Dados Válidos**: Valores monetários no formato correto
3. **Processamento**: Dados devem ser processados pelo sistema

## 🐛 Troubleshooting

### Problemas Comuns

#### 1. "Nenhum dado de tráfego encontrado"
**Causa**: Coluna "Tráfego" não existe na planilha principal
**Solução**: Verificar se a planilha contém coluna "Tráfego" com valores

#### 2. "Gráfico não aparece"
**Causa**: Dados não estão sendo processados corretamente
**Solução**: Verificar se os valores estão no formato monetário correto

#### 3. "Valores incorretos"
**Causa**: Formato monetário diferente do esperado
**Solução**: Padronizar formato para R$ X.XXX,XX

### Scripts de Debug
Execute no console do navegador:

```javascript
// Verificar dados de tráfego processados
checkMainSheetTrafficData()

// Verificar renderização do gráfico
checkTrafficExpenseGraphRendering()

// Verificar dados brutos da planilha principal
checkRawMainSheetData()

// Executar todas as verificações
runAllTrafficExpenseTests()
```

## 📈 Métricas Disponíveis

### Por Lançamento
- **Gasto em Tráfego**: Valor investido em anúncios
- **Comparação**: Comparação entre diferentes lançamentos
- **Evolução**: Tendência de gastos ao longo do tempo

### Análise Geral
- **Total Investido**: Soma de todos os gastos em tráfego
- **Média por LF**: Gasto médio por lançamento
- **Maior/Menor Gasto**: Extremos de investimento

## 🔄 Atualizações Futuras

### Melhorias Planejadas
1. **ROI por Lançamento**: Calcular retorno sobre investimento
2. **Comparação com Faturamento**: Relação gasto vs. receita
3. **Filtros Avançados**: Filtrar por período, valor mínimo/máximo
4. **Exportação**: Download dos dados em CSV/Excel
5. **Alertas**: Notificações de gastos acima do esperado

### Novos Recursos
1. **Custo por Lead**: Calcular custo por lead gerado
2. **Análise de Tendências**: Previsões baseadas em dados históricos
3. **Dashboard de Performance**: Resumo executivo de gastos
4. **Comparação entre Períodos**: Análise de evolução temporal
5. **Breakdown por Canal**: Separar gastos por fonte (Facebook, Google, etc.)

## 📊 Exemplo de Uso

### Cenário Típico
1. **Carregar Dados**: Acessar página de Lead Scoring
2. **Analisar Gastos**: Ver quanto foi investido em cada lançamento
3. **Identificar Tendências**: Observar se gastos estão aumentando/diminuindo
4. **Tomar Decisões**: Ajustar orçamento baseado na performance

### Insights Valiosos
- **Gastos crescentes**: Se gastos aumentam, verificar se faturamento acompanha
- **Eficiência**: Comparar gasto vs. faturamento por lançamento
- **Otimização**: Identificar lançamentos com melhor ROI
- **Planejamento**: Usar dados para planejar orçamentos futuros 