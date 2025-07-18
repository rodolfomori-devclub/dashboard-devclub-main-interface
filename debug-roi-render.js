// Script de debug específico para o gráfico de ROI
// Execute este script no console do navegador

console.log('🔍 DEBUG ESPECÍFICO DO GRÁFICO DE ROI');

// Função para verificar o estado do React
function checkReactState() {
  console.log('⚛️ Verificando estado do React...');
  
  // Tentar acessar o estado através do React DevTools
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('✅ React DevTools disponível');
  } else {
    console.log('❌ React DevTools não disponível');
  }
  
  // Verificar se o componente está montado
  const reactRoot = document.querySelector('#root');
  if (reactRoot) {
    console.log('✅ React root encontrado');
    console.log('📊 Conteúdo do root:', reactRoot.innerHTML.substring(0, 500) + '...');
  } else {
    console.log('❌ React root não encontrado');
  }
}

// Função para verificar se o gráfico está sendo renderizado
function checkROIRender() {
  console.log('🎯 Verificando renderização do gráfico de ROI...');
  
  // Verificar se o elemento existe
  const allHeaders = Array.from(document.querySelectorAll('h2'));
  let roiHeader = null;
  
  allHeaders.forEach((header, index) => {
    if (header.textContent.includes('Faturamento x Investimento')) {
      roiHeader = header;
      console.log(`✅ Header do ROI encontrado na posição ${index + 1}`);
    }
  });
  
  if (!roiHeader) {
    console.log('❌ Header do ROI não encontrado');
    
    // Verificar todos os headers para debug
    console.log('📋 Todos os headers encontrados:');
    allHeaders.forEach((header, index) => {
      console.log(`  ${index + 1}. "${header.textContent}"`);
    });
    
    return false;
  }
  
  // Verificar o container do gráfico
  const container = roiHeader.closest('.bg-white, .bg-gray-800');
  if (container) {
    console.log('✅ Container do gráfico encontrado');
    
    // Verificar se há conteúdo no container
    const chartContent = container.querySelector('.recharts-wrapper');
    if (chartContent) {
      console.log('✅ Conteúdo do gráfico encontrado');
    } else {
      console.log('❌ Conteúdo do gráfico não encontrado');
      
      // Verificar se há algum elemento de gráfico
      const anyChart = container.querySelector('[class*="chart"], [class*="Chart"]');
      if (anyChart) {
        console.log('✅ Algum elemento de gráfico encontrado:', anyChart.className);
      } else {
        console.log('❌ Nenhum elemento de gráfico encontrado');
      }
    }
    
    // Verificar se há resumo de ROI
    const roiSummary = container.querySelector('.grid');
    if (roiSummary) {
      console.log('✅ Resumo de ROI encontrado');
    } else {
      console.log('❌ Resumo de ROI não encontrado');
    }
  } else {
    console.log('❌ Container do gráfico não encontrado');
  }
  
  return true;
}

// Função para verificar dados no console
function checkConsoleData() {
  console.log('📊 Verificando dados no console...');
  
  // Verificar se há dados de ROI no escopo global
  if (window.roiData) {
    console.log('✅ Dados de ROI encontrados no escopo global');
    console.log('📊 Número de itens:', window.roiData.length);
    console.log('📊 Primeiro item:', window.roiData[0]);
  } else {
    console.log('❌ Dados de ROI não encontrados no escopo global');
  }
  
  // Verificar se há dados de faturamento
  if (window.revenueData) {
    console.log('✅ Dados de faturamento encontrados no escopo global');
    console.log('📊 Número de itens:', window.revenueData.length);
  } else {
    console.log('❌ Dados de faturamento não encontrados no escopo global');
  }
  
  // Verificar se há dados de tráfego
  if (window.processedData && window.processedData.trafficByLaunch) {
    console.log('✅ Dados de tráfego encontrados no escopo global');
    console.log('📊 Número de itens:', window.processedData.trafficByLaunch.length);
  } else {
    console.log('❌ Dados de tráfego não encontrados no escopo global');
  }
}

// Função para forçar a renderização
function forceROIRender() {
  console.log('🔧 Forçando renderização do gráfico de ROI...');
  
  // Verificar se temos dados
  if (!window.roiData || window.roiData.length === 0) {
    console.log('❌ Não há dados de ROI para renderizar');
    return false;
  }
  
  // Criar um gráfico simples para teste
  const testContainer = document.createElement('div');
  testContainer.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    height: 300px;
    background: white;
    border: 2px solid red;
    border-radius: 8px;
    padding: 20px;
    z-index: 9999;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  `;
  
  testContainer.innerHTML = `
    <h3 style="margin: 0 0 20px 0; color: red;">TESTE - Gráfico de ROI</h3>
    <div style="height: 200px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; margin-bottom: 20px;">
      <p>Dados: ${window.roiData.length} lançamentos</p>
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div style="background: #e5f3ff; padding: 10px; border-radius: 4px;">
        <strong>ROI Médio:</strong><br>
        ${(window.roiData.reduce((sum, item) => sum + item.roi, 0) / window.roiData.length).toFixed(1)}%
      </div>
      <div style="background: #e5f3ff; padding: 10px; border-radius: 4px;">
        <strong>ROAS Médio:</strong><br>
        ${(window.roiData.reduce((sum, item) => sum + item.roas, 0) / window.roiData.length).toFixed(2)}x
      </div>
    </div>
    <button onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: red; color: white; border: none; border-radius: 4px; padding: 5px 10px; cursor: pointer;">X</button>
  `;
  
  document.body.appendChild(testContainer);
  console.log('✅ Gráfico de teste criado no canto superior direito');
  
  return true;
}

// Função para verificar se há problemas de CSS
function checkCSSIssues() {
  console.log('🎨 Verificando problemas de CSS...');
  
  // Verificar se há elementos ocultos
  const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], [style*="opacity: 0"]');
  console.log(`📊 Elementos ocultos encontrados: ${hiddenElements.length}`);
  
  // Verificar se há elementos com altura 0
  const zeroHeightElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const style = window.getComputedStyle(el);
    return style.height === '0px' || style.height === '0';
  });
  console.log(`📊 Elementos com altura 0: ${zeroHeightElements.length}`);
  
  // Verificar se há overflow hidden
  const overflowHiddenElements = document.querySelectorAll('[style*="overflow: hidden"]');
  console.log(`📊 Elementos com overflow hidden: ${overflowHiddenElements.length}`);
}

// Função para verificar posição do gráfico
function checkGraphPosition() {
  console.log('📍 Verificando posição do gráfico...');
  
  const allContainers = document.querySelectorAll('.bg-white, .bg-gray-800');
  console.log(`📊 Containers encontrados: ${allContainers.length}`);
  
  allContainers.forEach((container, index) => {
    const rect = container.getBoundingClientRect();
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    console.log(`Container ${index + 1}:`);
    console.log(`  - Posição: top=${rect.top}, bottom=${rect.bottom}`);
    console.log(`  - Tamanho: width=${rect.width}, height=${rect.height}`);
    console.log(`  - Visível: ${isVisible ? '✅' : '❌'}`);
    
    // Verificar se contém gráfico de ROI
    const roiHeader = container.querySelector('h2');
    if (roiHeader && roiHeader.textContent.includes('Faturamento x Investimento')) {
      console.log(`  - 🎯 CONTÉM GRÁFICO DE ROI!`);
    }
  });
}

// Função principal
function runFullDebug() {
  console.log('🧪 EXECUTANDO DEBUG COMPLETO DO GRÁFICO DE ROI');
  console.log('=' .repeat(50));
  
  checkReactState();
  console.log('');
  
  checkConsoleData();
  console.log('');
  
  checkROIRender();
  console.log('');
  
  checkCSSIssues();
  console.log('');
  
  checkGraphPosition();
  console.log('');
  
  forceROIRender();
  console.log('');
  
  console.log('✅ Debug completo concluído!');
  console.log('=' .repeat(50));
}

// Executar debug
runFullDebug();

// Expor funções para uso manual
window.debugROI = {
  checkReactState,
  checkConsoleData,
  checkROIRender,
  checkCSSIssues,
  checkGraphPosition,
  forceROIRender,
  runFullDebug
};

console.log(`
🔧 FUNÇÕES DISPONÍVEIS:
- debugROI.checkReactState()
- debugROI.checkConsoleData()
- debugROI.checkROIRender()
- debugROI.checkCSSIssues()
- debugROI.checkGraphPosition()
- debugROI.forceROIRender()
- debugROI.runFullDebug()
`); 