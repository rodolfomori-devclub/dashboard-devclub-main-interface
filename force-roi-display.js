// Script para forçar a exibição do gráfico de ROI
// Execute este script no console do navegador

console.log('🔧 Forçando exibição do gráfico de ROI...');

// Função para verificar se o gráfico está sendo renderizado
function checkROIGraphVisibility() {
  console.log('🔍 Verificando visibilidade do gráfico de ROI...');
  
  // Verificar se o elemento existe
  const roiGraph = document.querySelector('h2');
  let roiGraphFound = false;
  
  if (roiGraph) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach((header, index) => {
      if (header.textContent.includes('Faturamento x Investimento')) {
        roiGraphFound = true;
        console.log(`✅ Gráfico de ROI encontrado na posição ${index + 1}`);
        
        // Verificar se o container está visível
        const container = header.closest('.bg-white, .bg-gray-800');
        if (container) {
          const computedStyle = window.getComputedStyle(container);
          console.log('📊 Estilo do container:');
          console.log('  - Display:', computedStyle.display);
          console.log('  - Visibility:', computedStyle.visibility);
          console.log('  - Opacity:', computedStyle.opacity);
          console.log('  - Height:', computedStyle.height);
          
          if (computedStyle.display === 'none') {
            console.log('❌ Container está com display: none');
          } else {
            console.log('✅ Container está visível');
          }
        }
      }
    });
  }
  
  if (!roiGraphFound) {
    console.log('❌ Gráfico de ROI não encontrado na página');
  }
  
  return roiGraphFound;
}

// Função para forçar a exibição do gráfico
function forceROIDisplay() {
  console.log('🔧 Forçando exibição do gráfico de ROI...');
  
  // Verificar se temos dados de ROI
  if (!window.roiData || window.roiData.length === 0) {
    console.log('❌ Não há dados de ROI para exibir');
    return false;
  }
  
  console.log('✅ Dados de ROI encontrados:', window.roiData.length, 'lançamentos');
  
  // Verificar se o gráfico já existe
  const existingGraph = document.querySelector('h2');
  let graphExists = false;
  
  if (existingGraph) {
    const allHeaders = Array.from(document.querySelectorAll('h2'));
    allHeaders.forEach(header => {
      if (header.textContent.includes('Faturamento x Investimento')) {
        graphExists = true;
        console.log('✅ Gráfico já existe na página');
      }
    });
  }
  
  if (!graphExists) {
    console.log('❌ Gráfico não encontrado, criando manualmente...');
    
    // Criar o gráfico manualmente
    const graphContainer = document.createElement('div');
    graphContainer.className = 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-6';
    graphContainer.style.border = '2px solid red';
    graphContainer.innerHTML = `
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-semibold text-text-light dark:text-text-dark">
          Faturamento x Investimento em Tráfego (FORÇADO)
        </h2>
      </div>
      <div style="height: 400px; background: #f0f0f0; display: flex; align-items: center; justify-content: center;">
        <p>Gráfico de ROI - Dados disponíveis: ${window.roiData.length} lançamentos</p>
      </div>
      <div class="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">ROI Médio</h3>
          <p class="text-2xl font-bold text-green-600">
            ${(window.roiData.reduce((sum, item) => sum + item.roi, 0) / window.roiData.length).toFixed(1)}%
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">ROAS Médio</h3>
          <p class="text-2xl font-bold text-blue-600">
            ${(window.roiData.reduce((sum, item) => sum + item.roas, 0) / window.roiData.length).toFixed(2)}x
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Melhor ROI</h3>
          <p class="text-2xl font-bold text-green-600">
            ${Math.max(...window.roiData.map(item => item.roi)).toFixed(1)}%
          </p>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
          <h3 class="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Lançamentos Lucrativos</h3>
          <p class="text-2xl font-bold text-green-600">
            ${window.roiData.filter(item => item.roi > 0).length}/${window.roiData.length}
          </p>
        </div>
      </div>
    `;
    
    // Inserir o gráfico na página
    const mainContainer = document.querySelector('.max-w-7xl');
    if (mainContainer) {
      // Inserir após o gráfico de tráfego
      const trafficGraph = mainContainer.querySelector('h2');
      if (trafficGraph && trafficGraph.textContent.includes('Gasto em Tráfego')) {
        const trafficContainer = trafficGraph.closest('.bg-white, .bg-gray-800');
        if (trafficContainer) {
          trafficContainer.parentNode.insertBefore(graphContainer, trafficContainer.nextSibling);
          console.log('✅ Gráfico de ROI inserido após o gráfico de tráfego');
        }
      } else {
        mainContainer.appendChild(graphContainer);
        console.log('✅ Gráfico de ROI inserido no final da página');
      }
    } else {
      document.body.appendChild(graphContainer);
      console.log('✅ Gráfico de ROI inserido no body');
    }
  }
  
  return true;
}

// Função para mostrar detalhes dos dados de ROI
function showROIDetails() {
  console.log('📊 Detalhes dos dados de ROI:');
  
  if (!window.roiData || window.roiData.length === 0) {
    console.log('❌ Nenhum dado de ROI disponível');
    return;
  }
  
  window.roiData.forEach((item, index) => {
    console.log(`${index + 1}. ${item.name}:`);
    console.log(`   - Faturamento: R$ ${item.revenue.toFixed(2)}`);
    console.log(`   - Investimento: R$ ${item.traffic.toFixed(2)}`);
    console.log(`   - ROI: ${item.roiFormatted}`);
    console.log(`   - ROAS: ${item.roasFormatted}`);
  });
  
  // Calcular estatísticas
  const avgROI = window.roiData.reduce((sum, item) => sum + item.roi, 0) / window.roiData.length;
  const avgROAS = window.roiData.reduce((sum, item) => sum + item.roas, 0) / window.roiData.length;
  const maxROI = Math.max(...window.roiData.map(item => item.roi));
  const profitableCount = window.roiData.filter(item => item.roi > 0).length;
  
  console.log('\n📈 Estatísticas:');
  console.log(`  - ROI Médio: ${avgROI.toFixed(1)}%`);
  console.log(`  - ROAS Médio: ${avgROAS.toFixed(2)}x`);
  console.log(`  - Melhor ROI: ${maxROI.toFixed(1)}%`);
  console.log(`  - Lançamentos Lucrativos: ${profitableCount}/${window.roiData.length}`);
}

// Função para verificar se o React está renderizando corretamente
function checkReactRendering() {
  console.log('⚛️ Verificando renderização do React...');
  
  // Verificar se o estado está sendo atualizado
  if (window.roiData) {
    console.log('✅ Estado roiData está definido');
    console.log('📊 Número de itens:', window.roiData.length);
    
    // Verificar se o React está detectando a mudança
    const reactRoot = document.querySelector('#root');
    if (reactRoot) {
      console.log('✅ React root encontrado');
      
      // Forçar re-renderização
      const event = new Event('resize');
      window.dispatchEvent(event);
      console.log('🔄 Evento de resize disparado para forçar re-renderização');
    }
  } else {
    console.log('❌ Estado roiData não está definido');
  }
}

// Executar verificações
console.log(`
🧪 INSTRUÇÕES DE TESTE:

1. Verificar visibilidade do gráfico:
   - Execute: checkROIGraphVisibility()

2. Forçar exibição do gráfico:
   - Execute: forceROIDisplay()

3. Mostrar detalhes dos dados:
   - Execute: showROIDetails()

4. Verificar renderização do React:
   - Execute: checkReactRendering()

5. Executar todas as verificações:
   - Execute: runAllForceChecks()
`);

// Função para executar todas as verificações
function runAllForceChecks() {
  console.log('🧪 Executando todas as verificações de força...');
  
  console.log('\n=== VERIFICAÇÃO 1: Visibilidade ===');
  checkROIGraphVisibility();
  
  console.log('\n=== VERIFICAÇÃO 2: Forçar exibição ===');
  forceROIDisplay();
  
  console.log('\n=== VERIFICAÇÃO 3: Detalhes ===');
  showROIDetails();
  
  console.log('\n=== VERIFICAÇÃO 4: React ===');
  checkReactRendering();
  
  console.log('\n✅ Todas as verificações concluídas!');
}

// Executar verificação inicial
checkROIGraphVisibility(); 