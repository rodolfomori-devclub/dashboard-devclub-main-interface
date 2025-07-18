// Script de debug para testar o processamento da coluna faixa
// Execute este script no console do navegador na página de Lead Scoring

console.log('🔍 Iniciando debug da coluna faixa...');

// Função para verificar se há dados de faixa sendo processados
function debugFaixaData() {
  console.log('📊 Verificando dados processados...');
  
  // Tentar acessar os dados processados
  if (window.processedData) {
    console.log('✅ Dados processados encontrados:', window.processedData);
    console.log('🔍 Dados de faixa:', window.processedData.faixaByLaunch);
    console.log('🔍 Length de faixa:', window.processedData.faixaByLaunch?.length);
  } else {
    console.log('⚠️ Dados processados não encontrados no window');
  }
  
  // Verificar se há dados de todos os lançamentos
  if (window.allLaunchesData) {
    console.log('✅ Dados de todos os lançamentos encontrados');
    console.log('📊 Total de lançamentos:', window.allLaunchesData.launches?.length);
    
    // Verificar headers de cada lançamento
    window.allLaunchesData.launches?.forEach((launch, index) => {
      console.log(`🔍 Lançamento ${index + 1}: ${launch['Lançamento']}`);
      
      if (launch.sheetData && launch.sheetData.headers) {
        console.log(`📋 Headers disponíveis:`, launch.sheetData.headers);
        
        // Procurar por colunas relacionadas a faixa
        const faixaHeaders = launch.sheetData.headers.filter(header => 
          header.toLowerCase().includes('faixa') || 
          header.toLowerCase().includes('score') ||
          header.toLowerCase().includes('pontuação')
        );
        
        if (faixaHeaders.length > 0) {
          console.log(`✅ Colunas de faixa encontradas:`, faixaHeaders);
          
          // Verificar dados da primeira coluna de faixa
          const firstFaixaHeader = faixaHeaders[0];
          const faixaData = launch.sheetData.data.map(row => row[firstFaixaHeader]).filter(val => val);
          console.log(`📊 Dados da coluna "${firstFaixaHeader}":`, faixaData);
          console.log(`📊 Total de valores não vazios:`, faixaData.length);
        } else {
          console.log(`❌ Nenhuma coluna de faixa encontrada`);
        }
      } else {
        console.log(`❌ Sem dados de planilha`);
      }
    });
  } else {
    console.log('⚠️ Dados de todos os lançamentos não encontrados');
  }
}

// Função para testar o processamento manual
function testFaixaProcessing() {
  console.log('🧪 Testando processamento manual...');
  
  // Simular dados de teste
  const testLaunch = {
    'Lançamento': 'Teste LF',
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
  };
  
  console.log('📊 Dados de teste:', testLaunch);
  
  // Tentar processar usando o serviço
  if (window.leadScoringService) {
    const testData = { launches: [testLaunch] };
    const processed = window.leadScoringService.processDataForCharts(testData);
    console.log('✅ Resultado do processamento:', processed);
    console.log('🔍 Dados de faixa processados:', processed.faixaByLaunch);
  } else {
    console.log('⚠️ Serviço leadScoringService não encontrado');
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkFaixaGraphRendering() {
  console.log('🔍 Verificando renderização do gráfico de faixa...');
  
  // Verificar se o elemento do gráfico existe
  const graphContainer = document.querySelector('h2');
  if (graphContainer) {
    const faixaTitle = Array.from(graphContainer.parentElement.parentElement.querySelectorAll('h2')).find(h2 => 
      h2.textContent.includes('Faixa')
    );
    
    if (faixaTitle) {
      console.log('✅ Título do gráfico de faixa encontrado:', faixaTitle.textContent);
      console.log('✅ Container do gráfico:', faixaTitle.closest('.bg-white'));
    } else {
      console.log('❌ Título do gráfico de faixa não encontrado');
    }
  }
  
  // Verificar se há elementos de gráfico
  const chartElements = document.querySelectorAll('.recharts-wrapper');
  console.log('📊 Total de elementos de gráfico encontrados:', chartElements.length);
  
  chartElements.forEach((element, index) => {
    const container = element.closest('.bg-white');
    const title = container?.querySelector('h2')?.textContent;
    console.log(`📊 Gráfico ${index + 1}: ${title}`);
  });
}

// Executar todas as verificações
console.log('🚀 Executando verificações...');

debugFaixaData();
testFaixaProcessing();
checkFaixaGraphRendering();

console.log(`
📋 RESUMO DO DEBUG:

1. Verifique os logs acima para entender se:
   - Os dados estão sendo carregados
   - As colunas de faixa existem nas planilhas
   - O processamento está funcionando
   - O gráfico está sendo renderizado

2. Possíveis problemas:
   - Coluna "Faixa" não existe nas planilhas
   - Dados vazios na coluna faixa
   - Erro no processamento
   - Problema na renderização

3. Próximos passos:
   - Verifique se as planilhas têm a coluna "Faixa"
   - Confirme se há dados na coluna
   - Tente limpar o cache e recarregar
   - Verifique os logs no console
`); 