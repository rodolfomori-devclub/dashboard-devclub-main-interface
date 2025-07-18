// Script para testar o gráfico de tráfego
// Execute este script no console do navegador

console.log('🚦 Testando gráfico de tráfego...');

// Função para verificar dados de tráfego
function checkTrafficData() {
  console.log('📊 Verificando dados de tráfego...');
  
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
    
    // Verificar fontes de tráfego
    const trafficSources = Object.keys(firstItem).filter(key => key !== 'name' && key !== 'totalTraffic');
    console.log('🚦 Fontes de tráfego encontradas:', trafficSources);
    
    // Mostrar dados dos primeiros 5 lançamentos
    console.log('📊 Primeiros 5 lançamentos:');
    processedData.trafficByLaunch.slice(0, 5).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}:`);
      trafficSources.forEach(source => {
        if (item[source]) {
          console.log(`    - ${source}: ${item[source]}%`);
        }
      });
    });
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkTrafficGraphRendering() {
  console.log('🎨 Verificando renderização do gráfico de tráfego...');
  
  // Verificar se o elemento do gráfico existe
  const graphContainer = document.querySelector('h2');
  let trafficGraphFound = false;
  
  if (graphContainer) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach(header => {
      if (header.textContent.includes('Fonte de Tráfego')) {
        trafficGraphFound = true;
        console.log('✅ Gráfico de tráfego encontrado na página');
      }
    });
  }
  
  if (!trafficGraphFound) {
    console.log('❌ Gráfico de tráfego não encontrado na página');
    console.log('💡 Verifique se os dados de tráfego estão sendo processados corretamente');
  }
}

// Função para simular dados de tráfego
function simulateTrafficData() {
  console.log('🧪 Simulando dados de tráfego...');
  
  const simulatedData = [
    {
      name: 'LF 15',
      'Facebook': 45.2,
      'Google': 32.1,
      'Instagram': 15.7,
      'Outros': 7.0,
      totalTraffic: 100
    },
    {
      name: 'LF 20',
      'Facebook': 38.5,
      'Google': 28.9,
      'Instagram': 22.3,
      'TikTok': 10.3,
      totalTraffic: 100
    },
    {
      name: 'LF 25',
      'Facebook': 52.1,
      'Google': 25.4,
      'Instagram': 12.8,
      'YouTube': 9.7,
      totalTraffic: 100
    }
  ];
  
  console.log('📊 Dados simulados:', simulatedData);
  
  // Verificar se os dados estão no formato correto
  const isValid = simulatedData.every(item => 
    item.name && 
    typeof item.totalTraffic === 'number' &&
    Object.keys(item).some(key => key !== 'name' && key !== 'totalTraffic')
  );
  
  if (isValid) {
    console.log('✅ Dados simulados estão no formato correto');
  } else {
    console.log('❌ Dados simulados têm formato incorreto');
  }
  
  return simulatedData;
}

// Função para verificar processamento de dados
function checkTrafficProcessing() {
  console.log('🔄 Verificando processamento de dados de tráfego...');
  
  if (!allLaunchesData || !allLaunchesData.launches) {
    console.log('❌ Dados de lançamentos não encontrados');
    return;
  }
  
  const launchesWithTraffic = [];
  
  allLaunchesData.launches.forEach(launch => {
    if (launch.sheetData && launch.sheetData.headers) {
      // Procurar por colunas relacionadas a tráfego
      const trafficFields = ['Fonte', 'fonte', 'Source', 'source', 'Canal', 'canal'];
      const trafficField = trafficFields.find(field => launch.sheetData.headers.includes(field));
      
      if (trafficField) {
        console.log(`✅ Campo de tráfego encontrado para ${launch['Lançamento']}: "${trafficField}"`);
        
        // Contar valores únicos
        const uniqueValues = new Set();
        launch.sheetData.data.forEach(lead => {
          if (lead[trafficField]) {
            uniqueValues.add(lead[trafficField].trim());
          }
        });
        
        if (uniqueValues.size > 0) {
          launchesWithTraffic.push({
            launch: launch['Lançamento'],
            field: trafficField,
            sources: Array.from(uniqueValues),
            count: uniqueValues.size
          });
        }
      }
    }
  });
  
  console.log(`📊 Lançamentos com dados de tráfego: ${launchesWithTraffic.length}`);
  
  if (launchesWithTraffic.length > 0) {
    console.log('✅ Detalhes dos lançamentos com tráfego:');
    launchesWithTraffic.slice(0, 5).forEach(item => {
      console.log(`  - ${item.launch}: ${item.sources.join(', ')} (${item.count} fontes)`);
    });
  } else {
    console.log('❌ Nenhum lançamento com dados de tráfego encontrado');
  }
  
  return launchesWithTraffic;
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar dados de tráfego:
   - Execute: checkTrafficData()

2. Verificar renderização do gráfico:
   - Execute: checkTrafficGraphRendering()

3. Simular dados de tráfego:
   - Execute: simulateTrafficData()

4. Verificar processamento:
   - Execute: checkTrafficProcessing()

5. Executar todas as verificações:
   - Execute: runAllTrafficGraphTests()
`);

// Função para executar todas as verificações
function runAllTrafficGraphTests() {
  console.log('🧪 Executando todas as verificações do gráfico de tráfego...');
  
  console.log('\n=== VERIFICAÇÃO 1: Dados de tráfego ===');
  checkTrafficData();
  
  console.log('\n=== VERIFICAÇÃO 2: Renderização ===');
  checkTrafficGraphRendering();
  
  console.log('\n=== VERIFICAÇÃO 3: Simulação ===');
  simulateTrafficData();
  
  console.log('\n=== VERIFICAÇÃO 4: Processamento ===');
  checkTrafficProcessing();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
if (processedData && processedData.trafficByLaunch) {
  checkTrafficData();
} else {
  console.log('💡 Para testar, primeiro carregue os dados na página de Lead Scoring');
} 