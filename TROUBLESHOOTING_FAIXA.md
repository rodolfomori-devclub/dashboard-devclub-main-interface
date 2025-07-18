# 🔧 Troubleshooting - Gráfico de Faixa de Lead Scoring

## ❌ Problema: Gráfico não aparece

### 🔍 Passo 1: Verificar Console do Navegador

1. **Abra o Console do Navegador** (F12 → Console)
2. **Procure por logs específicos**:
   ```
   🔍 Dados de faixa: [...]
   🔍 Dados de faixa length: X
   🔍 Condição para mostrar gráfico de faixa: true/false
   ```

### 🔍 Passo 2: Verificar Dados das Planilhas

1. **Execute o script de debug** no console:
   ```javascript
   // Cole e execute o conteúdo do arquivo debug-faixa.js
   ```

2. **Verifique se as colunas existem**:
   - `Faixa`
   - `FAIXA`
   - `faixa`
   - `Faixa A`, `Faixa B`, `Faixa C`, `Faixa D`, `Faixa E`
   - `Score`
   - `Pontuação`

### 🔍 Passo 3: Verificar Estrutura das Planilhas

**Headers esperados nas planilhas:**
```
Data | Nome Completo | E-mail | Telefone | ... | Faixa | Faixa A | Faixa B | Faixa C | Faixa D
```

**Verificar se:**
- ✅ Planilha está na aba `[LF] Pesquisa`
- ✅ Link da planilha está correto na planilha principal
- ✅ Coluna "Faixa" existe e tem dados
- ✅ Dados não estão vazios

### 🔍 Passo 4: Testar Processamento Manual

1. **No console do navegador, execute:**
   ```javascript
   // Verificar se o serviço está disponível
   console.log('Serviço disponível:', typeof leadScoringService !== 'undefined');
   
   // Verificar dados processados
   console.log('Dados processados:', processedData);
   console.log('Dados de faixa:', processedData?.faixaByLaunch);
   ```

### 🔍 Passo 5: Verificar Renderização

1. **Verificar se o elemento existe:**
   ```javascript
   // Procurar por título do gráfico
   const faixaTitle = document.querySelector('h2');
   console.log('Títulos encontrados:', Array.from(document.querySelectorAll('h2')).map(h => h.textContent));
   ```

2. **Verificar se há elementos de gráfico:**
   ```javascript
   const charts = document.querySelectorAll('.recharts-wrapper');
   console.log('Total de gráficos:', charts.length);
   ```

## 🛠️ Soluções Comuns

### ❌ Problema: Coluna "Faixa" não encontrada

**Solução:**
1. Verifique se a coluna existe na planilha
2. Confirme o nome exato da coluna (maiúsculas/minúsculas)
3. Adicione variações do nome no código se necessário

### ❌ Problema: Dados vazios na coluna

**Solução:**
1. Verifique se há dados na coluna "Faixa"
2. Confirme se os dados não são apenas espaços em branco
3. Verifique se há pelo menos alguns registros com valores

### ❌ Problema: Erro no processamento

**Solução:**
1. Limpe o cache: Clique em "Atualizar"
2. Recarregue a página
3. Verifique os logs de erro no console

### ❌ Problema: Gráfico não renderiza

**Solução:**
1. Verifique se há outros gráficos aparecendo
2. Confirme se o React está funcionando
3. Verifique se há erros de JavaScript

## 📋 Checklist de Verificação

- [ ] Console do navegador aberto
- [ ] Logs de debug executados
- [ ] Coluna "Faixa" existe na planilha
- [ ] Dados não estão vazios
- [ ] Planilha na aba correta `[LF] Pesquisa`
- [ ] Link da planilha correto
- [ ] Cache limpo
- [ ] Página recarregada
- [ ] Outros gráficos aparecem

## 🚨 Logs de Erro Comuns

### "Campo não encontrado"
```
🔍 Campo não encontrado para: ['Faixa', 'FAIXA', 'faixa', ...]
🔍 Headers disponíveis: ['Data', 'Nome', 'Email', ...]
```
**Solução:** Adicionar o nome correto da coluna

### "Nenhum dado de faixa encontrado"
```
⚠️ Nenhum dado de faixa encontrado para LF123
🔍 Headers disponíveis: ['Faixa', 'Nome', 'Email']
```
**Solução:** Verificar se há dados na coluna

### "Dados processados vazios"
```
🔍 Dados de faixa: []
🔍 Dados de faixa length: 0
```
**Solução:** Verificar processamento e dados das planilhas

## 📞 Próximos Passos

Se nenhuma solução funcionar:

1. **Execute o script de debug completo**
2. **Copie os logs do console**
3. **Verifique a estrutura das planilhas**
4. **Teste com dados de exemplo**

## 🧪 Teste Rápido

Execute no console para testar:
```javascript
// Teste básico
console.log('Dados processados:', processedData);
console.log('Faixa data:', processedData?.faixaByLaunch);
console.log('Faixa length:', processedData?.faixaByLaunch?.length);
``` 