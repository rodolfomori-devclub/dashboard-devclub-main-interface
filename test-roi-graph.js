// Script para testar o gráfico de faturamento x investimento em tráfego
// Execute este script no console do navegador

console.log('📊 Testando gráfico de faturamento x investimento em tráfego...');

// Função para verificar dados de ROI
function checkROIData() {
  console.log('📊 Verificando dados de ROI...');
  
  if (!roiData || roiData.length === 0) {
    console.log('❌ Dados de ROI não encontrados');
    console.log('💡 Execute primeiro "💰 Buscar Faturamento" para carregar os dados');
    return;
  }
  
  console.log('✅ Dados de ROI encontrados:', roiData);
  console.log(`📊 Total de lançamentos com dados de ROI: ${roiData.length}`);
  
  if (roiData.length > 0) {
    console.log('📋 Estrutura do primeiro item:');
    const firstItem = roiData[0];
    console.log(firstItem);
    
    // Mostrar dados dos primeiros 10 lançamentos
    console.log('📊 Primeiros 10 lançamentos:');
    roiData.slice(0, 10).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name}:`);
      console.log(`    - Faturamento: R$ ${item.revenue.toFixed(2)}`);
      console.log(`    - Investimento: R$ ${item.traffic.toFixed(2)}`);
      console.log(`    - ROI: ${item.roiFormatted}`);
      console.log(`    - ROAS: ${item.roasFormatted}`);
    });
    
    // Calcular estatísticas
    const totalRevenue = roiData.reduce((sum, item) => sum + item.revenue, 0);
    const totalInvestment = roiData.reduce((sum, item) => sum + item.traffic, 0);
    const avgROI = roiData.reduce((sum, item) => sum + item.roi, 0) / roiData.length;
    const avgROAS = roiData.reduce((sum, item) => sum + item.roas, 0) / roiData.length;
    const maxROI = Math.max(...roiData.map(item => item.roi));
    const maxROAS = Math.max(...roiData.map(item => item.roas));
    const minROI = Math.min(...roiData.map(item => item.roi));
    const minROAS = Math.min(...roiData.map(item => item.roas));
    const profitableLaunches = roiData.filter(item => item.roi > 0).length;
    
    console.log('\n📈 Estatísticas de ROI e ROAS:');
    console.log(`  Faturamento Total: R$ ${totalRevenue.toFixed(2)}`);
    console.log(`  Investimento Total: R$ ${totalInvestment.toFixed(2)}`);
    console.log(`  ROI Médio: ${avgROI > 0 ? '+' : ''}${avgROI.toFixed(1)}%`);
    console.log(`  ROAS Médio: ${avgROAS.toFixed(2)}x`);
    console.log(`  Melhor ROI: ${maxROI > 0 ? '+' : ''}${maxROI.toFixed(1)}%`);
    console.log(`  Melhor ROAS: ${maxROAS.toFixed(2)}x`);
    console.log(`  Pior ROI: ${minROI > 0 ? '+' : ''}${minROI.toFixed(1)}%`);
    console.log(`  Pior ROAS: ${minROAS.toFixed(2)}x`);
    console.log(`  Lançamentos Lucrativos: ${profitableLaunches}/${roiData.length}`);
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkROIGraphRendering() {
  console.log('🎨 Verificando renderização do gráfico de ROI...');
  
  // Verificar se o elemento do gráfico existe
  const graphContainer = document.querySelector('h2');
  let roiGraphFound = false;
  
  if (graphContainer) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach(header => {
      if (header.textContent.includes('Faturamento x Investimento')) {
        roiGraphFound = true;
        console.log('✅ Gráfico de ROI encontrado na página');
      }
    });
  }
  
  if (!roiGraphFound) {
    console.log('❌ Gráfico de ROI não encontrado na página');
    console.log('💡 Verifique se os dados de faturamento e tráfego estão sendo processados corretamente');
  }
}

// Função para verificar dados de faturamento e tráfego
function checkRevenueAndTrafficData() {
  console.log('📋 Verificando dados de faturamento e tráfego...');
  
  let revenueData = null;
  let trafficData = null;
  
  // Verificar dados de faturamento
  if (window.revenueData && window.revenueData.length > 0) {
    revenueData = window.revenueData;
    console.log('✅ Dados de faturamento encontrados:', revenueData.length, 'lançamentos');
  } else {
    console.log('❌ Dados de faturamento não encontrados');
  }
  
  // Verificar dados de tráfego
  if (window.processedData && window.processedData.trafficByLaunch && window.processedData.trafficByLaunch.length > 0) {
    trafficData = window.processedData.trafficByLaunch;
    console.log('✅ Dados de tráfego encontrados:', trafficData.length, 'lançamentos');
  } else {
    console.log('❌ Dados de tráfego não encontrados');
  }
  
  // Verificar correspondência
  if (revenueData && trafficData) {
    const matchingLaunches = revenueData.filter(revenue => 
      trafficData.some(traffic => traffic.name === revenue.launch)
    );
    
    console.log(`📊 Lançamentos com dados completos: ${matchingLaunches.length}`);
    
    if (matchingLaunches.length > 0) {
      console.log('✅ Primeiros 5 lançamentos com dados completos:');
      matchingLaunches.slice(0, 5).forEach(item => {
        const trafficItem = trafficData.find(t => t.name === item.launch);
        const roi = ((item.revenue - trafficItem.traffic) / trafficItem.traffic) * 100;
        console.log(`  - ${item.launch}: Faturamento R$ ${item.revenue.toFixed(2)}, Tráfego R$ ${trafficItem.traffic.toFixed(2)}, ROI ${roi > 0 ? '+' : ''}${roi.toFixed(1)}%`);
      });
    }
  }
}

// Função para simular dados de ROI
function simulateROIData() {
  console.log('🧪 Simulando dados de ROI...');
  
  const simulatedData = [
    {
      name: 'LF 15',
      revenue: 50000,
      traffic: 20000,
      roi: 150.0,
      roiFormatted: '+150.0%',
      roas: 2.5,
      roasFormatted: '2.5x'
    },
    {
      name: 'LF 20',
      revenue: 35000,
      traffic: 25000,
      roi: 40.0,
      roiFormatted: '+40.0%',
      roas: 1.4,
      roasFormatted: '1.4x'
    },
    {
      name: 'LF 25',
      revenue: 28000,
      traffic: 30000,
      roi: -6.7,
      roiFormatted: '-6.7%',
      roas: 0.93,
      roasFormatted: '0.93x'
    }
  ];
  
  console.log('📊 Dados simulados:', simulatedData);
  
  // Verificar se os dados estão no formato correto
  const isValid = simulatedData.every(item => 
    item.name && 
    typeof item.revenue === 'number' &&
    typeof item.traffic === 'number' &&
    typeof item.roi === 'number' &&
    item.roiFormatted &&
    typeof item.roas === 'number' &&
    item.roasFormatted
  );
  
  if (isValid) {
    console.log('✅ Dados simulados estão no formato correto');
  } else {
    console.log('❌ Dados simulados têm formato incorreto');
  }
  
  return simulatedData;
}

// Função para calcular ROI manualmente
function calculateROI(revenue, investment) {
  if (investment <= 0) return 0;
  return ((revenue - investment) / investment) * 100;
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

1. Verificar dados de ROI:
   - Execute: checkROIData()

2. Verificar renderização do gráfico:
   - Execute: checkROIGraphRendering()

3. Verificar dados de faturamento e tráfego:
   - Execute: checkRevenueAndTrafficData()

4. Simular dados de ROI:
   - Execute: simulateROIData()

5. Executar todas as verificações:
   - Execute: runAllROITests()
`);

// Função para executar todas as verificações
function runAllROITests() {
  console.log('🧪 Executando todas as verificações do gráfico de ROI...');
  
  console.log('\n=== VERIFICAÇÃO 1: Dados de ROI ===');
  checkROIData();
  
  console.log('\n=== VERIFICAÇÃO 2: Renderização ===');
  checkROIGraphRendering();
  
  console.log('\n=== VERIFICAÇÃO 3: Dados de faturamento e tráfego ===');
  checkRevenueAndTrafficData();
  
  console.log('\n=== VERIFICAÇÃO 4: Simulação ===');
  simulateROIData();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
if (roiData && roiData.length > 0) {
  checkROIData();
} else {
  console.log('💡 Para testar, primeiro carregue os dados de faturamento na página de Lead Scoring');
} 