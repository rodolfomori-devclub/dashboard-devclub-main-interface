// Script para verificar o status dos dados de ROI
// Execute este script no console do navegador

console.log('🔍 Verificando status dos dados de ROI...');

// Função para verificar se os dados estão disponíveis
function checkROIStatus() {
  console.log('📊 Verificando dados disponíveis...');
  
  // Verificar dados de tráfego
  if (window.processedData && window.processedData.trafficByLaunch) {
    console.log('✅ Dados de tráfego encontrados:', window.processedData.trafficByLaunch.length, 'lançamentos');
    console.log('📋 Primeiros 3 lançamentos com tráfego:');
    window.processedData.trafficByLaunch.slice(0, 3).forEach(item => {
      console.log(`  - ${item.name}: R$ ${item.traffic.toFixed(2)}`);
    });
  } else {
    console.log('❌ Dados de tráfego não encontrados');
    console.log('💡 Verifique se os dados foram carregados corretamente');
  }
  
  // Verificar dados de faturamento
  if (window.revenueData && window.revenueData.length > 0) {
    console.log('✅ Dados de faturamento encontrados:', window.revenueData.length, 'lançamentos');
    console.log('📋 Primeiros 3 lançamentos com faturamento:');
    window.revenueData.slice(0, 3).forEach(item => {
      console.log(`  - ${item.launch}: R$ ${item.revenue.toFixed(2)}`);
    });
  } else {
    console.log('❌ Dados de faturamento não encontrados');
    console.log('💡 Clique em "💰 Buscar Faturamento" para carregar os dados');
  }
  
  // Verificar dados de ROI
  if (window.roiData && window.roiData.length > 0) {
    console.log('✅ Dados de ROI encontrados:', window.roiData.length, 'lançamentos');
    console.log('📋 Primeiros 3 lançamentos com ROI:');
    window.roiData.slice(0, 3).forEach(item => {
      console.log(`  - ${item.name}: ROI ${item.roiFormatted}, ROAS ${item.roasFormatted}`);
    });
  } else {
    console.log('❌ Dados de ROI não encontrados');
    console.log('💡 Os dados de ROI são calculados quando há dados de faturamento E tráfego');
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkROIGraphRendering() {
  console.log('🎨 Verificando renderização do gráfico de ROI...');
  
  const graphHeaders = Array.from(document.querySelectorAll('h2'));
  let roiGraphFound = false;
  
  graphHeaders.forEach(header => {
    if (header.textContent.includes('Faturamento x Investimento')) {
      roiGraphFound = true;
      console.log('✅ Gráfico de ROI encontrado na página');
    }
  });
  
  if (!roiGraphFound) {
    console.log('❌ Gráfico de ROI não encontrado na página');
    console.log('💡 Possíveis causas:');
    console.log('   - Dados de faturamento não carregados');
    console.log('   - Dados de tráfego não carregados');
    console.log('   - Nenhum lançamento com dados completos');
  }
}

// Função para simular o carregamento de dados
function simulateDataLoading() {
  console.log('🧪 Simulando carregamento de dados...');
  
  // Simular dados de tráfego
  const mockTrafficData = [
    { name: 'LF 15', traffic: 20000 },
    { name: 'LF 20', traffic: 25000 },
    { name: 'LF 25', traffic: 30000 }
  ];
  
  // Simular dados de faturamento
  const mockRevenueData = [
    { launch: 'LF 15', revenue: 50000 },
    { launch: 'LF 20', revenue: 35000 },
    { launch: 'LF 25', revenue: 28000 }
  ];
  
  // Calcular ROI e ROAS
  const mockROIData = mockRevenueData.map(revenueItem => {
    const trafficItem = mockTrafficData.find(t => t.name === revenueItem.launch);
    if (trafficItem) {
      const roi = ((revenueItem.revenue - trafficItem.traffic) / trafficItem.traffic) * 100;
      const roas = revenueItem.revenue / trafficItem.traffic;
      return {
        name: revenueItem.launch,
        revenue: revenueItem.revenue,
        traffic: trafficItem.traffic,
        roi: roi,
        roiFormatted: `${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`,
        roas: roas,
        roasFormatted: `${roas.toFixed(2)}x`
      };
    }
    return null;
  }).filter(item => item !== null);
  
  console.log('📊 Dados simulados criados:');
  mockROIData.forEach(item => {
    console.log(`  - ${item.name}: ROI ${item.roiFormatted}, ROAS ${item.roasFormatted}`);
  });
  
  return mockROIData;
}

// Função para verificar correspondência entre dados
function checkDataMatching() {
  console.log('🔍 Verificando correspondência entre dados...');
  
  if (!window.processedData?.trafficByLaunch || !window.revenueData) {
    console.log('❌ Dados insuficientes para verificar correspondência');
    return;
  }
  
  const trafficLaunches = window.processedData.trafficByLaunch.map(t => t.name);
  const revenueLaunches = window.revenueData.map(r => r.launch);
  
  console.log('📋 Lançamentos com dados de tráfego:', trafficLaunches);
  console.log('📋 Lançamentos com dados de faturamento:', revenueLaunches);
  
  const matchingLaunches = trafficLaunches.filter(t => revenueLaunches.includes(t));
  console.log('✅ Lançamentos com dados completos:', matchingLaunches);
  
  if (matchingLaunches.length === 0) {
    console.log('❌ Nenhum lançamento com dados completos encontrado');
    console.log('💡 Verifique se os nomes dos lançamentos coincidem');
  } else {
    console.log(`✅ ${matchingLaunches.length} lançamentos podem gerar dados de ROI`);
  }
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar status dos dados:
   - Execute: checkROIStatus()

2. Verificar renderização do gráfico:
   - Execute: checkROIGraphRendering()

3. Verificar correspondência entre dados:
   - Execute: checkDataMatching()

4. Simular dados:
   - Execute: simulateDataLoading()

5. Executar todas as verificações:
   - Execute: runAllROIStatusChecks()
`);

// Função para executar todas as verificações
function runAllROIStatusChecks() {
  console.log('🧪 Executando todas as verificações de status do ROI...');
  
  console.log('\n=== VERIFICAÇÃO 1: Status dos dados ===');
  checkROIStatus();
  
  console.log('\n=== VERIFICAÇÃO 2: Renderização ===');
  checkROIGraphRendering();
  
  console.log('\n=== VERIFICAÇÃO 3: Correspondência ===');
  checkDataMatching();
  
  console.log('\n=== VERIFICAÇÃO 4: Simulação ===');
  simulateDataLoading();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
checkROIStatus(); 