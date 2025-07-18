// Script para testar o gráfico de gasto em tráfego da planilha principal
// Execute este script no console do navegador

console.log('🚦 Testando gráfico de gasto em tráfego da planilha principal...');

// Função para verificar dados de tráfego da planilha principal
function checkMainSheetTrafficData() {
  console.log('📊 Verificando dados de tráfego da planilha principal...');
  
  if (!processedData || !processedData.trafficByLaunch) {
    console.log('❌ Dados de tráfego não encontrados');
    return;
  }
  
  console.log('✅ Dados de tráfego encontrados:', processedData.trafficByLaunch);
  console.log(`📊 Total de lançamentos com dados de tráfego: ${processedData.trafficByLaunch.length}`);
  
  if (processedData.trafficByLaunch.length > 0) {
    console.log('📋 Estrutura do primeiro item:');
    const firstItem = processedData.trafficByLaunch[0];
    console.log(firstItem);
    
    // Mostrar dados dos primeiros 10 lançamentos
    console.log('📊 Primeiros 10 lançamentos:');
    processedData.trafficByLaunch.slice(0, 10).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}: R$ ${item.traffic.toFixed(2)}`);
    });
    
    // Calcular estatísticas
    const totalTraffic = processedData.trafficByLaunch.reduce((sum, item) => sum + item.traffic, 0);
    const avgTraffic = totalTraffic / processedData.trafficByLaunch.length;
    const maxTraffic = Math.max(...processedData.trafficByLaunch.map(item => item.traffic));
    const minTraffic = Math.min(...processedData.trafficByLaunch.map(item => item.traffic));
    
    console.log('\n📈 Estatísticas de gasto em tráfego:');
    console.log(`  Total gasto: R$ ${totalTraffic.toFixed(2)}`);
    console.log(`  Média por LF: R$ ${avgTraffic.toFixed(2)}`);
    console.log(`  Maior gasto: R$ ${maxTraffic.toFixed(2)}`);
    console.log(`  Menor gasto: R$ ${minTraffic.toFixed(2)}`);
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkTrafficExpenseGraphRendering() {
  console.log('🎨 Verificando renderização do gráfico de gasto em tráfego...');
  
  // Verificar se o elemento do gráfico existe
  const graphContainer = document.querySelector('h2');
  let trafficGraphFound = false;
  
  if (graphContainer) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach(header => {
      if (header.textContent.includes('Gasto em Tráfego')) {
        trafficGraphFound = true;
        console.log('✅ Gráfico de gasto em tráfego encontrado na página');
      }
    });
  }
  
  if (!trafficGraphFound) {
    console.log('❌ Gráfico de gasto em tráfego não encontrado na página');
    console.log('💡 Verifique se os dados de tráfego estão sendo processados corretamente');
  }
}

// Função para verificar dados brutos da planilha principal
function checkRawMainSheetData() {
  console.log('📋 Verificando dados brutos da planilha principal...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return;
  }
  
  const launchesWithTraffic = [];
  
  allLaunchesData.launches.forEach(launch => {
    const trafficValue = launch['Tráfego'] || launch['Trafico'] || launch['tráfego'] || launch['trafico'];
    
    if (trafficValue) {
      // Converter valor monetário para número
      let numericValue = 0;
      
      if (typeof trafficValue === 'string') {
        const cleanValue = trafficValue.replace(/[R$\s.]/g, '').replace(',', '.');
        numericValue = parseFloat(cleanValue);
      } else if (typeof trafficValue === 'number') {
        numericValue = trafficValue;
      }
      
      if (!isNaN(numericValue) && numericValue > 0) {
        launchesWithTraffic.push({
          launch: launch['Lançamento'],
          rawValue: trafficValue,
          numericValue: numericValue
        });
      }
    }
  });
  
  console.log(`📊 Lançamentos com dados de tráfego na planilha principal: ${launchesWithTraffic.length}`);
  
  if (launchesWithTraffic.length > 0) {
    console.log('✅ Primeiros 10 lançamentos com dados de tráfego:');
    launchesWithTraffic.slice(0, 10).forEach(item => {
      console.log(`  - ${item.launch}: "${item.rawValue}" → R$ ${item.numericValue.toFixed(2)}`);
    });
  } else {
    console.log('❌ Nenhum lançamento com dados de tráfego encontrado na planilha principal');
  }
  
  return launchesWithTraffic;
}

// Função para simular dados de tráfego
function simulateTrafficExpenseData() {
  console.log('🧪 Simulando dados de gasto em tráfego...');
  
  const simulatedData = [
    {
      name: 'LF 15',
      traffic: 20000,
      trafficFormatted: 'R$ 20.000,00'
    },
    {
      name: 'LF 20',
      traffic: 25000,
      trafficFormatted: 'R$ 25.000,00'
    },
    {
      name: 'LF 25',
      traffic: 30000,
      trafficFormatted: 'R$ 30.000,00'
    }
  ];
  
  console.log('📊 Dados simulados:', simulatedData);
  
  // Verificar se os dados estão no formato correto
  const isValid = simulatedData.every(item => 
    item.name && 
    typeof item.traffic === 'number' &&
    item.traffic > 0 &&
    item.trafficFormatted
  );
  
  if (isValid) {
    console.log('✅ Dados simulados estão no formato correto');
  } else {
    console.log('❌ Dados simulados têm formato incorreto');
  }
  
  return simulatedData;
}

// Função para formatar valor monetário
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2
  }).format(value || 0);
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar dados de tráfego processados:
   - Execute: checkMainSheetTrafficData()

2. Verificar renderização do gráfico:
   - Execute: checkTrafficExpenseGraphRendering()

3. Verificar dados brutos da planilha principal:
   - Execute: checkRawMainSheetData()

4. Simular dados de tráfego:
   - Execute: simulateTrafficExpenseData()

5. Executar todas as verificações:
   - Execute: runAllTrafficExpenseTests()
`);

// Função para executar todas as verificações
function runAllTrafficExpenseTests() {
  console.log('🧪 Executando todas as verificações do gráfico de gasto em tráfego...');
  
  console.log('\n=== VERIFICAÇÃO 1: Dados processados ===');
  checkMainSheetTrafficData();
  
  console.log('\n=== VERIFICAÇÃO 2: Renderização ===');
  checkTrafficExpenseGraphRendering();
  
  console.log('\n=== VERIFICAÇÃO 3: Dados brutos ===');
  checkRawMainSheetData();
  
  console.log('\n=== VERIFICAÇÃO 4: Simulação ===');
  simulateTrafficExpenseData();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
if (processedData && processedData.trafficByLaunch) {
  checkMainSheetTrafficData();
} else {
  console.log('💡 Para testar, primeiro carregue os dados na página de Lead Scoring');
} 