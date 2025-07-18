// Script de teste para o gráfico de faixa de lead scoring
// Execute este script no console do navegador na página de Lead Scoring

console.log('🧪 Iniciando teste do gráfico de faixa...');

// Função para testar o processamento de dados
function testFaixaProcessing() {
  console.log('📊 Testando processamento de dados de faixa...');
  
  // Simular dados de teste
  const testData = {
    launches: [
      {
        'Lançamento': 'Teste Lançamento 1',
        sheetData: {
          headers: ['Faixa', 'Nome', 'Email'],
          data: [
            { 'Faixa': 'A', 'Nome': 'João', 'Email': 'joao@teste.com' },
            { 'Faixa': 'B', 'Nome': 'Maria', 'Email': 'maria@teste.com' },
            { 'Faixa': 'A', 'Nome': 'Pedro', 'Email': 'pedro@teste.com' },
            { 'Faixa': 'C', 'Nome': 'Ana', 'Email': 'ana@teste.com' },
            { 'Faixa': 'B', 'Nome': 'Carlos', 'Email': 'carlos@teste.com' }
          ]
        }
      },
      {
        'Lançamento': 'Teste Lançamento 2',
        sheetData: {
          headers: ['FAIXA', 'Nome', 'Email'],
          data: [
            { 'FAIXA': 'A', 'Nome': 'João', 'Email': 'joao@teste.com' },
            { 'FAIXA': 'D', 'Nome': 'Maria', 'Email': 'maria@teste.com' },
            { 'FAIXA': 'B', 'Nome': 'Pedro', 'Email': 'pedro@teste.com' },
            { 'FAIXA': 'E', 'Nome': 'Ana', 'Email': 'ana@teste.com' }
          ]
        }
      }
    ]
  };

  // Importar o serviço (se disponível)
  if (typeof window !== 'undefined' && window.leadScoringService) {
    const processedData = window.leadScoringService.processDataForCharts(testData);
    console.log('✅ Dados processados:', processedData.faixaByLaunch);
    return processedData.faixaByLaunch;
  } else {
    console.log('⚠️ Serviço leadScoringService não encontrado');
    return null;
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkFaixaGraph() {
  console.log('🔍 Verificando se o gráfico de faixa está sendo renderizado...');
  
  // Verificar se o elemento do gráfico existe
  const graphContainer = document.querySelector('[data-testid="faixa-graph"]') || 
                        document.querySelector('.bg-white.dark\\:bg-gray-800.p-6.rounded-lg.shadow.mb-6');
  
  if (graphContainer) {
    console.log('✅ Container do gráfico encontrado');
    
    // Verificar se há dados sendo exibidos
    const chartElement = graphContainer.querySelector('.recharts-wrapper');
    if (chartElement) {
      console.log('✅ Elemento do gráfico encontrado');
      return true;
    } else {
      console.log('⚠️ Elemento do gráfico não encontrado');
      return false;
    }
  } else {
    console.log('⚠️ Container do gráfico não encontrado');
    return false;
  }
}

// Função para verificar os dados processados
function checkProcessedData() {
  console.log('🔍 Verificando dados processados...');
  
  // Tentar acessar os dados processados (se disponível no React DevTools)
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools disponível');
  }
  
  // Verificar no console se há logs de processamento
  console.log('📋 Verifique os logs acima para informações sobre o processamento');
}

// Executar testes
console.log('🚀 Executando testes...');

// Teste 1: Processamento de dados
const testResult = testFaixaProcessing();

// Teste 2: Verificação do gráfico
const graphExists = checkFaixaGraph();

// Teste 3: Verificação de dados processados
checkProcessedData();

// Resumo dos testes
console.log('📋 RESUMO DOS TESTES:');
console.log(`- Processamento de dados: ${testResult ? '✅ OK' : '❌ FALHOU'}`);
console.log(`- Gráfico renderizado: ${graphExists ? '✅ OK' : '❌ FALHOU'}`);

if (testResult && graphExists) {
  console.log('🎉 Todos os testes passaram! O gráfico de faixa está funcionando corretamente.');
} else {
  console.log('⚠️ Alguns testes falharam. Verifique os logs acima para mais detalhes.');
}

// Instruções para o usuário
console.log(`
📖 INSTRUÇÕES PARA USO:

1. Acesse a página de Lead Scoring
2. Verifique se o gráfico "Distribuição por Faixa de Lead Scoring" aparece
3. Use o botão "BARRAS/LINHAS" para alternar entre visualizações
4. Passe o mouse sobre as barras/linhas para ver os percentuais
5. Verifique se as cores correspondem às faixas (A=Verde, B=Verde médio, etc.)

🔧 SE O GRÁFICO NÃO APARECER:
1. Verifique se as planilhas têm a coluna "Faixa" ou variações
2. Confirme se há dados na coluna
3. Tente limpar o cache e recarregar a página
4. Verifique os logs no console para debug
`); 