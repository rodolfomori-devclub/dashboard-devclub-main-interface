# Gráfico de Faixa de Lead Scoring

## Visão Geral

O gráfico de **Distribuição por Faixa de Lead Scoring** foi implementado para visualizar a distribuição dos leads por faixas de pontuação (A, B, C, D, E) nas planilhas de lead scoring.

## Headers Suportados

O sistema processa automaticamente as seguintes variações da coluna "Faixa":

- `Faixa`
- `FAIXA` 
- `faixa`
- `Faixa A`
- `Faixa B`
- `Faixa C`
- `Faixa D`
- `Faixa E`

## Funcionalidades

### 1. Processamento de Dados
- **Localização**: `src/services/leadScoringService.js`
- **Método**: `processCategoricalData()`
- **Ordenação**: As faixas são ordenadas automaticamente (A → B → C → D → E)

### 2. Visualização
- **Localização**: `src/pages/LeadScoringPage.jsx`
- **Tipos de Gráfico**: Barras empilhadas e Linhas
- **Cores Específicas**:
  - **Faixa A**: Verde forte (#37E359) - Melhor pontuação
  - **Faixa B**: Verde médio (#4CAF50) - Boa pontuação
  - **Faixa C**: Amarelo (#FFC107) - Pontuação média
  - **Faixa D**: Laranja/vermelho (#FF5722) - Pontuação baixa
  - **Faixa E**: Vermelho (#F44336) - Pontuação muito baixa

### 3. Interatividade
- **Alternância**: Botão para alternar entre gráfico de barras e linhas
- **Tooltip**: Mostra percentuais ao passar o mouse
- **Legenda**: Identifica cada faixa com sua cor correspondente

## Como Usar

1. Acesse a página de **Lead Scoring**
2. O gráfico aparecerá automaticamente se houver dados de faixa nas planilhas
3. Use o botão "BARRAS/LINHAS" para alternar entre os tipos de visualização
4. Passe o mouse sobre as barras/linhas para ver os percentuais detalhados

## Estrutura dos Dados

```javascript
{
  name: "Nome do Lançamento",
  "Faixa A": 25.5,  // Percentual de leads na faixa A
  "Faixa B": 30.2,  // Percentual de leads na faixa B
  "Faixa C": 20.1,  // Percentual de leads na faixa C
  "Faixa D": 15.3,  // Percentual de leads na faixa D
  "Faixa E": 8.9,   // Percentual de leads na faixa E
  totalLeads: 1000  // Total de leads do lançamento
}
```

## Headers da Planilha

O sistema é compatível com os seguintes headers das planilhas:

```
Data | Nome Completo | E-mail | Telefone | O seu gênero: | Qual estado você mora? | 
Qual a sua idade? | O que você faz atualmente? | Atualmente, qual a sua faixa salarial? | 
Você possui cartão de crédito? | Já estudou programação? | Você já fez/faz/pretende fazer faculdade? | 
Já investiu em algum curso online para aprender uma nova forma de ganhar dinheiro? | 
O que mais te chama atenção na profissão de Programador? | O que mais você quer ver no evento? | 
Source | Campaign | Medium | Content | Term | Tem computador/notebook? | Remote IP | 
User Agent | fbc | fbp | cidade | estado | pais | cep | externalid | Page URL | 
Pontuação | Score | Faixa | Faixa A | Faixa B | Faixa C | Faixa D
```

## Cache e Performance

- **Cache**: 5 minutos para dados das planilhas
- **Limpeza**: Use o botão de refresh para limpar o cache
- **Filtros**: Suporte para carregar últimos 10, 25, 50 ou todos os lançamentos

## Troubleshooting

### Gráfico não aparece
1. Verifique se a planilha tem a coluna "Faixa" ou variações
2. Confirme se há dados na coluna
3. Tente limpar o cache e recarregar

### Cores não correspondem
- As cores são aplicadas automaticamente baseadas no nome da faixa
- Faixas com "A" recebem verde, "B" verde médio, etc.

### Dados incorretos
- Verifique se a planilha está na aba "[LF] Pesquisa"
- Confirme se o link da planilha está correto na planilha principal 