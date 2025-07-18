// Script para verificar condições do ROI
// Execute este script no console do navegador

console.log('🔍 VERIFICANDO CONDIÇÕES DO ROI');

// Verificar se processedData existe
console.log('1. Verificando processedData...');
if (window.processedData) {
  console.log('✅ processedData existe');
  console.log('📊 Propriedades:', Object.keys(window.processedData));
  
  if (window.processedData.trafficByLaunch) {
    console.log('✅ trafficByLaunch existe');
    console.log('📊 Comprimento:', window.processedData.trafficByLaunch.length);
    console.log('📊 Primeiro item:', window.processedData.trafficByLaunch[0]);
  } else {
    console.log('❌ trafficByLaunch não existe');
  }
} else {
  console.log('❌ processedData não existe');
}

// Verificar se revenueData existe
console.log('\n2. Verificando revenueData...');
if (window.revenueData) {
  console.log('✅ revenueData existe');
  console.log('📊 Comprimento:', window.revenueData.length);
  console.log('📊 Primeiro item:', window.revenueData[0]);
} else {
  console.log('❌ revenueData não existe');
}

// Verificar se allLaunchesData existe
console.log('\n3. Verificando allLaunchesData...');
if (window.allLaunchesData) {
  console.log('✅ allLaunchesData existe');
  console.log('📊 Lançamentos:', window.allLaunchesData.launches?.length || 0);
} else {
  console.log('❌ allLaunchesData não existe');
}

// Verificar se a função fetchRevenueData foi chamada
console.log('\n4. Verificando se fetchRevenueData foi chamada...');
if (window.revenueData && window.revenueData.length > 0) {
  console.log('✅ fetchRevenueData foi chamada (revenueData existe)');
} else {
  console.log('❌ fetchRevenueData não foi chamada ou não retornou dados');
}

// Verificar se as condições para calcular ROI estão satisfeitas
console.log('\n5. Verificando condições para ROI...');
const hasProcessedData = !!window.processedData;
const hasTrafficData = !!(window.processedData && window.processedData.trafficByLaunch);
const hasRevenueData = !!(window.revenueData && window.revenueData.length > 0);

console.log('📊 processedData existe:', hasProcessedData);
console.log('📊 trafficByLaunch existe:', hasTrafficData);
console.log('📊 revenueData existe:', hasRevenueData);

if (hasProcessedData && hasTrafficData && hasRevenueData) {
  console.log('✅ Todas as condições estão satisfeitas para calcular ROI');
  
  // Tentar calcular ROI manualmente
  console.log('\n6. Calculando ROI manualmente...');
  const roiData = window.revenueData.map(revenueItem => {
    const trafficItem = window.processedData.trafficByLaunch.find(t => t.name === revenueItem.launch);
    if (trafficItem && trafficItem.traffic > 0) {
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
  
  console.log('📊 ROI calculado manualmente:', roiData.length, 'itens');
  console.log('📊 Primeiro item:', roiData[0]);
  
  // Definir roiData globalmente para teste
  window.roiData = roiData;
  console.log('✅ roiData definido globalmente para teste');
  
} else {
  console.log('❌ Condições não satisfeitas para calcular ROI');
  console.log('📊 Faltando:');
  if (!hasProcessedData) console.log('  - processedData');
  if (!hasTrafficData) console.log('  - trafficByLaunch');
  if (!hasRevenueData) console.log('  - revenueData');
}

// Verificar se o botão "Buscar Faturamento" foi clicado
console.log('\n7. Verificando se o botão foi clicado...');
const buttons = Array.from(document.querySelectorAll('button'));
const revenueButton = buttons.find(btn => btn.textContent.includes('Buscar Faturamento') || btn.textContent.includes('💰'));
if (revenueButton) {
  console.log('✅ Botão "Buscar Faturamento" encontrado');
  console.log('📊 Texto do botão:', revenueButton.textContent);
} else {
  console.log('❌ Botão "Buscar Faturamento" não encontrado');
}

// Criar botão de teste para forçar cálculo
console.log('\n8. Criando botão de teste...');
const testButton = document.createElement('button');
testButton.style.cssText = `
  position: fixed;
  top: 20px;
  right: 20px;
  background: #10B981;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  z-index: 9999;
  font-weight: bold;
`;

testButton.textContent = '🔧 FORÇAR ROI';
testButton.onclick = () => {
  console.log('🔧 Forçando cálculo de ROI...');
  
  if (window.revenueData && window.processedData?.trafficByLaunch) {
    const roiData = window.revenueData.map(revenueItem => {
      const trafficItem = window.processedData.trafficByLaunch.find(t => t.name === revenueItem.launch);
      if (trafficItem && trafficItem.traffic > 0) {
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
    
    window.roiData = roiData;
    console.log('✅ ROI forçado:', roiData.length, 'itens');
    
    // Recarregar a página para ver o gráfico
    alert(`ROI calculado: ${roiData.length} itens. Recarregue a página para ver o gráfico.`);
  } else {
    alert('Dados insuficientes para calcular ROI. Clique em "Buscar Faturamento" primeiro.');
  }
};

document.body.appendChild(testButton);
console.log('✅ Botão de teste criado no canto superior direito');

console.log('\n🎯 RESUMO:');
console.log('- processedData:', hasProcessedData ? '✅' : '❌');
console.log('- trafficByLaunch:', hasTrafficData ? '✅' : '❌');
console.log('- revenueData:', hasRevenueData ? '✅' : '❌');
console.log('- Condições para ROI:', (hasProcessedData && hasTrafficData && hasRevenueData) ? '✅' : '❌');
console.log('- roiData calculado:', window.roiData ? '✅' : '❌'); 